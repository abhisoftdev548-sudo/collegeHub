'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  GraduationCap,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { FullPageLoader } from '@/components/shared/guards';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useApiMutation } from '@/components/shared/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { formatDate, initials, titleCase } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Student } from '@/types/api';

interface EnrollmentHistoryRow {
  _id: string;
  academicSession?: { name: string };
  semesterNumber?: number;
  semester?: { number: number; label?: string };
  section?: { name: string };
  event: string;
  status: string;
  effectiveFrom: string;
  notes?: string;
}

const StudentDetail = () => {
  const params = useSearchParams();
  const id = params.get('id');
  const { hasPermission } = useAuth();
  const canManage = hasPermission('student:update');
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  const { data: student, isLoading, error, refetch } = useQuery({
    queryKey: ['student', id],
    queryFn: () => api.get<Student>(`/students/${id}`),
    enabled: Boolean(id),
  });

  const { data: history } = useQuery({
    queryKey: ['student-history', id],
    queryFn: () => api.get<EnrollmentHistoryRow[]>(`/students/${id}/history`),
    enabled: Boolean(id),
  });

  const resetMutation = useApiMutation({
    mutationFn: () => api.post<{ temporaryPassword: string }>(`/students/${id}/reset-password`),
    successMessage: 'Password reset',
    onSuccess: (data) => setTemporaryPassword(data.temporaryPassword),
  });

  const statusMutation = useApiMutation({
    mutationFn: (status: string) => api.patch(`/students/${id}/status`, { status }),
    invalidate: [['student', id as string], ['students']],
    successMessage: 'Student status updated',
  });

  if (!id) return <EmptyState title="Student not found" description="No student reference was provided." />;
  if (isLoading) return <FullPageLoader label="Loading student record…" />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!student) return null;

  const status = student.status;

  return (
    <div>
      <Link
        href="/dashboard/students"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All students
      </Link>

      <div className="mb-6 flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-soft sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary text-base text-white">{initials(student.user?.name)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight text-ink">{student.user?.name}</h1>
            <p className="mt-0.5 font-mono text-[12px] text-muted-foreground">{student.enrollmentNumber}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant={statusVariant(status)}>{titleCase(status)}</Badge>
              {student.course ? <Badge variant="neutral">{student.course.code}</Badge> : null}
              {student.semester ? <Badge variant="neutral">Semester {student.semester.number}</Badge> : null}
              {student.section ? <Badge variant="primary">Section {student.section.name}</Badge> : null}
              {(student.user?.responsibilities ?? []).some((item) => item.type === 'cr') ? (
                <Badge variant="accent">Class representative</Badge>
              ) : null}
              {(student.user?.responsibilities ?? []).some((item) => item.type === 'volunteer') ? (
                <Badge variant="accent">Volunteer</Badge>
              ) : null}
            </div>
          </div>
        </div>

        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm">
                  <KeyRound className="h-3.5 w-3.5" /> Reset password
                </Button>
              }
              title="Reset this student's password?"
              description="A temporary password will be generated. The student must change it after signing in."
              confirmLabel="Reset password"
              destructive={false}
              onConfirm={() => resetMutation.mutateAsync()}
            />
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {status === 'active' ? 'Suspend' : 'Reactivate'}
                </Button>
              }
              title={status === 'active' ? 'Suspend this student?' : 'Reactivate this student?'}
              description={
                status === 'active'
                  ? 'The account can no longer sign in. Academic records and history are preserved.'
                  : 'The student regains access to their account with existing records.'
              }
              confirmLabel={status === 'active' ? 'Suspend' : 'Reactivate'}
              destructive={status === 'active'}
              onConfirm={() => statusMutation.mutateAsync(status === 'active' ? 'suspended' : 'active')}
            />
          </div>
        ) : null}
      </div>

      {temporaryPassword ? (
        <div className="mb-4 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3">
          <p className="text-[12px] font-medium text-warning">Temporary password (shown once)</p>
          <p className="mt-1 font-mono text-[13px] font-semibold text-ink">{temporaryPassword}</p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Personal details" description="Contact and identity information">
          <dl className="space-y-3 text-[12.5px]">
            {[
              { icon: Mail, label: 'Email', value: student.user?.email },
              { icon: Phone, label: 'Phone', value: student.user?.phone || student.guardianPhone || '—' },
              { icon: UserRound, label: 'Guardian', value: student.guardianName || '—' },
              { icon: CalendarDays, label: 'Date of birth', value: student.dateOfBirth ? formatDate(student.dateOfBirth) : '—' },
              { icon: MapPin, label: 'Address', value: student.address || '—' },
            ].map((row) => (
              <div key={row.label} className="flex items-start gap-2.5">
                <row.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle-foreground" />
                <div className="min-w-0">
                  <dt className="text-[10.5px] uppercase tracking-wide text-subtle-foreground">{row.label}</dt>
                  <dd className="break-words text-ink">{row.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </SectionCard>

        <SectionCard title="Academic placement" description="Current course and class">
          <dl className="space-y-3 text-[12.5px]">
            {[
              { icon: GraduationCap, label: 'Course', value: student.course?.name ?? '—' },
              { icon: BookOpen, label: 'Semester', value: student.semester ? `Semester ${student.semester.number}` : '—' },
              { icon: UserRound, label: 'Section', value: student.section?.name ?? '—' },
              { icon: CalendarDays, label: 'Session', value: student.academicSession?.name ?? '—' },
              { icon: CalendarDays, label: 'Admission year', value: String(student.admissionYear ?? '—') },
            ].map((row) => (
              <div key={row.label} className="flex items-start gap-2.5">
                <row.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle-foreground" />
                <div className="min-w-0">
                  <dt className="text-[10.5px] uppercase tracking-wide text-subtle-foreground">{row.label}</dt>
                  <dd className="text-ink">{row.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </SectionCard>

        <SectionCard title="Enrolment history" description="Append-only academic record" padded={false}>
          {!history || history.length === 0 ? (
            <div className="p-5 pt-0">
              <EmptyState icon={CalendarDays} title="No history yet" compact />
            </div>
          ) : (
            <ol className="relative m-5 mt-0 space-y-4 border-l border-line pl-4">
              {history.map((entry) => (
                <li key={entry._id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary ring-4 ring-surface" />
                  <p className="text-[12.5px] font-medium text-ink">
                    {entry.event === 'admission' ? 'Admitted' : titleCase(entry.event)}
                    {entry.semesterNumber ? ` · Semester ${entry.semesterNumber}` : entry.semester?.number ? ` · Semester ${entry.semester.number}` : ''}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {entry.academicSession?.name ?? '—'} · Section {entry.section?.name ?? '—'}
                  </p>
                  <p className="text-[10.5px] text-subtle-foreground">
                    {formatDate(entry.effectiveFrom)} · {titleCase(entry.status)}
                    {entry.notes ? ` · ${entry.notes}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>
    </div>
  );
};

export default function StudentDetailPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <StudentDetail />
    </Suspense>
  );
}
