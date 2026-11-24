'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CalendarDays, ClipboardCheck, Megaphone, BookOpen, TicketCheck, Users2, ListChecks, ArrowRight, BadgeCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';
import { Reveal } from '@/components/shared/reveal';
import { useAuth } from '@/providers/auth-provider';
import type { CRDashboard, StudentDashboard, VolunteerDashboard } from '@/types/api';

export const StudentDashboardView = ({
  data,
  cr,
  volunteer,
}: {
  data: StudentDashboard;
  cr?: CRDashboard;
  volunteer?: VolunteerDashboard;
}) => {
  const { user, isCR, isVolunteer } = useAuth();
  const [tab, setTab] = useState('overview');
  const attendance = data.attendance;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Student portal"
        title={`Hello, ${user?.name?.split(' ')[0] ?? 'Student'}`}
        description={
          data.profile
            ? `${data.profile.course?.name ?? 'Course'} · Semester ${data.profile.semester?.number ?? '—'} · Section ${data.profile.section?.name ?? '—'}`
            : 'Your academic and campus activity in one place.'
        }
        actions={
          <Button size="sm" asChild>
            <Link href="/dashboard/explore">
              <CalendarDays className="h-4 w-4" />
              Explore events
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Attendance" value={`${attendance.percentage}%`} icon={ClipboardCheck} tone={attendance.percentage >= 75 ? 'success' : 'accent'} href="/dashboard/my-attendance" hint={`${attendance.present + attendance.late}/${attendance.total} classes`} />
        <StatCard label="My registrations" value={data.counts.registrations} icon={TicketCheck} href="/dashboard/my-registrations" />
        <StatCard label="Upcoming events" value={data.upcomingEvents.length} icon={CalendarDays} tone="accent" href="/dashboard/explore" />
        <StatCard label="Pending tasks" value={data.counts.pendingTasks} icon={ListChecks} tone="neutral" href="/dashboard/tasks" />
      </div>

      {isCR || isVolunteer ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {isCR ? <TabsTrigger value="cr">Class representative</TabsTrigger> : null}
            {isVolunteer ? <TabsTrigger value="volunteer">Volunteer</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="overview" />
        </Tabs>
      ) : null}

      {(!tab || tab === 'overview' || (!isCR && !isVolunteer)) && (
        <div className="grid gap-4 lg:grid-cols-5">
          <Reveal className="lg:col-span-3">
            <SectionCard
              title="My subjects"
              description="Subjects assigned to your section"
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/my-subjects">
                    All <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              }
            >
              {data.subjects.length === 0 ? (
                <EmptyState icon={BookOpen} title="No subjects assigned" description="Your section's subjects will appear here once assigned." compact />
              ) : (
                <ul className="divide-y divide-line">
                  {data.subjects.map((entry) => (
                    <li key={entry.subject._id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink">{entry.subject.name}</p>
                        <p className="text-[11.5px] text-muted-foreground">
                          {entry.subject.code} · {entry.teacher?.name ?? 'Faculty TBA'}
                        </p>
                      </div>
                      {entry.subject.credits ? (
                        <Badge variant="neutral" size="sm">
                          {entry.subject.credits} credits
                        </Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </Reveal>

          <Reveal delay={0.08} className="lg:col-span-2">
            <SectionCard title="Attendance by subject" description="Classes attended so far">
              {attendance.total === 0 ? (
                <EmptyState icon={ClipboardCheck} title="No attendance yet" description="Attendance appears after your faculty mark classes." compact />
              ) : (
                <ul className="space-y-3.5">
                  {attendance.bySubject.slice(0, 6).map((entry) => (
                    <li key={entry.subject}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-[12.5px] font-medium text-ink">{entry.subject}</span>
                        <span className="text-[11.5px] tabular-nums text-muted-foreground">{entry.percentage}%</span>
                      </div>
                      <Progress
                        value={entry.percentage}
                        className="h-1.5"
                        indicatorClassName={entry.percentage >= 75 ? 'bg-success' : entry.percentage >= 50 ? 'bg-warning' : 'bg-danger'}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </Reveal>
        </div>
      )}

      {tab === 'cr' && cr ? (
        <Reveal>
          <SectionCard title="Class representative" description={cr.section ? `Section ${cr.section.name}` : 'Your class'}>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-primary-soft/60 p-3">
                <p className="text-[11px] text-muted-foreground">Classmates</p>
                <p className="font-display text-xl font-semibold text-ink">{cr.classmates.length}</p>
              </div>
              <div className="rounded-xl bg-success-soft/70 p-3">
                <p className="text-[11px] text-muted-foreground">Class attendance</p>
                <p className="font-display text-xl font-semibold text-ink">{cr.attendance?.percentage ?? 0}%</p>
              </div>
              <div className="rounded-xl bg-accent-soft p-3">
                <p className="text-[11px] text-muted-foreground">Marked sessions</p>
                <p className="font-display text-xl font-semibold text-ink">{cr.attendance?.sheets ?? 0}</p>
              </div>
            </div>
            {cr.classmates.length === 0 ? (
              <EmptyState icon={Users2} title="No classmates listed" compact />
            ) : (
              <ul className="divide-y divide-line">
                {cr.classmates.map((classmate) => (
                  <li key={classmate._id} className="flex items-center justify-between py-2">
                    <span className="text-[13px] text-ink">{classmate.user?.name ?? 'Student'}</span>
                    <span className="text-[11.5px] text-muted-foreground">
                      {classmate.enrollmentNumber}
                      {classmate.rollNumber ? ` · Roll ${classmate.rollNumber}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </Reveal>
      ) : null}

      {tab === 'volunteer' && volunteer ? (
        <Reveal>
          <SectionCard title="Volunteer hub" description="Your event groups and duties">
            {volunteer.tasks.length === 0 && volunteer.groups.length === 0 ? (
              <EmptyState icon={Users2} title="No volunteer duties assigned" description="Event coordinators assign volunteers per event." compact />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {volunteer.groups.map((group) => (
                    <Badge key={group._id} variant="accent">
                      {group.event?.title} · {group.name}
                    </Badge>
                  ))}
                </div>
                <ul className="divide-y divide-line">
                  {volunteer.tasks.map((task) => (
                    <li key={task._id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink">{task.title}</p>
                        <p className="text-[11.5px] text-muted-foreground">
                          {task.event?.title} · {titleCase(task.status)}
                          {task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ''}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/dashboard/tasks">Update</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>
        </Reveal>
      ) : null}

      {(!tab || tab === 'overview') && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Reveal className="lg:col-span-2">
            <SectionCard
              title="Upcoming events"
              description="Open for registration"
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/explore">
                    Explore <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              }
            >
              {data.upcomingEvents.length === 0 ? (
                <EmptyState icon={CalendarDays} title="No upcoming events" description="New events will be published here." compact />
              ) : (
                <ul className="divide-y divide-line">
                  {data.upcomingEvents.map((event) => (
                    <li key={event._id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <Link href={`/dashboard/explore/detail?id=${event._id}`} className="truncate text-[13px] font-medium text-ink hover:text-primary">
                          {event.title}
                        </Link>
                        <p className="text-[11.5px] text-muted-foreground">
                          {formatDate(event.startDate)} · {event.venue ?? 'Venue TBA'} · {formatCurrency(event.registration?.fee ?? 0)}
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

          <Reveal delay={0.08}>
            <SectionCard
              title="Announcements"
              description="Latest college notices"
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/announcements">
                    All <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              }
            >
              {data.announcements.length === 0 ? (
                <EmptyState icon={Megaphone} title="No announcements" compact />
              ) : (
                <ul className="space-y-2.5">
                  {data.announcements.slice(0, 4).map((announcement) => (
                    <li key={announcement._id} className="rounded-xl border border-line bg-surface-subtle/40 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12.5px] font-medium leading-snug text-ink">{announcement.title}</p>
                        <Badge variant={announcement.priority === 'urgent' ? 'danger' : announcement.priority === 'high' ? 'warning' : 'neutral'} size="sm">
                          {titleCase(announcement.priority)}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11.5px] text-muted-foreground">{announcement.body}</p>
                      <p className="mt-1 text-[10.5px] text-subtle-foreground">{formatDate(announcement.publishAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </Reveal>
        </div>
      )}

      {(!tab || tab === 'overview') && data.registrations.length > 0 ? (
        <Reveal>
          <SectionCard
            title="My registrations"
            description="Recent event participation"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/my-registrations">
                  All <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            }
          >
            <ul className="divide-y divide-line">
              {data.registrations.map((registration) => (
                <li key={registration._id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {typeof registration.event === 'object' ? registration.event.title : 'Event'}
                      {typeof registration.competition === 'object' && registration.competition ? ` · ${registration.competition.title}` : ''}
                    </p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {registration.registrationId} · {formatCurrency(registration.feeAmount)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant={statusVariant(registration.status)} size="sm">
                      {titleCase(registration.status)}
                    </Badge>
                    {registration.checkedInAt ? (
                      <Badge variant="success" size="sm">
                        <BadgeCheck className="h-3 w-3" /> Checked in
                      </Badge>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </Reveal>
      ) : null}
    </div>
  );
};
