'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, ClipboardCheck, Clock, Download, Save, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { FullPageLoader } from '@/components/shared/guards';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { api, downloadFile, getErrorMessage } from '@/lib/api';
import { cn, toDateInputValue } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { AttendanceReportRow, AttendanceSheet, Section, Subject, TeacherDashboard } from '@/types/api';

type MarkStatus = 'present' | 'absent' | 'late';

interface MarkSheetRow {
  studentId: string;
  enrollmentNumber: string;
  name: string;
  status: MarkStatus | null;
  remarks?: string;
}

const STATUS_BUTTONS: Array<{ value: MarkStatus; label: string; icon: typeof CheckCircle2; active: string }> = [
  { value: 'present', label: 'Present', icon: CheckCircle2, active: 'bg-success text-white border-success' },
  { value: 'late', label: 'Late', icon: Clock, active: 'bg-warning text-white border-warning' },
  { value: 'absent', label: 'Absent', icon: UserX, active: 'bg-danger text-white border-danger' },
];

const AttendancePageInner = () => {
  const params = useSearchParams();
  const { user } = useAuth();
  const today = toDateInputValue(new Date());

  const [date, setDate] = useState(today);
  const [subjectId, setSubjectId] = useState(params.get('subject') ?? '');
  const [sectionId, setSectionId] = useState(params.get('section') ?? '');
  const [rows, setRows] = useState<MarkSheetRow[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Teachers get their own assignment list from the overview endpoint.
  const overviewQuery = useQuery({
    queryKey: ['teacher-overview'],
    queryFn: () => api.get<TeacherDashboard>('/teachers/me/overview'),
    enabled: user?.role === 'teacher',
  });

  const assignments = useMemo(() => overviewQuery.data?.assignments ?? [], [overviewQuery.data]);

  // Administrators may pick any section/subject combination.
  const sectionsQuery = useQuery({
    queryKey: ['sections'],
    queryFn: () => api.get<Section[]>('/academic/sections'),
    enabled: user?.role === 'admin',
  });
  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.get<Subject[]>('/academic/subjects'),
    enabled: user?.role === 'admin',
  });

  // Default to the teacher's first assignment.
  useEffect(() => {
    if (user?.role !== 'teacher' || subjectId || sectionId || assignments.length === 0) return;
    const first = assignments[0];
    setSubjectId(first.subject._id);
    setSectionId(first.section._id);
  }, [assignments, subjectId, sectionId, user?.role]);

  const sheetQuery = useQuery({
    queryKey: ['attendance-sheet', subjectId, sectionId, date],
    queryFn: () =>
      api.get<AttendanceSheet>('/attendance/sheet', {
        params: { subject: subjectId, section: sectionId, date },
      }),
    enabled: Boolean(subjectId && sectionId && date),
  });

  useEffect(() => {
    if (!sheetQuery.data) return;
    const next = sheetQuery.data.students.map((student) => ({
      studentId: student.studentId,
      enrollmentNumber: student.enrollmentNumber,
      name: student.name,
      status: student.status ?? null,
      remarks: student.remarks,
    }));
    setRows(next);
    setSavedSnapshot(JSON.stringify(next.map((row) => [row.studentId, row.status])));
  }, [sheetQuery.data]);

  const reportQuery = useQuery({
    queryKey: ['attendance-report', sectionId],
    queryFn: () => api.get<AttendanceReportRow[]>('/attendance/report', { params: { section: sectionId } }),
    enabled: Boolean(sectionId),
  });

  const dirty = useMemo(() => {
    const current = JSON.stringify(rows.map((row) => [row.studentId, row.status]));
    return current !== savedSnapshot;
  }, [rows, savedSnapshot]);

  const counts = useMemo(() => {
    const tally = { present: 0, absent: 0, late: 0, unmarked: 0 };
    for (const row of rows) {
      if (row.status === 'present') tally.present += 1;
      else if (row.status === 'absent') tally.absent += 1;
      else if (row.status === 'late') tally.late += 1;
      else tally.unmarked += 1;
    }
    return tally;
  }, [rows]);

  const setStatus = (studentId: string, status: MarkStatus) =>
    setRows((current) =>
      current.map((row) => (row.studentId === studentId ? { ...row, status: row.status === status ? null : status } : row)),
    );

  const markAll = (status: MarkStatus) =>
    setRows((current) => current.map((row) => ({ ...row, status })));

  const save = async () => {
    const marked = rows.filter((row) => row.status);
    if (marked.length === 0) {
      toast.error('Mark at least one student before saving');
      return;
    }
    setSaving(true);
    try {
      await api.post('/attendance', {
        subject: subjectId,
        section: sectionId,
        date,
        records: marked.map((row) => ({
          studentId: row.studentId,
          status: row.status as MarkStatus,
          remarks: row.remarks?.trim() || undefined,
        })),
      });
      setSavedSnapshot(JSON.stringify(rows.map((row) => [row.studentId, row.status])));
      toast.success(`Attendance saved for ${marked.length} students`);
      await Promise.all([reportQuery.refetch(), sheetQuery.refetch()]);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (user?.role === 'teacher' && overviewQuery.isLoading) return <FullPageLoader label="Loading your sections…" />;

  const hasSelectorOptions =
    (user?.role === 'teacher' && assignments.length > 0) || (user?.role === 'admin' && (sectionsQuery.data?.length ?? 0) > 0);

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Academic attendance"
        description="Mark attendance per subject and section. Re-saving the same date updates the existing record."
        actions={
          sectionId ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void downloadFile(`/attendance/report/export?section=${sectionId}`, 'attendance-report.csv')}
            >
              <Download className="h-4 w-4" /> Export report
            </Button>
          ) : null
        }
      />

      {!hasSelectorOptions ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No teaching assignments"
          description="Attendance is marked against the subjects and sections assigned to you. Contact the academic office if an assignment is missing."
        />
      ) : (
        <>
          <div className="mb-4 rounded-card border border-line bg-surface p-4 shadow-soft">
            <div className="grid gap-3 sm:grid-cols-3">
              {user?.role === 'admin' ? (
                <>
                  <FormField label="Section" htmlFor="att-section" required>
                    <Select value={sectionId} onValueChange={setSectionId}>
                      <SelectTrigger id="att-section"><SelectValue placeholder="Select section" /></SelectTrigger>
                      <SelectContent>
                        {(sectionsQuery.data ?? []).map((section) => (
                          <SelectItem key={section._id} value={section._id}>
                            Section {section.name} · {typeof section.course === 'object' ? section.course.code : ''} · Sem{' '}
                            {typeof section.semester === 'object' ? section.semester.number : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Subject" htmlFor="att-subject" required>
                    <Select value={subjectId} onValueChange={setSubjectId}>
                      <SelectTrigger id="att-subject"><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>
                        {(subjectsQuery.data ?? []).map((subject) => (
                          <SelectItem key={subject._id} value={subject._id}>{subject.code} · {subject.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                </>
              ) : (
                <FormField label="Subject & section" htmlFor="att-assignment" required className="sm:col-span-2">
                  <Select
                    value={`${subjectId}:${sectionId}`}
                    onValueChange={(value) => {
                      const [nextSubject, nextSection] = value.split(':');
                      setSubjectId(nextSubject);
                      setSectionId(nextSection);
                    }}
                  >
                    <SelectTrigger id="att-assignment"><SelectValue placeholder="Select a class" /></SelectTrigger>
                    <SelectContent>
                      {assignments.map((assignment) => (
                        <SelectItem
                          key={assignment._id}
                          value={`${assignment.subject._id}:${assignment.section._id}`}
                        >
                          {assignment.subject.name} · Section {assignment.section.name}
                          {assignment.section.semester?.label ? ` · ${assignment.section.semester.label}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              )}
              <FormField label="Date" htmlFor="att-date" required>
                <Input
                  id="att-date"
                  type="date"
                  value={date}
                  max={today}
                  onChange={(event) => setDate(event.target.value)}
                />
              </FormField>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SectionCard
                title={`Mark attendance · ${date}`}
                description={
                  sheetQuery.data?.saved
                    ? 'Attendance already recorded for this date — changes will update the existing record.'
                    : 'Tap a student to cycle Present / Late / Absent.'
                }
                padded={false}
                action={
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => markAll('present')}>All present</Button>
                    <Button size="sm" onClick={() => void save()} loading={saving} disabled={!dirty}>
                      <Save className="h-3.5 w-3.5" /> Save
                    </Button>
                  </div>
                }
              >
                {sheetQuery.isLoading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={index} className="h-12 w-full" />
                    ))}
                  </div>
                ) : sheetQuery.error ? (
                  <div className="p-4">
                    <ErrorState error={sheetQuery.error} onRetry={() => void sheetQuery.refetch()} compact />
                  </div>
                ) : rows.length === 0 ? (
                  <div className="p-4">
                    <EmptyState
                      icon={CalendarDays}
                      title="No students in this section"
                      description="Students must be placed in the section before attendance can be marked."
                      compact
                    />
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {rows.map((row) => (
                      <li key={row.studentId} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink">{row.name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{row.enrollmentNumber}</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {STATUS_BUTTONS.map((button) => {
                            const active = row.status === button.value;
                            const Icon = button.icon;
                            return (
                              <button
                                key={button.value}
                                type="button"
                                onClick={() => setStatus(row.studentId, button.value)}
                                aria-pressed={active}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition-colors',
                                  active
                                    ? button.active
                                    : 'border-line bg-surface text-ink-soft hover:bg-surface-subtle',
                                )}
                              >
                                <Icon className="h-3 w-3" />
                                {button.label}
                              </button>
                            );
                          })}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {rows.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2.5 text-[11.5px] text-muted-foreground">
                    <span className="text-success">{counts.present} present</span>
                    <span className="text-warning">{counts.late} late</span>
                    <span className="text-danger">{counts.absent} absent</span>
                    <span>{counts.unmarked} unmarked</span>
                    {dirty ? <Badge variant="warning" size="sm">Unsaved changes</Badge> : <Badge variant="success" size="sm">Saved</Badge>}
                  </div>
                ) : null}
              </SectionCard>
            </div>

            <SectionCard title="Section performance" description="Attendance percentage by student">
              {reportQuery.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                  ))}
                </div>
              ) : !reportQuery.data || reportQuery.data.length === 0 ? (
                <EmptyState icon={ClipboardCheck} title="No attendance recorded" description="Percentages appear after the first session is saved." compact />
              ) : (
                <ul className="space-y-3">
                  {reportQuery.data.slice(0, 10).map((row) => (
                    <li key={row.studentId}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-[12px] text-ink">{row.name}</span>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {row.percentage}% · {row.present}/{row.total}
                        </span>
                      </div>
                      <Progress
                        value={row.percentage}
                        className="h-1.5"
                        indicatorClassName={
                          row.percentage >= 75 ? 'bg-success' : row.percentage >= 50 ? 'bg-warning' : 'bg-danger'
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
};

export default function AttendancePage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <AttendancePageInner />
    </Suspense>
  );
}
