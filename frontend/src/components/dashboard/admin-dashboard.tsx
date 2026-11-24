'use client';

import Link from 'next/link';
import { useMemo, useRef } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { CalendarDays, GraduationCap, IndianRupee, Users, UserCog, Building2, ClipboardCheck } from 'lucide-react';
import {
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  Megaphone,
  TicketCheck,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { ChartTooltip } from './chart-tooltip';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatCurrency, formatDate, initials, titleCase } from '@/lib/utils';
import { Reveal } from '@/components/shared/reveal';
import type { AdminDashboard } from '@/types/api';

const PALETTE = ['#3b76e8', '#f8d77e', '#1f9d6d', '#8fb6f7', '#c98a12', '#64748b'];

export const AdminDashboardView = ({ data }: { data: AdminDashboard }) => {
  const { counts } = data;

  const attendanceSeries = useMemo(() => {
    const byDate = new Map<string, { date: string; present: number; absent: number; late: number }>();
    for (const row of data.attendanceByDay ?? []) {
      const date = String(row._id?.date ?? '');
      if (!date) continue;
      const entry = byDate.get(date) ?? { date, present: 0, absent: 0, late: 0 };
      if (row._id?.status === 'present') entry.present += row.count;
      else if (row._id?.status === 'absent') entry.absent += row.count;
      else if (row._id?.status === 'late') entry.late += row.count;
      byDate.set(date, entry);
    }
    return [...byDate.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => ({ ...entry, label: formatDate(entry.date, { month: 'short', day: 'numeric' }) }));
  }, [data.attendanceByDay]);

  const departmentSeries = (data.studentsByDepartment ?? []).slice(0, 7);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="College overview"
        description="Live academic and event figures computed directly from the college database."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/reports">
                <TrendingUp className="h-4 w-4" />
                Reports
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/announcements">
                <Megaphone className="h-4 w-4" />
                New announcement
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active students" value={counts.totalStudents} icon={Users} href="/dashboard/students" hint="Currently enrolled" />
        <StatCard label="Faculty" value={counts.totalTeachers} icon={UserCog} tone="accent" href="/dashboard/teachers" hint="Active teaching staff" />
        <StatCard label="Departments" value={counts.totalDepartments} icon={Building2} tone="neutral" href="/dashboard/academics/departments" hint={`${counts.totalCourses} courses`} />
        <StatCard label="Fees collected" value={formatCurrency(counts.collectedPayments)} icon={IndianRupee} tone="success" href="/dashboard/payments" hint={`${counts.pendingPayments} payments pending`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Upcoming events" value={counts.upcomingEvents} icon={CalendarDays} tone="primary" href="/dashboard/events" hint={`${counts.activeEvents} ongoing`} />
        <StatCard label="Registrations" value={counts.confirmedRegistrations} icon={TicketCheck} tone="accent" href="/dashboard/registrations" hint={`${counts.pendingRegistrations} awaiting approval`} />
        <StatCard label="Event check-ins" value={counts.eventCheckIns} icon={BadgeCheck} tone="success" href="/dashboard/event-checkin" />
        <StatCard label="CRs & volunteers" value={counts.totalCRs + counts.totalVolunteers} icon={ClipboardCheck} tone="neutral" hint={`${counts.totalCRs} CR · ${counts.totalVolunteers} volunteers`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Reveal className="lg:col-span-3">
          <SectionCard
            title="Attendance trend"
            description="Marked attendance across the last 14 days"
            action={<Badge variant="primary">Last 14 days</Badge>}
          >
            {attendanceSeries.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="No attendance marked yet"
                description="Once faculty start marking attendance, institution-wide trends appear here."
                compact
              />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceSeries} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="presentFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b76e8" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#3b76e8" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6ecf5" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <ChartTooltip />
                    <Area type="monotone" dataKey="present" name="Present" stroke="#3b76e8" strokeWidth={2} fill="url(#presentFill)" />
                    <Area type="monotone" dataKey="absent" name="Absent" stroke="#d94848" strokeWidth={1.5} fill="transparent" strokeDasharray="4 3" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08} className="lg:col-span-2">
          <SectionCard title="Students by department" description="Active enrolment distribution">
            {departmentSeries.length === 0 ? (
              <EmptyState icon={GraduationCap} title="No students yet" description="Add departments and students to see the distribution." compact />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentSeries} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6ecf5" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis dataKey="code" type="category" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={44} />
                    <ChartTooltip />
                    <Bar dataKey="count" name="Students" radius={[0, 6, 6, 0]} barSize={18}>
                      {departmentSeries.map((entry, index) => (
                        <Cell key={entry.code} fill={PALETTE[index % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>
        </Reveal>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal>
          <SectionCard
            title="Upcoming events"
            description="Published events starting soon"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/events">
                  Manage <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            }
          >
            {data.upcomingEvents.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No upcoming events" description="Create an event to start collecting registrations." compact />
            ) : (
              <ul className="divide-y divide-line">
                {data.upcomingEvents.map((event) => (
                  <li key={event._id}>
                    <Link
                      href={`/dashboard/events/detail?id=${event._id}`}
                      className="flex items-center gap-3 py-2.5 transition-colors hover:bg-surface-subtle/60"
                    >
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-primary-soft text-primary-hover">
                        <span className="text-[10px] font-semibold uppercase leading-none">
                          {formatDate(event.startDate, { month: 'short' })}
                        </span>
                        <span className="text-[13px] font-semibold leading-tight">
                          {new Date(event.startDate).getDate()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">{event.title}</p>
                        <p className="truncate text-[11.5px] text-muted-foreground">
                          {event.venue ?? 'Venue TBA'} · {event.category?.name ?? 'General'}
                        </p>
                      </div>
                      <Badge variant={statusVariant(event.status)} size="sm">
                        {titleCase(event.status)}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08}>
          <SectionCard
            title="Recent activity"
            description="Audit trail of administrative actions"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/audit">
                  Full log <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            }
          >
            {data.recentActivity.length === 0 ? (
              <EmptyState icon={CircleDollarSign} title="No activity recorded" description="Administrative changes are logged here automatically." compact />
            ) : (
              <ul className="space-y-3">
                {data.recentActivity.slice(0, 6).map((entry) => (
                  <li key={entry._id} className="flex gap-3">
                    <Avatar className="mt-0.5 h-7 w-7">
                      <AvatarFallback className="text-[10px]">{initials(entry.actor?.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-[12.5px] leading-snug text-ink">
                        <span className="font-medium">{entry.actor?.name ?? 'System'}</span>{' '}
                        <span className="text-muted-foreground">{titleCase(entry.action)}</span>{' '}
                        <span className="font-medium">{titleCase(entry.entity)}</span>
                      </p>
                      <p className="text-[11px] text-subtle-foreground">{formatDate(entry.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </Reveal>
      </div>
    </div>
  );
};
