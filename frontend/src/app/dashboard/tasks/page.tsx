'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarClock, ListChecks, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { FilterBar } from '@/components/shared/filter-bar';
import { FormField } from '@/components/shared/form-field';
import { FormDialog } from '@/components/shared/form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useApiMutation } from '@/components/shared/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, getErrorMessage } from '@/lib/api';
import { formatDate, titleCase } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { EventItem, TaskItem, VolunteerGroup } from '@/types/api';

const schema = z.object({
  title: z.string().trim().min(2, 'Enter a task title').max(200),
  description: z.string().trim().max(2000).optional(),
  event: z.string().min(1, 'Select the event'),
  group: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  dueDate: z.string().optional(),
});
type FormInput = z.input<typeof schema>;
type Values = z.output<typeof schema>;

const defaults: FormInput = { title: '', description: '', event: '', group: '', priority: 'medium', dueDate: '' };

const PRIORITY_VARIANT = {
  low: 'neutral',
  medium: 'primary',
  high: 'warning',
  urgent: 'danger',
} as const;

export default function TasksPage() {
  const { hasAnyPermission, user } = useAuth();
  const canManage = hasAnyPermission('task:manage', 'event:manage_volunteers');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [open, setOpen] = useState(false);

  const tasksQuery = useQuery({
    queryKey: ['tasks', search, status],
    queryFn: () =>
      api.getPaginated<TaskItem>('/tasks', {
        params: { limit: 100, search: search || undefined, status: status === 'all' ? undefined : status },
      }),
  });
  const eventsQuery = useQuery({
    queryKey: ['events', 'for-tasks'],
    queryFn: () => api.get<EventItem[]>('/events', { params: { limit: 100, includeSubEvents: true } }),
    enabled: canManage,
  });
  const groupsQuery = useQuery({
    queryKey: ['volunteer-groups'],
    queryFn: () => api.getPaginated<VolunteerGroup>('/volunteers/groups', { params: { limit: 50 } }),
    enabled: canManage,
  });

  const form = useForm<FormInput, unknown, Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  const selectedEvent = form.watch('event');

  const createMutation = useApiMutation({
    mutationFn: (values: Values) =>
      api.post('/tasks', {
        title: values.title,
        description: values.description || undefined,
        event: values.event,
        group: values.group || undefined,
        priority: values.priority,
        dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
      }),
    invalidate: [['tasks'], ['dashboard']],
    successMessage: 'Task created',
    onSuccess: () => {
      setOpen(false);
      form.reset(defaults);
    },
  });

  const statusMutation = useApiMutation({
    mutationFn: (payload: { id: string; status: string }) =>
      api.patch(`/tasks/${payload.id}`, { status: payload.status }),
    invalidate: [['tasks'], ['dashboard']],
    successMessage: 'Task updated',
  });

  const deleteMutation = useApiMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    invalidate: [['tasks']],
    successMessage: 'Task deleted',
  });

  const columns: Column<TaskItem>[] = [
    {
      key: 'title',
      header: 'Task',
      render: (row) => (
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-hover">
            <ListChecks className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="font-medium text-ink">{row.title}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.event?.title}
              {row.group ? ` · ${row.group.name}` : ''}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'assignees',
      header: 'Assigned to',
      render: (row) =>
        row.assignedTo?.length ? (
          <div className="flex flex-wrap gap-1">
            {row.assignedTo.slice(0, 3).map((assignee) => (
              <Badge key={assignee._id} variant="neutral" size="sm">{assignee.name}</Badge>
            ))}
            {row.assignedTo.length > 3 ? <Badge variant="outline" size="sm">+{row.assignedTo.length - 3}</Badge> : null}
          </div>
        ) : (
          <span className="text-[12px] text-subtle-foreground">Unassigned</span>
        ),
    },
    { key: 'priority', header: 'Priority', render: (row) => <Badge variant={PRIORITY_VARIANT[row.priority]}>{titleCase(row.priority)}</Badge> },
    {
      key: 'due',
      header: 'Due',
      render: (row) =>
        row.dueDate ? (
          <span className="inline-flex items-center gap-1 text-[12px] text-ink-soft">
            <CalendarClock className="h-3 w-3 text-subtle-foreground" />
            {formatDate(row.dueDate)}
          </span>
        ) : (
          <span className="text-[11.5px] text-subtle-foreground">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={statusVariant(row.status)}>{titleCase(row.status)}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => {
        const canUpdate = canManage || row.assignedTo?.some((assignee) => assignee._id === user?.id);
        const nextStatus =
          row.status === 'completed' ? 'pending' : row.status === 'pending' ? 'in_progress' : 'completed';
        return (
          <div className="flex items-center justify-end gap-1">
            {canUpdate ? (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await statusMutation.mutateAsync({ id: row._id, status: nextStatus });
                  } catch (error) {
                    toast.error(getErrorMessage(error));
                  }
                }}
              >
                {row.status === 'completed' ? 'Reopen' : row.status === 'pending' ? 'Start' : 'Complete'}
              </Button>
            ) : null}
            {canManage ? (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm" aria-label={`Delete ${row.title}`}>
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                }
                title={`Delete “${row.title}”?`}
                description="The task and its update history will be removed."
                confirmLabel="Delete task"
                onConfirm={() => deleteMutation.mutateAsync(row._id)}
              />
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Tasks"
        description="Event duties with owners, priorities and deadlines."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New task
            </Button>
          ) : null
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search tasks…"
        className="mb-4"
        onReset={() => {
          setSearch('');
          setStatus('all');
        }}
      >
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-full text-[13px] sm:w-40">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {['pending', 'in_progress', 'completed', 'blocked'].map((value) => (
              <SelectItem key={value} value={value}>{titleCase(value)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <div className="rounded-card border border-line bg-surface shadow-soft">
        <DataTable
          columns={columns}
          rows={tasksQuery.data?.data}
          loading={tasksQuery.isLoading}
          error={tasksQuery.error}
          onRetry={() => void tasksQuery.refetch()}
          rowKey={(row) => row._id}
          emptyIcon={ListChecks}
          emptyTitle="No tasks yet"
          emptyDescription="Create tasks for event volunteers and coordinators."
          emptyAction={
            canManage ? <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New task</Button> : null
          }
        />
      </div>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="New task"
        description="Tasks can be assigned to a volunteer group or individual volunteers."
        submitLabel="Create task"
        submitting={createMutation.isPending}
        onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
      >
        <FormField label="Task title" htmlFor="task-title" required error={form.formState.errors.title?.message}>
          <Input id="task-title" placeholder="Set up registration desk" invalid={Boolean(form.formState.errors.title)} {...form.register('title')} />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Event" htmlFor="task-event" required error={form.formState.errors.event?.message}>
            <Controller
              control={form.control}
              name="event"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue('group', '');
                  }}
                >
                  <SelectTrigger id="task-event" invalid={Boolean(form.formState.errors.event)}><SelectValue placeholder="Select event" /></SelectTrigger>
                  <SelectContent>
                    {(eventsQuery.data ?? []).map((item) => (
                      <SelectItem key={item._id} value={item._id}>{item.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label="Volunteer group" htmlFor="task-group" hint="Optional">
            <Controller
              control={form.control}
              name="group"
              render={({ field }) => (
                <Select value={field.value || 'none'} onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}>
                  <SelectTrigger id="task-group"><SelectValue placeholder="No group" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No group</SelectItem>
                    {(groupsQuery.data?.data ?? [])
                      .filter((group) => !selectedEvent || group.event?._id === selectedEvent)
                      .map((group) => (
                        <SelectItem key={group._id} value={group._id}>{group.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label="Priority" htmlFor="task-priority" required>
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="task-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['low', 'medium', 'high', 'urgent'] as const).map((value) => (
                      <SelectItem key={value} value={value}>{titleCase(value)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label="Due date" htmlFor="task-due">
            <Input id="task-due" type="date" {...form.register('dueDate')} />
          </FormField>
        </div>
        <FormField label="Description" htmlFor="task-description">
          <Textarea id="task-description" rows={3} placeholder="What needs to be done?" {...form.register('description')} />
        </FormField>
      </FormDialog>
    </div>
  );
}
