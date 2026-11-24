'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Download, FileSpreadsheet, TrendingUp, Users, UserCog, CalendarCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { DataTable, type Column } from '@/components/shared/data-table';
import { ChartTooltip } from '@/components/dashboard/chart-tooltip';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, downloadFile } from '@/lib/api';
import type { AcademicReportRow, EngagementReport, WorkloadReportRow } from '@/types/api';

export default function ReportsPage() {
  const [tab, setTab] = useState('academic');

  const academicQuery = useQuery({
    queryKey: ['report-academic'],
    queryFn: () => api.get<AcademicReportRow[]>('/reports/academic'),
  });
  const workloadQuery = useQuery({
    queryKey: ['report-workload'],
    queryFn: () => api.get<WorkloadReportRow[]>('/reports/teacher-workload'),
  });
  const engagementQuery = useQuery({
    queryKey: ['report-engagement'],
    queryFn: () => api.get<EngagementReport>('/reports/engagement'),
  });

  const academicColumns: Column<AcademicReportRow>[] = [
    { key: 'course', header: 'Course', render: (row) => <span className="font-medium text-ink">{row.course} <span className="text-[11px] text-muted-foreground">({row.courseCode})</span></span> },
    { key: 'semester', header: 'Semester', render: (row) => <span className="tabular-nums">Semester {row.semester}</span> },
    { key: 'section', header: 'Section', render: (row) => <span>Section {row.section}</span> },
    { key: 'students', header: 'Students', render: (row) => <span className="tabular-nums font-medium text-ink">{row.students}</span> },
  ];

  const workloadColumns: Column<WorkloadReportRow>[] = [
    { key: 'name', header: 'Faculty', render: (row) => (
      <div>
        <p className="font-medium text-ink">{row.name}</p>
        <p className="text-[11px] text-muted-foreground">{row.designation ?? row.email}</p>
      </div>
    ) },
    { key: 'assignments', header: 'Subjects', render: (row) => <span className="tabular-nums">{row.assignments}</span> },
    { key: 'sections', header: 'Sections', render: (row) => <span className="tabular-nums">{row.sections}</span> },
    { key: 'events', header: 'Events', render: (row) => <span className="tabular-nums">{row.events}</span> },
  ];

  const engagement = engagementQuery.data;
  const engagementChart = engagement
    ? [
        { name: 'Active students', value: engagement.activeStudents },
        { name: 'New registrations', value: engagement.newRegistrations },
        { name: 'Check-ins', value: engagement.eventCheckIns },
        { name: 'Departments', value: engagement.departments },
        { name: 'Sections', value: engagement.sections },
      ]
    : [];

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Reports"
        description="Enrolment, faculty workload and campus engagement computed live from the database."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void downloadFile('/reports/academic/export', 'academic-report.csv')}
          >
            <Download className="h-4 w-4" /> Export academic CSV
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="academic">Academics</TabsTrigger>
          <TabsTrigger value="workload">Faculty workload</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
        </TabsList>

        <TabsContent value="academic">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Sections reporting', value: academicQuery.data?.length ?? 0, icon: FileSpreadsheet },
              { label: 'Students counted', value: (academicQuery.data ?? []).reduce((sum, row) => sum + row.students, 0), icon: Users },
              { label: 'Courses covered', value: new Set((academicQuery.data ?? []).map((row) => row.courseCode)).size, icon: TrendingUp },
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
          <SectionCard title="Enrolment by section" description="Active students grouped by course, semester and section" padded={false}>
            <DataTable
              columns={academicColumns}
              rows={academicQuery.data}
              loading={academicQuery.isLoading}
              error={academicQuery.error}
              onRetry={() => void academicQuery.refetch()}
              rowKey={(row) => `${row.courseCode}-${row.semester}-${row.section}`}
              emptyIcon={FileSpreadsheet}
              emptyTitle="No enrolment data"
              emptyDescription="Enrol students to see section-level reports."
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="workload">
          <SectionCard title="Faculty workload" description="Teaching assignments and event coordination per faculty member" padded={false}>
            <DataTable
              columns={workloadColumns}
              rows={workloadQuery.data}
              loading={workloadQuery.isLoading}
              error={workloadQuery.error}
              onRetry={() => void workloadQuery.refetch()}
              rowKey={(row) => row.id}
              emptyIcon={UserCog}
              emptyTitle="No faculty recorded"
              emptyDescription="Add faculty accounts to track teaching load."
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="engagement">
          {engagementQuery.isLoading ? (
            <div className="h-64 animate-pulse rounded-card bg-surface-subtle" />
          ) : engagementQuery.error ? (
            <ErrorState error={engagementQuery.error} onRetry={() => void engagementQuery.refetch()} />
          ) : !engagement ? (
            <EmptyState icon={CalendarCheck} title="No engagement data" compact />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Campus engagement" description="Participation across the current session">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={engagementChart} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e6ecf5" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={0} angle={-12} textAnchor="end" height={54} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <ChartTooltip />
                      <Bar dataKey="value" name="Count" fill="#3b76e8" radius={[6, 6, 0, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
              <SectionCard title="Highlights" description="Key figures for the current session">
                <dl className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Active students', value: engagement.activeStudents },
                    { label: 'New registrations', value: engagement.newRegistrations },
                    { label: 'Event check-ins', value: engagement.eventCheckIns },
                    { label: 'Check-in rate', value: `${engagement.checkInRate}%` },
                    { label: 'Departments', value: engagement.departments },
                    { label: 'Sections', value: engagement.sections },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-surface-subtle/60 p-3">
                      <dt className="text-[11px] text-muted-foreground">{item.label}</dt>
                      <dd className="mt-0.5 font-display text-lg font-semibold text-ink">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </SectionCard>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
