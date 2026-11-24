'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, ClipboardCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CardSkeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatDate, titleCase } from '@/lib/utils';

interface AttendanceEntry {
  subject: { name?: string; code?: string } | null;
  date: string;
  status: string;
  remarks?: string;
}

interface MyAttendanceResponse {
  entries: AttendanceEntry[];
  summary: { present: number; late: number; absent: number; total: number; percentage: number };
}

export default function MyAttendancePage() {
  const attendanceQuery = useQuery({
    queryKey: ['my-attendance'],
    queryFn: () => api.get<MyAttendanceResponse>('/attendance/me'),
  });

  const entries = attendanceQuery.data?.entries ?? [];
  const summary = attendanceQuery.data?.summary;

  // Subject-wise rollup computed from the class sheet entries.
  const bySubject = Object.values(
    entries.reduce<Record<string, { subject: string; present: number; late: number; total: number }>>((acc, entry) => {
      const key = entry.subject?.name ?? 'Unassigned subject';
      const bucket = (acc[key] ??= { subject: key, present: 0, late: 0, total: 0 });
      bucket.total += 1;
      if (entry.status === 'present') bucket.present += 1;
      if (entry.status === 'late') bucket.late += 1;
      return acc;
    }, {}),
  ).map((bucket) => ({
    ...bucket,
    percentage: bucket.total ? Math.round(((bucket.present + bucket.late) / bucket.total) * 1000) / 10 : 0,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="My attendance"
        description="Subject-wise attendance for the current semester. Below 75% may affect exam eligibility."
      />

      {attendanceQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : attendanceQuery.error ? (
        <ErrorState error={attendanceQuery.error} onRetry={() => void attendanceQuery.refetch()} />
      ) : !summary || summary.total === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No attendance recorded yet"
          description="Attendance appears after your faculty mark a class."
        />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-card border border-line bg-surface p-4 shadow-soft">
              <p className="text-[11.5px] text-muted-foreground">Overall</p>
              <p className={`mt-1 font-display text-xl font-semibold ${summary.percentage >= 75 ? 'text-success' : 'text-warning'}`}>
                {summary.percentage}%
              </p>
              <p className="mt-1 text-[11px] text-subtle-foreground">{summary.total} classes marked</p>
            </div>
            <div className="rounded-card border border-line bg-surface p-4 shadow-soft">
              <p className="text-[11.5px] text-muted-foreground">Present</p>
              <p className="mt-1 font-display text-xl font-semibold text-ink">{summary.present}</p>
              <Badge variant="success" size="sm" className="mt-1">classes</Badge>
            </div>
            <div className="rounded-card border border-line bg-surface p-4 shadow-soft">
              <p className="text-[11.5px] text-muted-foreground">Late</p>
              <p className="mt-1 font-display text-xl font-semibold text-ink">{summary.late}</p>
              <Badge variant="warning" size="sm" className="mt-1">classes</Badge>
            </div>
            <div className="rounded-card border border-line bg-surface p-4 shadow-soft">
              <p className="text-[11.5px] text-muted-foreground">Absent</p>
              <p className="mt-1 font-display text-xl font-semibold text-ink">{summary.absent}</p>
              <Badge variant="danger" size="sm" className="mt-1">classes</Badge>
            </div>
          </div>

          {summary.percentage < 75 ? (
            <p className="mb-4 rounded-xl border border-warning/25 bg-warning-soft px-3.5 py-2.5 text-[12px] leading-relaxed text-warning">
              Your attendance is below the 75% requirement. Speak to your coordinator about condonation or extra classes.
            </p>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="By subject" description="Attendance percentage per subject">
              <ul className="space-y-3.5">
                {bySubject.map((bucket) => (
                  <li key={bucket.subject}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-[12.5px] font-medium text-ink">{bucket.subject}</span>
                      <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
                        {bucket.percentage}% · {bucket.present + bucket.late}/{bucket.total}
                      </span>
                    </div>
                    <Progress
                      value={bucket.percentage}
                      className="h-1.5"
                      indicatorClassName={bucket.percentage >= 75 ? 'bg-success' : bucket.percentage >= 50 ? 'bg-warning' : 'bg-danger'}
                    />
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Recent classes" description="Latest marked sessions" padded={false}>
              <ul className="max-h-[340px] divide-y divide-line overflow-y-auto">
                {entries.slice(0, 30).map((entry, index) => (
                  <li key={`${entry.date}-${entry.subject?.code ?? index}`} className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-medium text-ink">{entry.subject?.name ?? 'Class'}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(entry.date)}
                        {entry.subject?.code ? ` · ${entry.subject.code}` : ''}
                      </p>
                      {entry.remarks ? <p className="mt-0.5 text-[11px] italic text-subtle-foreground">{entry.remarks}</p> : null}
                    </div>
                    <Badge variant={statusVariant(entry.status)} size="sm">{titleCase(entry.status)}</Badge>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>
        </>
      )}

      <div className="mt-4 rounded-card border border-line bg-surface p-4 shadow-soft">
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
          <CalendarCheck className="h-3.5 w-3.5 text-primary" /> Event check-ins
        </p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
          Event check-ins are recorded separately from academic attendance. See them under “My registrations”.
        </p>
      </div>
    </div>
  );
}
