'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Award, CheckCircle2, FileText, Medal, Star, Trophy, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { FullPageLoader } from '@/components/shared/guards';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { FormDialog } from '@/components/shared/form-dialog';
import { FormField } from '@/components/shared/form-field';
import { useApiMutation } from '@/components/shared/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, getErrorMessage } from '@/lib/api';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';
import type { Competition, CompetitionSubmission, Registration } from '@/types/api';

interface ResultRow {
  _id: string;
  position: 'first' | 'second' | 'third' | 'special_mention';
  displayName: string;
  notes?: string;
}

const POSITION_LABEL: Record<ResultRow['position'], string> = {
  first: 'First place',
  second: 'Second place',
  third: 'Third place',
  special_mention: 'Special mention',
};

const POSITION_VARIANT = {
  first: 'accent',
  second: 'neutral',
  third: 'neutral',
  special_mention: 'primary',
} as const;

const CompetitionDetail = () => {
  const params = useSearchParams();
  const id = params.get('id');

  const [resultOpen, setResultOpen] = useState(false);
  const [resultForm, setResultForm] = useState<{ position: ResultRow['position']; displayName: string; notes: string; participant: string }>({
    position: 'first',
    displayName: '',
    notes: '',
    participant: '',
  });
  const [reviewing, setReviewing] = useState<CompetitionSubmission | null>(null);
  const [reviewForm, setReviewForm] = useState({ status: 'accepted', score: '', reviewNotes: '' });

  const { data: competition, isLoading, error, refetch } = useQuery({
    queryKey: ['competition', id],
    queryFn: () => api.get<Competition>(`/competitions/${id}`),
    enabled: Boolean(id),
  });

  const refresh = async () => {
    await refetch();
  };

  const reviewMutation = useApiMutation({
    mutationFn: (payload: { submissionId: string; status: string; score?: number; reviewNotes?: string }) =>
      api.patch(`/competitions/submissions/${payload.submissionId}/review`, {
        status: payload.status,
        score: payload.score,
        reviewNotes: payload.reviewNotes,
      }),
    successMessage: 'Submission reviewed',
    onSuccess: async () => {
      setReviewing(null);
      await refresh();
    },
  });

  const publishMutation = useApiMutation({
    mutationFn: () => api.post(`/competitions/${id}/publish`),
    successMessage: 'Results published — participants have been notified',
    onSuccess: () => void refresh(),
  });

  const addResult = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resultForm.displayName.trim()) {
      toast.error('Enter the winner name');
      return;
    }
    try {
      await api.post(`/competitions/${id}/results`, {
        position: resultForm.position,
        displayName: resultForm.displayName.trim(),
        notes: resultForm.notes.trim() || undefined,
        participant: resultForm.participant || undefined,
      });
      toast.success('Result added');
      setResultOpen(false);
      setResultForm({ position: 'first', displayName: '', notes: '', participant: '' });
      await refresh();
    } catch (resultError) {
      toast.error(getErrorMessage(resultError));
    }
  };

  if (!id) return <EmptyState title="Competition not found" description="No competition reference was provided." />;
  if (isLoading) return <FullPageLoader label="Loading competition…" />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!competition) return null;

  const registrations = competition.registrations ?? [];
  const submissions = competition.submissions ?? [];
  const results = (competition.results ?? []) as unknown as ResultRow[];

  const registrationColumns: Column<Registration & { _id: string; student?: { _id?: string; name?: string; email?: string } }>[] = [
    {
      key: 'student',
      header: 'Participant',
      render: (row) => (
        <div>
          <p className="font-medium text-ink">
            {typeof row.student === 'object' ? row.student?.name ?? 'Student' : 'Student'}
          </p>
          {row.teamName ? <p className="text-[11px] text-muted-foreground">Team {row.teamName}</p> : null}
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <Badge variant={statusVariant(row.status)}>{titleCase(row.status)}</Badge> },
    {
      key: 'payment',
      header: 'Payment',
      render: (row) => <Badge variant={statusVariant(row.paymentStatus)} size="sm">{titleCase(row.paymentStatus)}</Badge>,
    },
    { key: 'submitted', header: 'Registered', render: (row) => <span className="text-[12px] text-muted-foreground">{formatDate(row.submittedAt)}</span> },
  ];

  const submissionColumns: Column<CompetitionSubmission>[] = [
    {
      key: 'title',
      header: 'Submission',
      render: (row) => (
        <div>
          <p className="font-medium text-ink">{row.title ?? 'Untitled entry'}</p>
          <p className="text-[11px] text-muted-foreground">
            {typeof row.submittedBy === 'object' && row.submittedBy ? row.submittedBy.name : 'Student'} ·{' '}
            {formatDate(row.submittedAt)}
          </p>
        </div>
      ),
    },
    {
      key: 'links',
      header: 'Links',
      render: (row) =>
        row.fileUrl || (row.links?.length ?? 0) > 0 ? (
          <div className="space-y-0.5">
            {row.fileUrl ? (
              <a href={row.fileUrl} target="_blank" rel="noreferrer" className="block truncate text-[12px] text-primary hover:underline">
                Attached file
              </a>
            ) : null}
            {(row.links ?? []).map((link) => (
              <a key={link} href={link} target="_blank" rel="noreferrer" className="block max-w-[220px] truncate text-[12px] text-primary hover:underline">
                {link}
              </a>
            ))}
          </div>
        ) : (
          <span className="text-[11.5px] text-subtle-foreground">No links</span>
        ),
    },
    { key: 'status', header: 'Status', render: (row) => <Badge variant={statusVariant(row.status)}>{titleCase(row.status)}</Badge> },
    {
      key: 'score',
      header: 'Score',
      render: (row) => (
        <span className="tabular-nums font-medium text-ink">{row.score !== undefined && row.score !== null ? `${row.score}/100` : '—'}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setReviewing(row);
            setReviewForm({
              status: row.status === 'accepted' ? 'accepted' : 'under_review',
              score: row.score !== undefined && row.score !== null ? String(row.score) : '',
              reviewNotes: row.reviewNotes ?? '',
            });
          }}
        >
          Review
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Link href="/dashboard/competitions" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> All competitions
      </Link>

      <PageHeader
        eyebrow={typeof competition.event === 'object' && competition.event ? competition.event.title : 'Competition'}
        title={competition.title}
        description={competition.description}
        actions={
          competition.resultsPublished ? (
            <Badge variant="success"><Trophy className="h-3 w-3" /> Results published</Badge>
          ) : (
            <ConfirmDialog
              trigger={
                <Button size="sm" disabled={results.length === 0}>
                  <Trophy className="h-4 w-4" /> Publish results
                </Button>
              }
              title="Publish results?"
              description="Results become visible to all participants and a notification is sent. This cannot be reversed."
              confirmLabel="Publish results"
              destructive={false}
              onConfirm={() => publishMutation.mutateAsync()}
            />
          )
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Registrations', value: registrations.length, icon: Users },
          { label: 'Submissions', value: submissions.length, icon: FileText },
          { label: 'Fee', value: formatCurrency(competition.fee), icon: Award },
          { label: 'Results', value: results.length, icon: Medal },
        ].map((card) => (
          <div key={card.label} className="rounded-card border border-line bg-surface p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] text-muted-foreground">{card.label}</span>
              <card.icon className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="mt-1.5 font-display text-xl font-semibold text-ink">{card.value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="registrations">
        <TabsList>
          <TabsTrigger value="registrations">Registrations</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="registrations">
          <SectionCard title="Participants" description="Students registered for this competition" padded={false}>
            <DataTable
              columns={registrationColumns as unknown as Column<Registration>[]}
              rows={registrations as unknown as Registration[]}
              rowKey={(row) => row._id}
              emptyIcon={Users}
              emptyTitle="No registrations yet"
              emptyDescription="Participants appear here when students register through their portal."
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="submissions">
          <SectionCard
            title="Submissions"
            description="Entries submitted by participants, scored by judges"
            padded={false}
            action={
              <Button
                variant="outline"
                size="sm"
                disabled
                title="Participants submit from their own portal"
              >
                {competition.submissionRequired ? 'Submission required' : 'Optional'}
              </Button>
            }
          >
            <DataTable
              columns={submissionColumns}
              rows={submissions}
              rowKey={(row) => row._id}
              emptyIcon={FileText}
              emptyTitle="No submissions yet"
              emptyDescription="Participants submit links or files from their student portal."
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="results">
          <SectionCard
            title="Results"
            description="Declare winners, then publish to notify participants"
            padded={false}
            action={
              <Button size="sm" variant="outline" onClick={() => setResultOpen(true)} disabled={competition.resultsPublished}>
                <Trophy className="h-3.5 w-3.5" /> Add result
              </Button>
            }
          >
            {results.length === 0 ? (
              <div className="p-5 pt-0">
                <EmptyState icon={Trophy} title="No results declared" description="Add winners in order before publishing." compact />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {results.map((result) => (
                  <li key={result._id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent-foreground">
                        <Star className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[13px] font-medium text-ink">{result.displayName}</p>
                        <p className="text-[11.5px] text-muted-foreground">{POSITION_LABEL[result.position]}{result.notes ? ` · ${result.notes}` : ''}</p>
                      </div>
                    </div>
                    <Badge variant={POSITION_VARIANT[result.position]}>{POSITION_LABEL[result.position]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      <FormDialog
        open={resultOpen}
        onOpenChange={setResultOpen}
        title="Declare a result"
        description="Results are visible to participants only after publishing."
        submitLabel="Add result"
        onSubmit={addResult}
        size="sm"
      >
        <FormField label="Position" htmlFor="result-position" required>
          <Select
            value={resultForm.position}
            onValueChange={(value) => setResultForm((current) => ({ ...current, position: value as ResultRow['position'] }))}
          >
            <SelectTrigger id="result-position"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(POSITION_LABEL) as ResultRow['position'][]).map((position) => (
                <SelectItem key={position} value={position}>{POSITION_LABEL[position]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Winner name" htmlFor="result-name" required hint="Use the individual or team name as it should appear publicly">
          <Input
            id="result-name"
            value={resultForm.displayName}
            onChange={(changeEvent) => setResultForm((current) => ({ ...current, displayName: changeEvent.target.value }))}
            placeholder="Team Bytecode"
          />
        </FormField>
        <FormField label="Notes" htmlFor="result-notes">
          <Textarea
            id="result-notes"
            rows={2}
            value={resultForm.notes}
            onChange={(changeEvent) => setResultForm((current) => ({ ...current, notes: changeEvent.target.value }))}
            placeholder="Optional note shown with the result"
          />
        </FormField>
      </FormDialog>

      <FormDialog
        open={Boolean(reviewing)}
        onOpenChange={(value) => {
          if (!value) setReviewing(null);
        }}
        title="Review submission"
        description={reviewing?.title ?? 'Score this entry'}
        submitLabel="Save review"
        submitting={reviewMutation.isPending}
        onSubmit={(event) => {
          event.preventDefault();
          if (!reviewing) return;
          reviewMutation.mutate({
            submissionId: reviewing._id,
            status: reviewForm.status,
            score: reviewForm.score ? Number(reviewForm.score) : undefined,
            reviewNotes: reviewForm.reviewNotes || undefined,
          });
        }}
      >
        <FormField label="Decision" htmlFor="review-status" required>
          <Select value={reviewForm.status} onValueChange={(value) => setReviewForm((current) => ({ ...current, status: value }))}>
            <SelectTrigger id="review-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="under_review">Under review</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Score (out of 100)" htmlFor="review-score">
          <Input
            id="review-score"
            type="number"
            min={0}
            max={100}
            value={reviewForm.score}
            onChange={(changeEvent) => setReviewForm((current) => ({ ...current, score: changeEvent.target.value }))}
          />
        </FormField>
        <FormField label="Review notes" htmlFor="review-notes">
          <Textarea
            id="review-notes"
            rows={3}
            value={reviewForm.reviewNotes}
            onChange={(changeEvent) => setReviewForm((current) => ({ ...current, reviewNotes: changeEvent.target.value }))}
          />
        </FormField>
      </FormDialog>
    </div>
  );
};

export default function CompetitionDetailPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <CompetitionDetail />
    </Suspense>
  );
}
