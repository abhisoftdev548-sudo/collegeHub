'use client';

import Link from 'next/link';
import { BookOpen, CalendarDays, ClipboardCheck, ListChecks, Users } from 'lucide-react';
import { ArrowRight, Bell } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatDate, titleCase } from '@/lib/utils';
import { Reveal } from '@/components/shared/reveal';
import { useAuth } from '@/providers/auth-provider';
import type { TeacherDashboard } from '@/types/api';

export const TeacherDashboardView = ({ data }: { data: TeacherDashboard }) => {
  const { user } = useAuth();
  const { counts } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Faculty workspace"
        title={`Welcome, ${user?.name?.split(' ')[0] ?? 'Professor'}`}
        description="Your assigned sections, students and event responsibilities at a glance."
        actions={
          <Button size="sm" asChild>
            <Link href="/dashboard/attendance">
              <ClipboardCheck className="h-4 w-4" />
              Mark attendance
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My students" value={counts.studentCount} icon={Users} href="/dashboard/my-students" hint={`${data.sections.length} sections`} />
        <StatCard label="Attendance rate" value={`${counts.attendancePercentage}%`} icon={ClipboardCheck} tone="success" href="/dashboard/attendance" hint="Across marked sessions" />
        <StatCard label="My events" value={counts.eventCount} icon={CalendarDays} tone="accent" hint={`${counts.registrationCount} registrations`} />
        <StatCard label="Pending tasks" value={counts.pendingTaskCount} icon={ListChecks} tone="neutral" href="/dashboard/tasks" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Reveal className="lg:col-span-3">
          <SectionCard
            title="Teaching assignments"
            description="Subjects and sections assigned to you this session"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/my-subjects">
                  Details <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            }
          >
            {data.assignments.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No assignments yet"
                description="The academic office assigns subjects and sections. Contact them if something is missing."
                compact
              />
            ) : (
              <ul className="divide-y divide-line">
                {data.assignments.map((assignment) => (
                  <li key={assignment._id} className="flex items-center gap-3 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-hover">
                      <BookOpen className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">{assignment.subject.name}</p>
                      <p className="text-[11.5px] text-muted-foreground">
                        {assignment.subject.code}
                        {assignment.section?.semester?.label ? ` · ${assignment.section.semester.label}` : ''} · Section{' '}
                        {assignment.section?.name}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/attendance?subject=${assignment.subject._id}&section=${assignment.section._id}`}>
                        Attendance
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08} className="lg:col-span-2">
          <SectionCard
            title="Pending tasks"
            description="Volunteer and event duties"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/tasks">
                  All <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            }
          >
            {data.pendingTasks.length === 0 ? (
              <EmptyState icon={ListChecks} title="Nothing pending" description="You’re all caught up on assigned duties." compact />
            ) : (
              <ul className="space-y-3">
                {data.pendingTasks.map((task) => (
                  <li key={task._id} className="rounded-xl border border-line bg-surface-subtle/50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12.5px] font-medium leading-snug text-ink">{task.title}</p>
                      <Badge variant={task.priority === 'urgent' || task.priority === 'high' ? 'danger' : 'neutral'} size="sm">
                        {titleCase(task.priority)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {task.event?.title}
                      {task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </Reveal>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal>
          <SectionCard title="My sections" description="Sections under your teaching scope">
            {data.sections.length === 0 ? (
              <EmptyState icon={Users} title="No sections assigned" compact />
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {data.sections.map((section) => (
                  <Link
                    key={section._id}
                    href={`/dashboard/my-students?section=${section._id}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">Section {section.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {section.studentCount ?? 0} students · Semester{' '}
                        {typeof section.semester === 'object' ? section.semester.number : '—'}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-subtle-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08}>
          <SectionCard
            title="Events I coordinate"
            description="Registrations and check-ins"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/events">
                  Manage <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            }
          >
            {data.events.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No events assigned" description="Events you coordinate or assist with appear here." compact />
            ) : (
              <ul className="divide-y divide-line">
                {data.events.map((event) => (
                  <li key={event._id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">{event.title}</p>
                      <p className="text-[11.5px] text-muted-foreground">
                        {formatDate(event.startDate)} · {event.stats?.registrations ?? 0} registrations
                      </p>
                    </div>
                    <Badge variant={statusVariant(event.status)} size="sm">
                      {titleCase(event.status)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </Reveal>
      </div>

      <Reveal>
        <SectionCard
          title="Notifications"
          description="Announcements relevant to you"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/announcements">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        >
          {(data as unknown as { announcements?: Array<{ _id: string; title: string; body: string; publishAt: string }> }).announcements?.length ? (
            <ul className="space-y-2">
              {((data as unknown as { announcements: Array<{ _id: string; title: string; body: string; publishAt: string }> }).announcements ?? [])
                .slice(0, 3)
                .map((announcement) => (
                  <li key={announcement._id}>
                    <Link
                      href="/dashboard/announcements"
                      className="block rounded-xl border border-line bg-surface-subtle/40 p-3 transition-colors hover:border-primary/30"
                    >
                      <p className="text-[13px] font-medium text-ink">{announcement.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{announcement.body}</p>
                      <p className="mt-1 text-[11px] text-subtle-foreground">{formatDate(announcement.publishAt)}</p>
                    </Link>
                  </li>
                ))}
            </ul>
          ) : (
            <EmptyState icon={Bell} title="No announcements" description="College notices appear here." compact />
          )}
        </SectionCard>
      </Reveal>
    </div>
  );
};
