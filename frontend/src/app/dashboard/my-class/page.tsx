'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Download, Megaphone, Users2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PersonCell } from '@/components/shared/person-cell';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { CardSkeleton } from '@/components/ui/skeleton';
import { api, getErrorMessage } from '@/lib/api';
import { formatDate, titleCase } from '@/lib/utils';
import type { Announcement, CRDashboard } from '@/types/api';

interface HistorySheet {
  _id: string;
  date: string;
  dateKey?: string;
  subject?: { _id: string; name: string; code?: string };
  records: Array<{ student: string; status: string; remarks?: string }>;
}

interface RosterStudent {
  studentId: string;
  name: string;
  email: string;
  enrollmentNumber: string;
  rollNumber?: string;
}

export default function MyClassPage() {
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  const dashboardQuery = useQuery({
    queryKey: ['my-class-dashboard'],
    queryFn: () => api.get<CRDashboard>('/dashboard'),
  });

  const section = dashboardQuery.data?.section ?? null;
  const classmates = dashboardQuery.data?.classmates ?? [];

  const rosterQuery = useQuery({
    queryKey: ['class-roster', section?._id],
    queryFn: () => api.get<{ students: RosterStudent[] }>('/attendance/roster', { params: { section: section?._id } }),
    enabled: Boolean(section?._id),
  });

  /**
   * The numeric report endpoint is student-scoped by role, so a CR (role:
   * student) gets their own attendance only. Class tallies are derived from
   * the section's marked sheets instead — the same data teachers see.
   */
  const historyQuery = useQuery({
    queryKey: ['class-attendance-history', section?._id],
    queryFn: () =>
      api.getPaginated<HistorySheet>('/attendance/history', {
        params: { section: section?._id, limit: 100 },
      }),
    enabled: Boolean(section?._id),
  });

  const tally = new Map<string, { present: number; late: number; absent: number; total: number }>();
  for (const sheet of historyQuery.data?.data ?? []) {
    for (const record of sheet.records ?? []) {
      const entry = tally.get(record.student) ?? { present: 0, late: 0, absent: 0, total: 0 };
      entry.total += 1;
      if (record.status === 'present') entry.present += 1;
      else if (record.status === 'late') entry.late += 1;
      else entry.absent += 1;
      tally.set(record.student, entry);
    }
  }
  const percentageFor = (studentId: string) => {
    const entry = tally.get(studentId);
    if (!entry || entry.total === 0) return undefined;
    return Math.round(((entry.present + entry.late) / entry.total) * 1000) / 10;
  };

  const students = rosterQuery.data?.students ?? classmates.map((student) => ({
    studentId: student.user?._id ?? student._id,
    name: student.user?.name ?? '',
    email: student.user?.email ?? '',
    enrollmentNumber: student.enrollmentNumber,
    rollNumber: student.rollNumber,
  }));

  const visibleStudents = search
    ? students.filter((student) =>
        `${student.name} ${student.email} ${student.enrollmentNumber}`.toLowerCase().includes(search.toLowerCase()),
      )
    : students;

  const percentages = students
    .map((student) => percentageFor(student.studentId))
    .filter((value): value is number => value !== undefined);
  const classAverage = percentages.length
    ? Math.round((percentages.reduce((sum, value) => sum + value, 0) / percentages.length) * 10) / 10
    : 0;

  const exportReport = async () => {
    if (!section?._id) return;
    setExporting(true);
    try {
      const rows = students.map((student) => {
        const entry = tally.get(student.studentId);
        const percentage = percentageFor(student.studentId);
        return {
          enrollmentNumber: student.enrollmentNumber,
          name: student.name,
          present: entry?.present ?? 0,
          absent: entry?.absent ?? 0,
          late: entry?.late ?? 0,
          classes: entry?.total ?? 0,
          percentage: percentage ?? '',
        };
      });
      if (rows.length === 0) {
        toast.error('No students to export yet');
        return;
      }
      const header = Object.keys(rows[0]).join(',');
      const body = rows
        .map((row) =>
          Object.values(row)
            .map((value) => `"${String(value).replace(/"/g, '""')}"`)
            .join(','),
        )
        .join('\n');
      const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `section-${section.name}-attendance.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Class attendance exported');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };


  const columns: Array<Column<RosterStudent>> = [
    {
      key: 'student',
      header: 'Student',
      render: (row) => <PersonCell name={row.name} email={row.email} meta={row.enrollmentNumber} />,
    },
    {
      key: 'enrollment',
      header: 'Enrollment',
      render: (row) => (
        <div>
          <p className="font-mono text-[11.5px] text-ink">{row.enrollmentNumber}</p>
          {row.rollNumber ? <p className="text-[11px] text-muted-foreground">Roll {row.rollNumber}</p> : null}
        </div>
      ),
    },
    {
      key: 'attendance',
      header: 'Attendance',
      render: (row) => {
        const percentage = percentageFor(row.studentId);
        if (percentage === undefined) {
          return <span className="text-[11.5px] text-subtle-foreground">No classes yet</span>;
        }
        return (
          <div className="flex items-center gap-2">
            <Progress
              value={percentage}
              className="h-1.5 w-16"
              indicatorClassName={percentage >= 75 ? 'bg-success' : percentage >= 50 ? 'bg-warning' : 'bg-danger'}
            />
            <span className="tabular-nums text-[11.5px] text-ink-soft">{percentage}%</span>
          </div>
        );
      },
    },
  ];

  if (dashboardQuery.isLoading) {
    return (
      <div>
        <PageHeader eyebrow="People" title="My class" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <CardSkeleton key={index} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (dashboardQuery.error) {
    return (
      <div>
        <PageHeader eyebrow="People" title="My class" />
        <ErrorState error={dashboardQuery.error} onRetry={() => void dashboardQuery.refetch()} />
      </div>
    );
  }

  if (!section) {
    return (
      <div>
        <PageHeader eyebrow="People" title="My class" />
        <EmptyState
          icon={Users2}
          title="No class assigned"
          description="You are not currently the class representative of a section. Ask the academic office if this is unexpected."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={`Class representative · Section ${section.name}`}
        title={typeof section.course === 'object' ? section.course?.name ?? 'My class' : 'My class'}
        description={`Section ${section.name}${typeof section.semester === 'object' && section.semester?.label ? ` · ${section.semester.label}` : ''} — roster, attendance and announcements for your section.`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportReport} loading={exporting}>
              <Download className="h-3.5 w-3.5" /> Export attendance
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/announcements">Post announcement</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-line bg-surface p-4 shadow-soft">
          <p className="text-[11.5px] text-muted-foreground">Classmates</p>
          <p className="mt-1 font-display text-xl font-semibold text-ink">{students.length}</p>
          <p className="mt-1 text-[11px] text-subtle-foreground">active students</p>
        </div>
        <div className="rounded-card border border-line bg-surface p-4 shadow-soft">
          <p className="text-[11.5px] text-muted-foreground">Class attendance</p>
          <p className={`mt-1 font-display text-xl font-semibold ${classAverage >= 75 ? 'text-success' : 'text-warning'}`}>
            {classAverage}%
          </p>
          <p className="mt-1 text-[11px] text-subtle-foreground">average across students</p>
        </div>
        <div className="rounded-card border border-line bg-surface p-4 shadow-soft">
          <p className="text-[11.5px] text-muted-foreground">Subjects</p>
          <p className="mt-1 font-display text-xl font-semibold text-ink">{dashboardQuery.data?.subjects?.length ?? 0}</p>
          <p className="mt-1 text-[11px] text-subtle-foreground">this semester</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            title="Class roster"
            description="Everyone enrolled in your section"
            action={
              <div className="w-44">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Find a classmate…"
                  className="h-8 text-[12px]"
                  aria-label="Search classmates"
                />
              </div>
            }
            padded={false}
          >
            <div className="p-3">
              <DataTable
                columns={columns}
                rows={visibleStudents}
                loading={rosterQuery.isLoading}
                error={rosterQuery.error}
                onRetry={() => void rosterQuery.refetch()}
                rowKey={(row) => row.studentId}
                emptyTitle="No classmates found"
                emptyDescription="Students appear here once they are enrolled in this section."
              />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Subject teachers" description="Who teaches your section">
            {(dashboardQuery.data?.subjects?.length ?? 0) === 0 ? (
              <p className="text-[12px] text-muted-foreground">No teaching assignments recorded.</p>
            ) : (
              <ul className="space-y-2.5">
                {dashboardQuery.data!.subjects.map((item, index) => (
                  <li key={`${item.subject?._id ?? index}`} className="flex items-start gap-2">
                    <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-medium text-ink">
                        {item.subject?.name ?? 'Subject'}
                        {item.subject?.code ? <span className="ml-1 text-[11px] text-subtle-foreground">({item.subject.code})</span> : null}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">{item.teacher?.name ?? 'Unassigned'}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Section announcements"
            action={
              <Link href="/dashboard/announcements" className="text-[11.5px] font-medium text-primary hover:underline">
                View all
              </Link>
            }
          >
            {(dashboardQuery.data?.announcements?.length ?? 0) === 0 ? (
              <p className="text-[12px] text-muted-foreground">No announcements for your section yet.</p>
            ) : (
              <ul className="space-y-3">
                {dashboardQuery.data!.announcements.slice(0, 4).map((announcement: Announcement) => (
                  <li key={announcement._id}>
                    <p className="flex items-start gap-1.5 text-[12.5px] font-medium text-ink">
                      <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-foreground" />
                      {announcement.title}
                    </p>
                    <p className="ml-5 text-[11px] text-muted-foreground">
                      {formatDate(announcement.publishAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {(dashboardQuery.data?.tasks?.length ?? 0) > 0 ? (
            <SectionCard title="My tasks" description="Assigned to you as a class representative">
              <ul className="space-y-2">
                {dashboardQuery.data!.tasks.map((task) => (
                  <li key={task._id} className="flex items-start justify-between gap-2">
                    <span className="text-[12px] text-ink-soft">{task.title}</span>
                    <Badge variant={statusVariant(task.status)} size="sm">{titleCase(task.status)}</Badge>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
