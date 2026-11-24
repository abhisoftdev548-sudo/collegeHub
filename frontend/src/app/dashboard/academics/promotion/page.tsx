'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  History,
  MinusCircle,
  UserX,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { FormField } from '@/components/shared/form-field';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getErrorMessage } from '@/lib/api';
import { formatDate, titleCase } from '@/lib/utils';
import type { AcademicSession, PromotionBatch, PromotionPreview } from '@/types/api';

const schema = z.object({
  fromSession: z.string().min(1, 'Select the session students are leaving'),
  toSession: z.string().min(1, 'Select the session students are moving into'),
});

type FormInput = z.input<typeof schema>;
type Values = z.output<typeof schema>;

const OUTCOME_ICON = {
  promoted: CheckCircle2,
  detained: MinusCircle,
  graduated: GraduationCap,
  skipped: AlertTriangle,
  excluded: UserX,
} as const;

const OUTCOME_TONE = {
  promoted: 'text-success',
  detained: 'text-warning',
  graduated: 'text-primary',
  skipped: 'text-subtle-foreground',
  excluded: 'text-danger',
} as const;

export default function PromotionPage() {
  const [preview, setPreview] = useState<PromotionPreview | null>(null);
  const [detainIds, setDetainIds] = useState<string[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdBatch, setCreatedBatch] = useState<PromotionBatch | null>(null);

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['academic-sessions'],
    queryFn: () => api.get<AcademicSession[]>('/academic/sessions'),
  });

  const { data: batches, isLoading: batchesLoading, refetch: refetchBatches } = useQuery({
    queryKey: ['promotion-batches'],
    queryFn: () => api.getPaginated<PromotionBatch>('/promotions', { params: { limit: 20 } }),
  });

  const form = useForm<FormInput, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: { fromSession: '', toSession: '' },
  });

  const fromSession = form.watch('fromSession');
  const toSession = form.watch('toSession');

  const studentNames = useMemo(
    () => new Map((preview?.students ?? []).map((student) => [student.id, student])),
    [preview],
  );

  const runPreview = form.handleSubmit(async (values) => {
    if (values.fromSession === values.toSession) {
      toast.error('The source and target sessions must differ');
      return;
    }
    setPreviewing(true);
    setDetainIds([]);
    setCreatedBatch(null);
    try {
      const data = await api.post<PromotionPreview>('/promotions/preview', {
        fromSession: values.fromSession,
        toSession: values.toSession,
        detainStudentIds: [],
      });
      setPreview(data);
      if (data.summary.total === 0) {
        toast.info('No eligible students were found for this promotion');
      }
    } catch (error) {
      setPreview(null);
      toast.error(getErrorMessage(error));
    } finally {
      setPreviewing(false);
    }
  });

  const createBatch = async () => {
    const values = form.getValues();
    setCreating(true);
    try {
      const result = await api.post<{ batch: PromotionBatch; preview: PromotionPreview }>('/promotions', {
        fromSession: values.fromSession,
        toSession: values.toSession,
        detainStudentIds: detainIds,
      });
      setCreatedBatch(result.batch);
      await refetchBatches();
      toast.success('Promotion batch prepared — review before approving');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const approveBatch = async (batchId: string) => {
    try {
      await api.post(`/promotions/${batchId}/approve`);
      toast.success('Promotion approved — student records updated');
      await refetchBatches();
      setPreview(null);
      setCreatedBatch(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const cancelBatch = async (batchId: string) => {
    try {
      await api.post(`/promotions/${batchId}/cancel`);
      toast.success('Promotion batch cancelled');
      await refetchBatches();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const toggleDetain = (studentId: string) =>
    setDetainIds((current) =>
      current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId],
    );

  const batchColumns: Column<PromotionBatch>[] = [
    {
      key: 'batch',
      header: 'Batch',
      render: (row) => (
        <div>
          <p className="font-medium text-ink">{row.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {row.fromSession?.name} → {row.toSession?.name}
          </p>
        </div>
      ),
    },
    {
      key: 'summary',
      header: 'Students',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant="success" size="sm">{row.summary.promoted} promoted</Badge>
          {row.summary.detained > 0 ? <Badge variant="warning" size="sm">{row.summary.detained} detained</Badge> : null}
          {row.summary.graduated > 0 ? <Badge variant="primary" size="sm">{row.summary.graduated} graduated</Badge> : null}
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <Badge variant={statusVariant(row.status)}>{titleCase(row.status)}</Badge> },
    {
      key: 'created',
      header: 'Prepared',
      render: (row) => <span className="text-[12px] text-muted-foreground">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) =>
        row.status === 'preview' ? (
          <div className="flex items-center justify-end gap-1.5">
            <ConfirmDialog
              trigger={<Button variant="ghost" size="sm"><XCircle className="h-3.5 w-3.5" /> Cancel</Button>}
              title="Cancel this promotion batch?"
              description="The batch is discarded without touching any student record."
              confirmLabel="Cancel batch"
              onConfirm={() => cancelBatch(row._id)}
            />
            <ConfirmDialog
              trigger={<Button size="sm"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</Button>}
              title="Approve this promotion batch?"
              description={`${row.summary.promoted} students will move to the next semester and ${row.summary.graduated} will graduate. Enrolment history is appended for every student and cannot be undone.`}
              confirmLabel="Approve promotion"
              destructive={false}
              onConfirm={() => approveBatch(row._id)}
            />
          </div>
        ) : (
          <span className="text-[11.5px] text-subtle-foreground">
            {row.approvedAt ? `Approved ${formatDate(row.approvedAt)}` : '—'}
          </span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Academics"
        title="Semester promotion"
        description="Promote a cohort through an authorised, reviewable batch. Student history is appended, never overwritten."
      />

      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-primary-soft-strong bg-primary-soft/50 px-4 py-3">
        <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          Promotion is a two-step workflow: <strong>preview</strong> computes what will happen for every student, then
          you <strong>approve</strong> the batch exactly once. Students held back are marked as detained and stay in
          their current semester.
        </p>
      </div>

      <SectionCard title="Prepare a promotion" description="Choose the sessions to move students between">
        {sessionsLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (sessions ?? []).length < 2 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="At least two academic sessions are needed"
            description="Create the next academic session first. Promotion always moves students from one session into the next."
            compact
          />
        ) : (
          <form onSubmit={runPreview} className="space-y-4" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="From session" htmlFor="from-session" required error={form.formState.errors.fromSession?.message}>
                <Controller
                  control={form.control}
                  name="fromSession"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="from-session" invalid={Boolean(form.formState.errors.fromSession)}>
                        <SelectValue placeholder="Current session" />
                      </SelectTrigger>
                      <SelectContent>
                        {(sessions ?? []).map((session) => (
                          <SelectItem key={session._id} value={session._id} disabled={session._id === toSession}>
                            {session.name}{session.isCurrent ? ' (current)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField label="To session" htmlFor="to-session" required error={form.formState.errors.toSession?.message}>
                <Controller
                  control={form.control}
                  name="toSession"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="to-session" invalid={Boolean(form.formState.errors.toSession)}>
                        <SelectValue placeholder="Next session" />
                      </SelectTrigger>
                      <SelectContent>
                        {(sessions ?? []).map((session) => (
                          <SelectItem key={session._id} value={session._id} disabled={session._id === fromSession}>
                            {session.name}{session.isCurrent ? ' (current)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            </div>
            <Button type="submit" loading={previewing} disabled={!fromSession || !toSession}>
              Preview promotion
            </Button>
          </form>
        )}
      </SectionCard>

      {preview ? (
        <div className="mt-4 space-y-4">
          <SectionCard
            title="Preview"
            description={`${preview.students.length} students evaluated · ${preview.summary.promoted} will be promoted`}
            action={<Badge variant="accent">Nothing saved yet</Badge>}
          >
            <div className="mb-4 grid gap-2.5 sm:grid-cols-5">
              {(
                [
                  { key: 'promoted', label: 'Promoted', icon: CheckCircle2 },
                  { key: 'graduated', label: 'Graduating', icon: GraduationCap },
                  { key: 'detained', label: 'Detained', icon: MinusCircle },
                  { key: 'skipped', label: 'Skipped', icon: AlertTriangle },
                  { key: 'excluded', label: 'Excluded', icon: UserX },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className="rounded-xl border border-line bg-surface-subtle/50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{item.label}</span>
                      <Icon className={`h-3.5 w-3.5 ${OUTCOME_TONE[item.key]}`} />
                    </div>
                    <p className="mt-1 font-display text-xl font-semibold text-ink">{preview.summary[item.key]}</p>
                  </div>
                );
              })}
            </div>

            {preview.items.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="No students to promote" description="No active students were found in the source session." compact />
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-xl border border-line">
                <ul className="divide-y divide-line">
                  {preview.items.map((item) => {
                    const student = studentNames.get(item.student);
                    const Icon = OUTCOME_ICON[item.outcome as keyof typeof OUTCOME_ICON] ?? AlertTriangle;
                    const detained = detainIds.includes(item.student);
                    return (
                      <li key={item.student} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-medium text-ink">
                            {student?.name ?? 'Student'} <span className="font-mono text-[11px] text-subtle-foreground">{student?.enrollmentNumber}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {titleCase(item.outcome)}
                            {item.reason ? ` · ${item.reason}` : ''}
                            {detained ? ' · will be marked detained' : ''}
                          </p>
                        </div>
                        {item.outcome === 'promoted' ? (
                          <button
                            type="button"
                            onClick={() => toggleDetain(item.student)}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              detained
                                ? 'border-warning/40 bg-warning-soft text-warning'
                                : 'border-line text-ink-soft hover:bg-surface-subtle'
                            }`}
                          >
                            {detained ? 'Detained' : 'Detain instead'}
                          </button>
                        ) : (
                          <Icon className={`h-4 w-4 shrink-0 ${OUTCOME_TONE[item.outcome as keyof typeof OUTCOME_TONE] ?? 'text-subtle-foreground'}`} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={() => void createBatch()} loading={creating}>
                Prepare batch for approval
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPreview(null);
                  setDetainIds([]);
                }}
              >
                Discard preview
              </Button>
              <p className="text-[11.5px] text-muted-foreground">
                Preparing a batch saves the plan but does not move any student until approved.
              </p>
            </div>
          </SectionCard>

          {createdBatch ? (
            <div className="rounded-xl border border-success/25 bg-success-soft px-4 py-3">
              <p className="text-[12.5px] font-medium text-success">
                Batch “{createdBatch.name}” prepared with {createdBatch.summary.promoted} promotions
                {createdBatch.summary.graduated > 0 ? ` and ${createdBatch.summary.graduated} graduations` : ''}.
              </p>
              <p className="mt-0.5 text-[11.5px] text-success/80">Approve it from the batches table below to apply the changes.</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6">
        <SectionCard
          title="Promotion batches"
          description="Every batch is kept for audit, with the students and outcomes it contained"
          padded={false}
          action={<History className="h-4 w-4 text-subtle-foreground" />}
        >
          <DataTable
            columns={batchColumns}
            rows={batches?.data}
            loading={batchesLoading}
            rowKey={(row) => row._id}
            emptyIcon={History}
            emptyTitle="No promotion batches yet"
            emptyDescription="Prepared batches appear here until you approve or cancel them."
          />
        </SectionCard>
      </div>
    </div>
  );
}
