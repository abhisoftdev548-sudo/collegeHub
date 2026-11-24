'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Award, ExternalLink, Plus, Trophy } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { FormField } from '@/components/shared/form-field';
import { FormDialog } from '@/components/shared/form-dialog';
import { useApiMutation } from '@/components/shared/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Competition, EventItem, Teacher } from '@/types/api';

const schema = z.object({
  title: z.string().trim().min(3, 'Enter the competition title').max(200),
  description: z.string().trim().max(5000).optional(),
  event: z.string().min(1, 'Select the parent event'),
  category: z.string().trim().max(80).optional(),
  rules: z.string().trim().max(5000).optional(),
  eligibility: z.string().trim().max(2000).optional(),
  maxParticipants: z.coerce.number().int().min(0).optional(),
  allowTeamRegistration: z.boolean(),
  teamSize: z.coerce.number().int().min(1).max(20),
  registrationDeadline: z.string().optional(),
  submissionRequired: z.boolean(),
  submissionDeadline: z.string().optional(),
  fee: z.coerce.number().min(0).max(100000),
  feeType: z.enum(['individual', 'team']),
  venue: z.string().trim().max(200).optional(),
});

type FormInput = z.input<typeof schema>;
type Values = z.output<typeof schema>;

const defaults: FormInput = {
  title: '',
  description: '',
  event: '',
  category: '',
  rules: '',
  eligibility: '',
  maxParticipants: undefined,
  allowTeamRegistration: false,
  teamSize: 1,
  registrationDeadline: '',
  submissionRequired: false,
  submissionDeadline: '',
  fee: 0,
  feeType: 'individual',
  venue: '',
};

