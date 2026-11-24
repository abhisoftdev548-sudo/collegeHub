'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ClipboardCheck, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { TeacherOverview } from '@/types/api';

export default function MySubjectsPage() {
  const [selectedDept, setSelectedDept] = useState<string>('all');

  const overviewQuery = useQuery({
    queryKey: ['teacher-overview'],
    queryFn: () => api.get<TeacherOverview>('/teachers/me/overview'),
  });

  const assignments = overviewQuery.data?.assignments ?? [];
  const departments = overviewQuery.data?.departments ?? [];
  const visible = selectedDept === 'all'
    ? assignments
    : assignments.filter((assignment) => {
        const department = typeof assignment.department === 'object' ? assignment.department : null;
        return department?._id === selectedDept;
      });

  // Group by subject+section so each row is one class the teacher takes.
  const classes = visible.reduce<Record<string, { subject: string; code: string; section: string; semester: string; students: string[] }>>(
    (acc, assignment) => {
      const key = `${assignment.subject?._id ?? assignment.subject?.name}-${assignment.section?._id ?? assignment.section?.name}`;
      const bucket = (acc[key] ??= {
        subject: assignment.subject?.name ?? 'Subject',
        code: assignment.subject?.code ?? '',
        section: assignment.section?.name ?? '—',
        semester: assignment.section?.semester?.label ?? '',
        students: [],
      });
      if (assignment.section?._id && !bucket.students.includes(assignment.section._id)) {
        bucket.students.push(assignment.section._id);
      }
      return acc;
    },
    {},
  );

  return (
    <div>
      <PageHeader
        eyebrow="Academics"
        title="My subjects"
        description="The subjects and sections you teach this session."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/attendance">Mark attendance</Link>
          </Button>
        }
      />

      {departments.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedDept('all')}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
              selectedDept === 'all' ? 'bg-primary text-white' : 'border border-line bg-surface text-ink-soft hover:bg-surface-subtle'
            }`}
          >
            All departments
          </button>
          {departments.map((department) => (
            <button
              key={department._id}
              type="button"
              onClick={() => setSelectedDept(department._id)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                selectedDept === department._id ? 'bg-primary text-white' : 'border border-line bg-surface text-ink-soft hover:bg-surface-subtle'
              }`}
            >
              {department.name}
            </button>
          ))}
        </div>
      ) : null}

      {overviewQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <CardSkeleton key={index} className="h-32" />
          ))}
        </div>
      ) : overviewQuery.error ? (
        <ErrorState error={overviewQuery.error} onRetry={() => void overviewQuery.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No subjects assigned"
          description="Your teaching assignments have not been set up yet. Contact the academic office if this looks wrong."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(classes).map(([key, item]) => (
            <div key={key} className="flex flex-col rounded-card border border-line bg-surface p-4 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-[14px] font-semibold leading-snug text-ink">{item.subject}</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {item.code ? `${item.code} · ` : ''}Section {item.section}
                    {item.semester ? ` · ${item.semester}` : ''}
                  </p>
                </div>
                <Badge variant="primary" size="sm">Active</Badge>
              </div>
              <div className="mt-3 flex gap-3 text-[11.5px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {overviewQuery.data?.studentCount ?? 0} students
                </span>
                <span className="flex items-center gap-1">
                  <ClipboardCheck className="h-3 w-3" /> Attendance
                </span>
              </div>
              <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
                <Link href="/dashboard/attendance">Open attendance</Link>
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        <SectionCard title="Teaching load" description="Every assignment recorded for you">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-line text-[10.5px] uppercase tracking-wide text-subtle-foreground">
                  <th className="py-1.5 pr-3 font-medium">Subject</th>
                  <th className="py-1.5 pr-3 font-medium">Section</th>
                  <th className="py-1.5 font-medium">Semester</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {assignments.map((assignment) => (
                  <tr key={assignment._id}>
                    <td className="py-2 pr-3 text-ink">
                      {assignment.subject?.name ?? '—'}
                      {assignment.subject?.code ? <span className="ml-1 text-subtle-foreground">({assignment.subject.code})</span> : null}
                    </td>
                    <td className="py-2 pr-3 text-ink-soft">{assignment.section?.name ?? '—'}</td>
                    <td className="py-2 text-ink-soft">{assignment.section?.semester?.label ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
