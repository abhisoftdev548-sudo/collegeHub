import crypto from 'node:crypto';
import { createHmac } from 'node:crypto';
import { Event, EventRegistration, Payment, User } from '../models';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { createNotification } from './notificationService';
import { paginated } from '../utils/apiResponse';
import { refId } from '../utils/ids';

/**
 * Payment lifecycle.
 *
 * Security model:
 *  - The *amount* is always read from the server-side registration record.
 *  - A payment only becomes `paid` after server-side verification:
 *      • gateway: HMAC signature verification (Razorpay-style) using a secret
 *        that never leaves the server, or
 *      • manual: an authorised admin/teacher verifies an offline reference.
 *  - The client can never assert its own payment success.
 */

const getGatewaySecret = (): string | null => process.env.RAZORPAY_KEY_SECRET ?? null;

export const createPaymentOrder = async (registrationId: string, studentId: string) => {
  const registration = await EventRegistration.findById(registrationId).populate('event', 'title');
  if (!registration) throw new NotFoundError('Registration');
  if (refId(registration.student) !== studentId) throw new ForbiddenError('This registration is not yours');
  if (registration.paymentStatus === 'paid') throw new ConflictError('This registration is already paid');
  if (!registration.feeAmount || registration.feeAmount <= 0) throw new ValidationError('This registration has no fee');

  let payment = await Payment.findOne({ registration: registration._id, status: 'pending' });
  if (!payment) {
    payment = await Payment.create({
      paymentId: `PAY-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      student: studentId,
      event: registration.event,
      competition: registration.competition,
      registration: registration._id,
      amount: registration.feeAmount,
      status: 'pending',
      gateway: 'manual',
      method: 'manual',
    });
  }

  return {
    paymentId: String(payment._id),
    reference: payment.paymentId,
    amount: payment.amount,
    currency: payment.currency,
    gatewayEnabled: Boolean(getGatewaySecret()),
    instructions: 'Pay using the college payment counter or UPI, then submit the transaction reference for verification.',
  };
};

export const submitManualReference = async (
  paymentId: string,
  studentId: string,
  reference: string,
  notes?: string,
) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new NotFoundError('Payment');
  if (String(payment.student) !== studentId) throw new ForbiddenError('This payment is not yours');
  if (payment.status !== 'pending') throw new ConflictError('This payment can no longer be updated');
  if (!reference.trim()) throw new ValidationError('Enter the transaction reference');

  payment.reference = reference.trim().slice(0, 200);
  payment.notes = notes?.slice(0, 1000);
  await payment.save();

  await createNotification([
    {
      user: String(payment.student),
      type: 'event_update',
      title: 'Payment reference submitted',
      message: 'Your payment reference is awaiting verification by the accounts team.',
      link: '/dashboard/registrations',
    },
  ]);

  return payment;
};

export const verifyPayment = async (
  paymentId: string,
  actorId: string,
  outcome: 'paid' | 'failed' | 'refunded',
  notes?: string,
) => {
  const payment = await Payment.findById(paymentId).populate('registration');
  if (!payment) throw new NotFoundError('Payment');
  if (payment.status === 'paid' && outcome === 'paid') throw new ConflictError('This payment is already verified');

  if (outcome === 'paid' && !payment.reference && payment.gateway === 'manual') {
    throw new ValidationError('A transaction reference is required before verifying an offline payment');
  }

  payment.status = outcome;
  payment.notes = notes?.slice(0, 1000) ?? payment.notes;
  payment.verifiedBy = actorId as never;
  payment.verifiedAt = new Date();
  if (outcome === 'refunded') payment.refundedAt = new Date();
  await payment.save();

  if (payment.registration) {
    await EventRegistration.updateOne(
      { _id: payment.registration },
      {
        $set: {
          paymentStatus: outcome,
          ...(outcome === 'paid' ? { status: 'confirmed' } : {}),
        },
      },
    );
    const registration = await EventRegistration.findById(payment.registration).populate('event', 'title');
    if (registration) {
      await createNotification([
        {
          user: refId(registration.student),
          type: 'event_update',
          title: outcome === 'paid' ? 'Payment verified' : `Payment ${outcome}`,
          message: `Your payment for ${(registration.event as unknown as { title?: string })?.title ?? 'the event'} is now ${outcome}.`,
          link: '/dashboard/registrations',
        },
      ]);
    }
  }

  return payment;
};

/**
 * Gateway callback verification (Razorpay-compatible scheme).
 * order_id|payment_id signed with the secret must equal the received signature.
 */
export const verifyGatewayPayment = async (input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) => {
  const secret = getGatewaySecret();
  if (!secret) throw new ValidationError('Online payments are not configured');

  const expected = createHmac('sha256', secret)
    .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
    .digest('hex');

  const received = input.razorpaySignature;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!valid) throw new ForbiddenError('Payment signature verification failed');

  const payment = await Payment.findOne({ gatewayOrderId: input.razorpayOrderId });
  if (!payment) throw new NotFoundError('Payment');
  if (payment.status === 'paid') return payment;

  payment.status = 'paid';
  payment.gateway = 'razorpay';
  payment.method = 'gateway';
  payment.gatewayPaymentId = input.razorpayPaymentId;
  payment.gatewaySignature = input.razorpaySignature;
  payment.verifiedAt = new Date();
  await payment.save();

  if (payment.registration) {
    await EventRegistration.updateOne(
      { _id: payment.registration },
      { $set: { paymentStatus: 'paid', status: 'confirmed' } },
    );
  }
  return payment;
};

export const listPayments = async (params: {
  page: number;
  limit: number;
  status?: string;
  event?: string;
  search?: string;
}) => {
  const filter: Record<string, unknown> = {};
  if (params.status) filter.status = params.status;
  if (params.event) filter.event = params.event;

  const [items, total] = await Promise.all([
    Payment.find(filter)
      .populate('student', 'name email')
      .populate('event', 'title')
      .sort({ createdAt: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .lean(),
    Payment.countDocuments(filter),
  ]);

  if (!params.search) return { items, total };
  const regex = new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const filtered = items.filter((item) => {
    const student = item.student as unknown as { name?: string; email?: string } | null;
    return (
      regex.test(item.paymentId) ||
      regex.test(item.reference ?? '') ||
      regex.test(student?.name ?? '') ||
      regex.test(student?.email ?? '')
    );
  });
  return { items: filtered, total: filtered.length };
};

export const listMyPayments = async (studentId: string) =>
  Payment.find({ student: studentId })
    .populate('event', 'title')
    .sort({ createdAt: -1 })
    .lean();

export { paginated };
