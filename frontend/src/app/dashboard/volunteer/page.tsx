'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, ClipboardList, Users2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CardSkeleton } from '@/components/ui/skeleton';
import { api, getErrorMessage } from '@/lib/api';
import { formatDate, formatDateTime, titleCase } from '@/lib/utils';
import type { TaskItem, VolunteerGroup } from '@/types/api';

interface CheckInRow {
  _id: string;
  event: { _id: string; title: string };
  checkInAt: string;
  role: string;
}

const priorityVariant = (priority: string) =>
  priority === 'urgent' ? 'danger' : priority === 'high' ? 'warning' : priority === 'medium' ? 'accent' : 'neutral';

export default function VolunteerHubPage() {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const groupsQuery = useQuery({
    queryKey: ['my-volunteer-groups'],
    queryFn: () => api.get<VolunteerGroup[]>('/volunteers/my-groups'),
  });
  const tasksQuery = useQuery({
    queryKey: ['my-volunteer-tasks'],
    queryFn: () => api.get<TaskItem[]>('/tasks/my'),
  });
  const checkInsQuery = useQuery({
    queryKey: ['my-event-check-ins'],
    queryFn: () => api.get<CheckInRow[]>('/event-attendance/me'),
  });

  const groups = groupsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const checkIns = checkInsQuery.data ?? [];

  const updateTaskStatus = async (task: TaskItem, status: string) => {
    setUpdatingId(task._id);
    try {
      await api.patch(`/tasks/${task._id}`, { status });
      toast.success(`Task marked ${titleCase(status).toLowerCase()}`);
      await tasksQuery.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUpdatingId(null);
    }
  };

  const openTasks = tasks.filter((task) => task.status !== 'completed');
  const completedTasks = tasks.filter((task) => task.status === 'completed');

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Volunteer hub"
        description="Your event duties, task list and check-ins."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/notifications">Notifications</Link>
          </Button>
        }
      />

      {checkInsQuery.isLoading && groupsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <CardSkeleton key={index} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <SectionCard
              title="My tasks"
              description={openTasks.length > 0 ? `${openTasks.length} open` : 'All caught up'}
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/tasks">All tasks</Link>
                </Button>
              }
              padded={false}
            >
              {tasksQuery.error ? (
                <div className="p-4">
                  <ErrorState error={tasksQuery.error} onRetry={() => void tasksQuery.refetch()} compact />
                </div>
              ) : tasks.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={ClipboardList}
                    title="No tasks assigned"
                    description="Coordinator tasks for your event will show up here."
                    compact
                  />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {[
                    ...openTasks,
                    ...completedTasks,
                  ].map((task) => (
                    <li key={task._id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-ink">
                          {task.title}
                          <Badge variant={priorityVariant(task.priority)} size="sm">{titleCase(task.priority)}</Badge>
                          {task.status === 'completed' ? (
                            <Badge variant="success" size="sm"><CheckCircle2 className="h-3 w-3" /> Done</Badge>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                          {task.event?.title ?? 'Event'}
                          {task.group?.name ? ` · ${task.group.name}` : ''}
                          {task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ''}
                        </p>
                      </div>
                      {task.status !== 'completed' ? (
                        <div className="w-full sm:w-44">
                          <Select
                            value={task.status}
                            onValueChange={(value) => void updateTaskStatus(task, value)}
                            disabled={updatingId === task._id}
                          >
                            <SelectTrigger className="h-8 text-[12px]" aria-label={`Update status for ${task.title}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in_progress">In progress</SelectItem>
                              <SelectItem value="blocked">Blocked</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="My volunteer groups" description="Events you are volunteering for" padded={false}>
              {groupsQuery.error ? (
                <div className="p-4">
                  <ErrorState error={groupsQuery.error} onRetry={() => void groupsQuery.refetch()} />
                </div>
              ) : groups.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={Users2}
                    title="Not part of a volunteer group yet"
                    description="Coordinators add volunteers to event groups. Reach out to the event coordinator to sign up."
                    compact
                  />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {groups.map((group) => (
                    <li key={group._id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[13px] font-medium text-ink">{group.name}</p>
                        <Badge variant={group.isActive ? 'success' : 'neutral'} size="sm">
                          {group.isActive ? 'Active' : 'Closed'}
                        </Badge>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" /> {group.event?.title ?? 'Event'}
                          {group.event?.startDate ? ` · ${formatDate(group.event.startDate)}` : ''}
                        </span>
                        {group.coordinator ? (
                          <span className="flex items-center gap-1">
                            <Users2 className="h-3 w-3" /> Coordinator {group.coordinator.name}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-[11px] text-subtle-foreground">
                        {group.members.length} volunteers
                        {group.leader ? ` · leader ${group.leader.name}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          <div className="space-y-4">
            <SectionCard title="Check-ins" description="Events you checked in to">
              {checkIns.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">No check-ins recorded yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {checkIns.slice(0, 8).map((checkIn) => (
                    <li key={checkIn._id} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium text-ink">{checkIn.event?.title ?? 'Event'}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDateTime(checkIn.checkInAt)} · {titleCase(checkIn.role)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <div className="rounded-card border border-line bg-surface p-4 shadow-soft">
              <p className="text-[12.5px] font-medium text-ink">How volunteering works</p>
              <ul className="mt-1.5 space-y-1 text-[11.5px] leading-relaxed text-muted-foreground">
                <li>• Coordinators add you to an event's volunteer group.</li>
                <li>• Tasks appear here with due dates and priorities.</li>
                <li>• Keep statuses updated so coordinators know what is done.</li>
              </ul>
              {groups[0] ? (
                <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
                  <Link href={`/dashboard/explore/detail?id=${groups[0].event?._id}`}>Open event</Link>
                </Button>
              ) : null}
            </div>

            {openTasks.some((task) => task.priority === 'urgent' || task.priority === 'high') ? (
              <div className="rounded-card border border-warning/25 bg-warning-soft p-4">
                <p className="text-[12px] font-medium text-warning">High priority tasks pending</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-warning/90">
                  You have {openTasks.filter((task) => task.priority === 'urgent' || task.priority === 'high').length} urgent or
                  high priority task(s). Update their status as you finish.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {tasks.some((task) => task.status === 'blocked') ? (
        <p className="mt-3 rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-[12px] text-danger">
          Some tasks are marked blocked — flag the reason to your coordinator so they can unblock you.
        </p>
      ) : null}

      <p className="mt-3 text-[11px] text-subtle-foreground">
        Need a task added? Contact the event coordinator — volunteer groups are managed by coordinators and admins.
      </p>
    </div>
  );
}
