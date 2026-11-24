import { model, Schema, type Types } from 'mongoose';
import { createSchema } from './base';
import { PAYMENT_STATUS } from '../config/constants';

/**
 * Every payment attempt is stored. Payments are only ever marked `paid` by
 * server-side verification (gateway signature check or admin verification) —
 * never from a client response.
 */
const paymentSchema = createSchema({
  paymentId: { type: String, required: true, unique: true, index: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  competition: { type: Schema.Types.ObjectId, ref: 'Competition', index: true },
  registration: { type: Schema.Types.ObjectId, ref: 'EventRegistration', index: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: PAYMENT_STATUS, default: 'pending', required: true, index: true },
  method: { type: String, enum: ['manual', 'gateway'], default: 'manual' },
  gateway: { type: String, enum: ['razorpay', 'manual', 'none'], default: 'manual' },
  gatewayOrderId: { type: String, trim: true },
  gatewayPaymentId: { type: String, trim: true },
  gatewaySignature: { type: String, trim: true },
  reference: { type: String, trim: true, maxlength: 200 },
  notes: { type: String, trim: true, maxlength: 1000 },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },
  refundedAt: { type: Date },
});

paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ event: 1, status: 1 });

export interface PaymentDoc {
  _id: Types.ObjectId;
  paymentId: string;
  student: Types.ObjectId;
  event: Types.ObjectId;
  competition?: Types.ObjectId;
  registration?: Types.ObjectId;
  amount: number;
  currency: string;
  status: string;
  method: string;
  gateway: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  reference?: string;
  notes?: string;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
export const Payment = model<PaymentDoc>('Payment', paymentSchema);
