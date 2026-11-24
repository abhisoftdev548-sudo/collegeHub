'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, IndianRupee, MapPin, QrCode, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { FormDialog } from '@/components/shared/form-dialog';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Badge, statusVariant } from '@/components/ui/badge';
import { CardSkeleton } from '@/components/ui/skeleton';
import { api, getErrorMessage } from '@/lib/api';
import { formatCurrency, formatDate, formatDateTime, titleCase } from '@/lib/utils';
import type { Payment, Registration } from '@/types/api';

const idOf = (value: unknown): string =>
  typeof value === 'object' && value !== null && '_id' in value ? String((value as { _id: string })._id) : String(value ?? '');

/** Payments reference the registration first; fall back to the event for older rows. */
const paymentFor = (payments: Payment[], registration: Registration) =>
  payments.find((item) => idOf(item.registration) === registration._id) ??
  payments.find((item) => idOf(item.event) === idOf(registration.event) && item.status !== 'paid');

export default function MyRegistrationsPage() {
  const [payFor, setPayFor] = useState<{ registration: Registration; payment?: Payment } | null>(null);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const registrationsQuery = useQuery({
    queryKey: ['my-registrations'],
    queryFn: () => api.get<Registration[]>('/events/my-registrations'),
  });
  const paymentsQuery = useQuery({
    queryKey: ['my-payments'],
    queryFn: () => api.get<Payment[]>('/events/my-payments'),
  });

  const payments = paymentsQuery.data ?? [];

  const openPayment = (registration: Registration) => {
    const payment = paymentFor(payments, registration);
    setPayFor({ registration, payment });
    setReference(payment?.reference ?? '');
    setNotes('');
  };

  const submitReference = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (!payFor?.payment) {
      toast.error('No pending payment found for this registration');
      return;
    }
    if (reference.trim().length < 3) {
      toast.error('Enter the transaction reference');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/events/payments/${payFor.payment._id}/reference`, {
        reference: reference.trim(),
        notes: notes.trim() || undefined,
      });
      toast.success('Reference submitted — the office will verify your payment');
      setPayFor(null);
      await Promise.all([paymentsQuery.refetch(), registrationsQuery.refetch()]);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (registrationsQuery.isLoading) {
    return (
      <div>
        <PageHeader eyebrow="Events" title="My registrations" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <CardSkeleton key={index} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (registrationsQuery.error) {
    return (
      <div>
        <PageHeader eyebrow="Events" title="My registrations" />
        <ErrorState error={registrationsQuery.error} onRetry={() => void registrationsQuery.refetch()} />
      </div>
    );
  }

  const registrations = registrationsQuery.data ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Events"
        title="My registrations"
        description="Your event registrations, payment status and check-in codes."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/explore">Explore events</Link>
          </Button>
        }
      />

      {registrations.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No registrations yet"
          description="Browse campus events and register to see them here."
          action={<Button size="sm" asChild><Link href="/dashboard/explore">Explore events</Link></Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {registrations.map((registration) => {
            const event = typeof registration.event === 'object' ? registration.event : null;
            const payment = paymentFor(payments, registration);
            return (
              <SectionCard
                key={registration._id}
                title={event?.title ?? 'Event'}
                description={registration.registrationId}
                action={
                  <div className="flex flex-wrap justify-end gap-1">
                    <Badge variant={statusVariant(registration.status)} size="sm">{titleCase(registration.status)}</Badge>
                    <Badge variant={statusVariant(registration.paymentStatus)} size="sm">{titleCase(registration.paymentStatus)}</Badge>
                  </div>
                }
              >
                <div className="space-y-2 text-[12px] text-ink-soft">
                  {event?.startDate ? (
                    <p className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" />
                      {formatDate(event.startDate)}
                    </p>
                  ) : null}
                  {event?.venue ? (
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      {event.venue}
                    </p>
                  ) : null}
                  <p className="flex items-center gap-1.5">
                    <IndianRupee className="h-3.5 w-3.5 text-primary" />
                    {formatCurrency(registration.feeAmount)} · {titleCase(registration.paymentStatus)}
                  </p>
                </div>

                {registration.checkInCode ? (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-subtle/60 px-3 py-2">
                    <div>
                      <p className="flex items-center gap-1 text-[10.5px] uppercase tracking-wide text-subtle-foreground">
                        <QrCode className="h-3 w-3" /> Check-in code
                      </p>
                      <p className="font-mono text-[12.5px] font-semibold tracking-wider text-primary">
                        {registration.checkInCode}
                      </p>
                    </div>
                    {registration.checkedInAt ? (
                      <Badge variant="success" size="sm">
                        Checked in {formatDateTime(registration.checkedInAt)}
                      </Badge>
                    ) : null}
                  </div>
                ) : null}

                {registration.feeAmount > 0 && registration.paymentStatus !== 'paid' ? (
                  <div className="mt-3">
                    {payment?.status === 'pending' && payment.reference ? (
                      <p className="rounded-lg bg-warning-soft px-3 py-2 text-[11.5px] text-warning">
                        Reference submitted ({payment.reference}) — awaiting verification.
                      </p>
                    ) : (
                      <Button size="sm" className="w-full" onClick={() => openPayment(registration)}>
                        <IndianRupee className="h-3.5 w-3.5" /> Submit payment reference
                      </Button>
                    )}
                  </div>
                ) : null}
              </SectionCard>
            );
          })}
        </div>
      )}

      <FormDialog
        open={Boolean(payFor)}
        onOpenChange={(value) => {
          if (!value) setPayFor(null);
        }}
        title="Submit payment reference"
        description={
          payFor?.payment
            ? `Payment ${payFor.payment.paymentId} · ${formatCurrency(payFor.payment.amount)}`
            : 'Payment details'
        }
        submitLabel="Submit for verification"
        submitting={submitting}
        size="sm"
        onSubmit={submitReference}
      >
        <FormField label="Transaction / UPI reference" htmlFor="payment-reference" required hint="As shown in your bank or UPI app">
          <Input
            id="payment-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="UPI-1234567890"
            className="font-mono"
          />
        </FormField>
        <FormField label="Notes" htmlFor="payment-notes" hint="Optional — anything the office should know">
          <Textarea id="payment-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </FormField>
        <p className="rounded-lg bg-primary-soft/60 px-3 py-2 text-[11.5px] leading-relaxed text-ink-soft">
          The office verifies every reference manually. Your registration is confirmed automatically as soon as the
          payment is marked as received.
        </p>
      </FormDialog>
    </div>
  );
}
