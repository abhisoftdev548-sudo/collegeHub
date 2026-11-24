'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarRange, CheckCircle2, Pencil, Plus, Star } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { FormField } from '@/components/shared/form-field';
import { FormDialog } from '@/components/shared/form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useApiMutation } from '@/components/shared/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Badge, statusVariant } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatDate, titleCase, toDateInputValue } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { AcademicSession } from '@/types/api';

const schema = z.object({
  name: z.string().trim().min(4, 'Enter a session name like 2025-26').max(40),
  startDate: z.string().min(1, 'Select a start date'),
  endDate: z.string().min(1, 'Select an end date'),
  status: z.enum(['upcoming', 'active', 'completed', 'archived']),
  notes: z.string().trim().max(1000).optional(),
});

type FormInput = z.input<typeof schema>;
type Values = z.output<typeof schema>;

const today = new Date();
const defaults: FormInput = {
  name: `${today.getFullYear()}-${String((today.getFullYear() + 1) % 100).padStart(2, '0')}`,
  startDate: `${today.getFullYear()}-07-01`,
  endDate: `${today.getFullYear() + 1}-06-30`,
  status: 'upcoming',
  notes: '',
};

export default function SessionsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('session:manage');
  const [editing, setEditing] = useState<AcademicSession | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['academic-sessions'],
    queryFn: () => api.get<AcademicSession[]>('/academic/sessions'),
  });

  const form = useForm<FormInput, unknown, Values>({ resolver: zodResolver(schema), defaultValues: defaults });

  const saveMutation = useApiMutation({
    mutationFn: (values: Values) => {
      const payload = {
        name: values.name,
        startDate: values.startDate,
        endDate: values.endDate,
        status: values.status,
        notes: values.notes || undefined,
      };
      return editing
        ? api.patch<AcademicSession>(`/academic/sessions/${editing._id}`, payload)
        : api.post<AcademicSession>('/academic/sessions', payload);
    },
    invalidate: [['academic-sessions'], ['dashboard']],
    successMessage: editing ? 'Academic session updated' : 'Academic session created',
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      form.reset(defaults);
    },
  });

  const currentMutation = useApiMutation({
    mutationFn: (id: string) => api.post(`/academic/sessions/${id}/current`),
    invalidate: [['academic-sessions'], ['dashboard'], ['sections'], ['students']],
    successMessage: 'Current academic session updated',
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(defaults);
    setOpen(true);
  };

  const openEdit = (session: AcademicSession) => {
    setEditing(session);
    form.reset({
      name: session.name,
      startDate: toDateInputValue(session.startDate),
      endDate: toDateInputValue(session.endDate),
      status: session.status,
      notes: session.notes ?? '',
    });
    setOpen(true);
  };

  const columns: Column<AcademicSession>[] = [
    {
      key: 'name',
      header: 'Session',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary-hover">
            <CalendarRange className="h-4 w-4" />
          </span>
          <div>
            <p className="flex items-center gap-1.5 font-medium text-ink">
              {row.name}
              {row.isCurrent ? <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-label="Current session" /> : null}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {formatDate(row.startDate)} – {formatDate(row.endDate)}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <Badge variant={statusVariant(row.status)}>{titleCase(row.status)}</Badge> },
    { key: 'notes', header: 'Notes', render: (row) => <span className="line-clamp-1 text-[12px] text-muted-foreground">{row.notes ?? '—'}</span> },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (row: AcademicSession) => (
              <div className="flex items-center justify-end gap-1">
                {!row.isCurrent ? (
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" size="sm">
                        <Star className="h-3.5 w-3.5" /> Set current
                      </Button>
                    }
                    title={`Make ${row.name} the current session?`}
                    description="New enrolments and sections default to this session. Existing records keep their original session."
                    confirmLabel="Set as current"
                    destructive={false}
                    onConfirm={() => currentMutation.mutateAsync(row._id)}
                  />
                ) : (
                  <Badge variant="success" size="sm">Current</Badge>
                )}
                <Button variant="ghost" size="sm" onClick={() => openEdit(row)} aria-label={`Edit ${row.name}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          } satisfies Column<AcademicSession>,
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Academics"
        title="Academic sessions"
        description="Each admission year runs as a session. Promotions move students between sessions."
        actions={canManage ? <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> New session</Button> : null}
      />

      <div className="rounded-card border border-line bg-surface shadow-soft">
        <DataTable
          columns={columns}
          rows={data}
          loading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          rowKey={(row) => row._id}
          emptyIcon={CalendarRange}
          emptyTitle="No academic sessions"
          emptyDescription="Create a session (for example 2025-26) before adding sections and students."
          emptyAction={canManage ? <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> New session</Button> : null}
        />
      </div>

      <FormDialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setEditing(null);
        }}
        title={editing ? 'Edit session' : 'New academic session'}
        description="Session dates drive the academic calendar."
        submitLabel={editing ? 'Save changes' : 'Create session'}
        submitting={saveMutation.isPending}
        onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
      >
        <FormField label="Session name" htmlFor="session-name" required error={form.formState.errors.name?.message} hint="Example: 2025-26">
          <Input id="session-name" placeholder="2025-26" invalid={Boolean(form.formState.errors.name)} {...form.register('name')} />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Start date" htmlFor="session-start" required error={form.formState.errors.startDate?.message}>
            <Input id="session-start" type="date" invalid={Boolean(form.formState.errors.startDate)} {...form.register('startDate')} />
          </FormField>
          <FormField label="End date" htmlFor="session-end" required error={form.formState.errors.endDate?.message}>
            <Input id="session-end" type="date" invalid={Boolean(form.formState.errors.endDate)} {...form.register('endDate')} />
          </FormField>
        </div>
        <FormField label="Status" htmlFor="session-status" required>
          <select
            id="session-status"
            className="flex h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
            {...form.register('status')}
          >
            {(['upcoming', 'active', 'completed', 'archived'] as const).map((status) => (
              <option key={status} value={status}>{titleCase(status)}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Notes" htmlFor="session-notes" hint="Optional internal note">
          <Textarea id="session-notes" {...form.register('notes')} />
        </FormField>
      </FormDialog>
    </div>
  );
}