export default function CompetitionsPage() {
  const { hasAnyPermission } = useAuth();
  const canManage = hasAnyPermission('competition:manage', 'event:update');
  const [open, setOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => api.getPaginated<Competition>('/competitions', { params: { limit: 50 } }),
  });
  const { data: events } = useQuery({
    queryKey: ['events', 'for-competitions'],
    queryFn: () => api.get<EventItem[]>('/events', { params: { limit: 100, includeSubEvents: true } }),
    enabled: canManage,
  });

  const form = useForm<FormInput, unknown, Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  const allowTeam = form.watch('allowTeamRegistration');
  const submissionRequired = form.watch('submissionRequired');

  const createMutation = useApiMutation({
    mutationFn: (values: Values) =>
      api.post<Competition>('/competitions', {
        title: values.title,
        description: values.description || undefined,
        event: values.event,
        category: values.category || undefined,
        rules: values.rules || undefined,
        eligibility: values.eligibility || undefined,
        maxParticipants: values.maxParticipants || undefined,
        allowTeamRegistration: values.allowTeamRegistration,
        teamSize: values.allowTeamRegistration ? values.teamSize : undefined,
        registrationDeadline: values.registrationDeadline
          ? new Date(values.registrationDeadline).toISOString()
          : undefined,
        submissionRequired: values.submissionRequired,
        submissionDeadline: values.submissionDeadline
          ? new Date(values.submissionDeadline).toISOString()
          : undefined,
        fee: values.fee,
        feeType: values.feeType,
        venue: values.venue || undefined,
      }),
    invalidate: [['competitions']],
    successMessage: 'Competition created',
    onSuccess: () => {
      setOpen(false);
      form.reset(defaults);
    },
  });

  const columns: Column<Competition>[] = [
    {
      key: 'title',
      header: 'Competition',
      render: (row) => (
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-foreground">
            <Award className="h-4 w-4" />
          </span>
          <div>
            <Link href={`/dashboard/competitions/detail?id=${row._id}`} className="font-medium text-ink hover:text-primary">
              {row.title}
            </Link>
            <p className="text-[11px] text-muted-foreground">
              {typeof row.event === 'object' && row.event ? row.event.title : 'Event'}
              {row.category ? ` · ${row.category}` : ''}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'participants',
      header: 'Participants',
      render: (row) => (
        <div className="text-[12px]">
          <span className="font-medium tabular-nums text-ink">{row.stats?.registrations ?? row.registrations?.length ?? 0}</span>
          <span className="text-muted-foreground"> registered</span>
          {row.submissionRequired ? (
            <p className="text-[11px] text-muted-foreground">{row.stats?.submissions ?? 0} submissions</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'fee',
      header: 'Fee · Team',
      render: (row) => (
        <div className="text-[12px]">
          <p className="tabular-nums">{formatCurrency(row.fee)}</p>
          <p className="text-[11px] text-muted-foreground">
            {row.allowTeamRegistration ? `Teams of ${row.teamSize}` : 'Individual'}
          </p>
        </div>
      ),
    },
    {
      key: 'results',
      header: 'Results',
      render: (row) =>
        row.resultsPublished ? (
          <Badge variant="success"><Trophy className="h-3 w-3" /> Published</Badge>
        ) : (
          <span className="text-[11.5px] text-subtle-foreground">Not published</span>
        ),
    },
    {
      key: 'deadline',
      header: 'Deadline',
      render: (row) => (
        <span className="text-[12px] text-muted-foreground">
          {row.registrationDeadline ? formatDate(row.registrationDeadline) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/competitions/detail?id=${row._id}`}>
            Manage <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Events"
        title="Competitions"
        description="Judged contests with registrations, submissions, scores and published results."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New competition
            </Button>
          ) : null
        }
      />

      <div className="rounded-card border border-line bg-surface shadow-soft">
        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          rowKey={(row) => row._id}
          emptyIcon={Award}
          emptyTitle="No competitions yet"
          emptyDescription="Create a competition under an event to accept registrations and entries."
          emptyAction={
            canManage ? <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New competition</Button> : null
          }
        />
      </div>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="New competition"
        description="Competitions live inside an event and can require a submission."
        submitLabel="Create competition"
        submitting={createMutation.isPending}
        size="lg"
        onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Title" htmlFor="comp-title" required error={form.formState.errors.title?.message} className="sm:col-span-2">
            <Input id="comp-title" placeholder="Code Sprint 2026" invalid={Boolean(form.formState.errors.title)} {...form.register('title')} />
          </FormField>
          <FormField label="Parent event" htmlFor="comp-event" required error={form.formState.errors.event?.message}>
            <Controller
              control={form.control}
              name="event"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="comp-event" invalid={Boolean(form.formState.errors.event)}><SelectValue placeholder="Select event" /></SelectTrigger>
                  <SelectContent>
                    {(events ?? []).map((item) => (
                      <SelectItem key={item._id} value={item._id}>{item.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label="Category" htmlFor="comp-category" hint="Optional free-text group">
            <Input id="comp-category" placeholder="Programming" {...form.register('category')} />
          </FormField>
          <FormField label="Registration deadline" htmlFor="comp-deadline">
            <Input id="comp-deadline" type="date" {...form.register('registrationDeadline')} />
          </FormField>
          <FormField label="Fee (₹)" htmlFor="comp-fee" required>
            <Input id="comp-fee" type="number" min={0} max={100000} {...form.register('fee')} />
          </FormField>
          <FormField label="Fee basis" htmlFor="comp-feetype">
            <Controller
              control={form.control}
              name="feeType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="comp-feetype"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Per participant</SelectItem>
                    <SelectItem value="team">Per team</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label="Capacity" htmlFor="comp-capacity" hint="Empty = unlimited">
            <Input id="comp-capacity" type="number" min={0} placeholder="Unlimited" {...form.register('maxParticipants')} />
          </FormField>
          <FormField label="Venue" htmlFor="comp-venue">
            <Input id="comp-venue" placeholder="Computer Lab 2" {...form.register('venue')} />
          </FormField>
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface-subtle/50 px-3.5 py-2.5">
          <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
            <Controller
              control={form.control}
              name="allowTeamRegistration"
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
            />
            Team competition
          </label>
          {allowTeam ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-ink-soft">Team size</span>
              <Input type="number" min={1} max={20} className="h-8 w-20" {...form.register('teamSize')} />
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
            <Controller
              control={form.control}
              name="submissionRequired"
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
            />
            Requires a submission
          </label>
          {submissionRequired ? (
            <Input type="date" className="h-8 w-40" aria-label="Submission deadline" {...form.register('submissionDeadline')} />
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Rules" htmlFor="comp-rules">
            <Textarea id="comp-rules" rows={3} placeholder="Competition rules…" {...form.register('rules')} />
          </FormField>
          <FormField label="Eligibility" htmlFor="comp-eligibility">
            <Textarea id="comp-eligibility" rows={3} placeholder="Who can take part…" {...form.register('eligibility')} />
          </FormField>
        </div>
        <FormField label="Description" htmlFor="comp-description">
          <Textarea id="comp-description" rows={2} {...form.register('description')} />
        </FormField>
      </FormDialog>
    </div>
  );
}
