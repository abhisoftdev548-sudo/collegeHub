'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { CheckCircle2, IndianRupee, Ticket, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FormField } from '@/components/shared/form-field';
import { DynamicFormRenderer, type FormAnswers } from '@/components/events/dynamic-form-renderer';
import { api, getErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { DynamicForm, EventItem, Registration } from '@/types/api';

const idOf = (value: unknown): string =>
  typeof value === 'object' && value !== null && '_id' in value ? String((value as { _id: string })._id) : String(value ?? '');

/**
 * Registration flow for a student:
 *  1. fill the event's dynamic form (if one is attached)
 *  2. optionally provide a team name + members
 *  3. submit — the server prices the registration, enforces capacity and
 *     creates a pending payment when a fee applies.
 */
export const RegistrationDialog = ({
  event,
  open,
  onOpenChange,
  onRegistered,
}: {
  event: EventItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered: () => void;
}) => {
  const formId = event.registration?.form ? idOf(event.registration.form) : '';
  const isTeam = event.registration?.feeType === 'team';
  const fee = event.registration?.fee ?? 0;

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Registration | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamMembers, setTeamMembers] = useState('');

  const formQuery = useQuery({
    queryKey: ['dynamic-form', formId],
    queryFn: () => api.get<DynamicForm>(`/events/forms/${formId}`),
    enabled: open && Boolean(formId),
  });

  const answersForm = useForm<FormAnswers>({ defaultValues: {} });

  const handleSubmit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    const definition = formQuery.data;

    if (definition) {
      const valid = await answersForm.trigger();
      if (!valid) {
        toast.error('Please complete the required fields');
        return;
      }
    }

    const values = answersForm.getValues();
    const answers = (definition?.fields ?? []).map((field) => ({
      key: field.key,
      label: field.label,
      value: values[field.key] ?? (field.type === 'multi_select' ? [] : ''),
    }));

    setSubmitting(true);
    try {
      const registration = await api.post<Registration>(`/events/${event._id}/register`, {
        answers,
        teamName: isTeam && teamName.trim() ? teamName.trim() : undefined,
        teamMembers:
          isTeam && teamMembers.trim()
            ? teamMembers
                .split(',')
                .map((member) => member.trim())
                .filter(Boolean)
                .map((name, index) => ({ name, isLeader: index === 0 }))
            : undefined,
      });
      setResult(registration);
      onRegistered();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) {
          setResult(null);
          setTeamName('');
          setTeamMembers('');
          answersForm.reset({});
        }
      }}
    >
      <DialogContent className="max-w-xl">
        {result ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-success-soft">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <DialogTitle className="text-center">
                {result.status === 'pending' ? 'Registration received' : 'You are registered'}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {result.status === 'pending'
                  ? 'The coordinator will review your registration. You will be notified once it is approved.'
                  : 'Your place is confirmed. Show the check-in code at the venue.'}
              </DialogDescription>
            </div>

            <div className="rounded-xl border border-line bg-surface-subtle/50 p-4 text-center">
              <p className="text-[11px] uppercase tracking-wide text-subtle-foreground">Registration ID</p>
              <p className="mt-0.5 font-mono text-[13px] font-medium text-ink">{result.registrationId}</p>
              {result.checkedInAt === undefined && result.checkInCode ? (
                <>
                  <p className="mt-3 text-[11px] uppercase tracking-wide text-subtle-foreground">Check-in code</p>
                  <p className="mt-0.5 font-mono text-[15px] font-semibold tracking-wider text-primary">
                    {result.checkInCode}
                  </p>
                </>
              ) : null}
            </div>

            {result.feeAmount > 0 ? (
              <div className="rounded-xl border border-warning/25 bg-warning-soft px-4 py-3">
                <p className="flex items-center gap-1.5 text-[12px] font-medium text-warning">
                  <IndianRupee className="h-3.5 w-3.5" /> Payment pending · {formatCurrency(result.feeAmount)}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-warning/90">
                  Complete the payment from “My registrations”, then submit the transaction reference for
                  verification by the office.
                </p>
              </div>
            ) : null}

            <Button className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Register for {event.title}</DialogTitle>
              <DialogDescription>
                {event.registration?.requiresApproval
                  ? 'Your registration will be reviewed by the coordinator.'
                  : 'Your place is confirmed immediately.'}
                {fee > 0 ? ` A participation fee of ${formatCurrency(fee)} applies.` : ' This event is free.'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="neutral" size="sm"><Ticket className="h-3 w-3" /> {formatCurrency(fee)}</Badge>
                {event.registration?.requiresApproval ? <Badge variant="warning" size="sm">Approval required</Badge> : null}
                {isTeam ? <Badge variant="accent" size="sm"><Users className="h-3 w-3" /> Team event</Badge> : null}
              </div>

              {formQuery.isLoading ? (
                <p className="text-[12px] text-muted-foreground">Loading form…</p>
              ) : formQuery.data ? (
                <DynamicFormRenderer
                  fields={formQuery.data.fields}
                  control={answersForm.control}
                  errors={answersForm.formState.errors}
                />
              ) : null}

              {isTeam ? (
                <>
                  <FormField label="Team name" htmlFor="team-name" hint="Optional but recommended">
                    <Input id="team-name" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Team Bytecode" />
                  </FormField>
                  <FormField label="Team members" htmlFor="team-members" hint="Comma separated names">
                    <Input
                      id="team-members"
                      value={teamMembers}
                      onChange={(e) => setTeamMembers(e.target.value)}
                      placeholder="Aditi Sharma, Rahul Verma"
                    />
                  </FormField>
                </>
              ) : null}

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" loading={submitting}>
                  Confirm registration
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
