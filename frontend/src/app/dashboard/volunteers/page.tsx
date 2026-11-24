'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Crown, Plus, Trash2, UserMinus, UserPlus, Users2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { FormField } from '@/components/shared/form-field';
import { FormDialog } from '@/components/shared/form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useApiMutation } from '@/components/shared/use-api-mutation';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CardSkeleton } from '@/components/ui/skeleton';
import { api, getErrorMessage } from '@/lib/api';
import { formatDate, initials, titleCase } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { EventItem, Student, VolunteerGroup } from '@/types/api';

const groupSchema = z.object({
  name: z.string().trim().min(2, 'Enter a group name').max(120),
  event: z.string().min(1, 'Select the event'),
  description: z.string().trim().max(1000).optional(),
});
type GroupInput = z.input<typeof groupSchema>;
type GroupValues = z.output<typeof groupSchema>;

export default function VolunteersPage() {
  const { hasAnyPermission } = useAuth();
  const canManage = hasAnyPermission('event:update', 'event:manage_volunteers');
  const [open, setOpen] = useState(false);
  const [assignTo, setAssignTo] = useState<VolunteerGroup | null>(null);
  const [studentId, setStudentId] = useState('');
  const [asLeader, setAsLeader] = useState(false);

  const groupsQuery = useQuery({
    queryKey: ['volunteer-groups'],
    queryFn: () => api.getPaginated<VolunteerGroup>('/volunteers/groups', { params: { limit: 50 } }),
  });
  const eventsQuery = useQuery({
    queryKey: ['events', 'for-volunteers'],
    queryFn: () => api.get<EventItem[]>('/events', { params: { limit: 100, includeSubEvents: true } }),
    enabled: canManage,
  });
  const studentsQuery = useQuery({
    queryKey: ['students', 'volunteer-picker'],
    queryFn: () => api.getPaginated<Student>('/students', { params: { limit: 200, status: 'active' } }),
    enabled: canManage && Boolean(assignTo),
  });

  const form = useForm<GroupInput, unknown, GroupValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: '', event: '', description: '' },
  });

  const createMutation = useApiMutation({
    mutationFn: (values: GroupValues) => api.post('/volunteers/groups', values),
    invalidate: [['volunteer-groups']],
    successMessage: 'Volunteer group created',
    onSuccess: () => {
      setOpen(false);
      form.reset({ name: '', event: '', description: '' });
    },
  });

  const deleteMutation = useApiMutation({
    mutationFn: (id: string) => api.delete(`/volunteers/groups/${id}`),
    invalidate: [['volunteer-groups']],
    successMessage: 'Volunteer group removed',
  });

  const assignMutation = useApiMutation({
    mutationFn: (payload: { groupId: string; studentId: string; asLeader: boolean }) =>
      api.post(`/volunteers/groups/${payload.groupId}/volunteers`, {
        studentId: payload.studentId,
        asLeader: payload.asLeader,
      }),
    invalidate: [['volunteer-groups']],
    successMessage: 'Volunteer assigned',
    onSuccess: () => {
      setAssignTo(null);
      setStudentId('');
      setAsLeader(false);
    },
  });

  const unassignMutation = useApiMutation({
    mutationFn: (payload: { groupId: string; studentId: string }) =>
      api.delete(`/volunteers/groups/${payload.groupId}/volunteers/${payload.studentId}`),
    invalidate: [['volunteer-groups']],
    successMessage: 'Volunteer removed from group',
  });

  const groups = groupsQuery.data?.data ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Volunteers"
        description="Organise student volunteers into groups per event, with a leader for each group."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New group
            </Button>
          ) : null
        }
      />

      {groupsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <CardSkeleton key={index} className="h-56" />
          ))}
        </div>
      ) : groupsQuery.error ? (
        <ErrorState error={groupsQuery.error} onRetry={() => void groupsQuery.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Users2}
          title="No volunteer groups yet"
          description="Create a group for an event, then add student volunteers and appoint a leader."
          action={
            canManage ? (
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> New group
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <SectionCard
              key={group._id}
              title={group.name}
              description={group.event?.title}
              action={
                <div className="flex items-center gap-1.5">
                  <Badge variant={statusVariant(group.isActive ? 'active' : 'blocked')} size="sm">
                    {group.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {canManage ? (
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="sm" aria-label={`Delete ${group.name}`}>
                          <Trash2 className="h-3.5 w-3.5 text-danger" />
                        </Button>
                      }
                      title={`Delete “${group.name}”?`}
                      description="Tasks linked to this group are preserved but lose the group reference."
                      confirmLabel="Delete group"
                      onConfirm={() => deleteMutation.mutateAsync(group._id)}
                    />
                  ) : null}
                </div>
              }
            >
              {group.description ? (
                <p className="mb-3 text-[12.5px] leading-relaxed text-muted-foreground">{group.description}</p>
              ) : null}

              <div className="mb-3 space-y-1.5 rounded-xl bg-surface-subtle/60 p-3">
                <p className="text-[11px] text-subtle-foreground">Coordinator</p>
                <p className="text-[12.5px] font-medium text-ink">{group.coordinator?.name ?? '—'}</p>
                {group.leader ? (
                  <>
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-subtle-foreground">
                      <Crown className="h-3 w-3 text-accent-foreground" /> Group leader
                    </p>
                    <p className="text-[12.5px] font-medium text-ink">{group.leader.name}</p>
                  </>
                ) : null}
                <p className="text-[11px] text-subtle-foreground">
                  Event: {group.event?.startDate ? formatDate(group.event.startDate) : '—'}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wide text-subtle-foreground">
                  Members ({group.members?.length ?? 0})
                </p>
                {canManage ? (
                  <Button variant="outline" size="sm" onClick={() => setAssignTo(group)}>
                    <UserPlus className="h-3.5 w-3.5" /> Add volunteer
                  </Button>
                ) : null}
              </div>

              {group.members?.length ? (
                <ul className="mt-2 divide-y divide-line">
                  {group.members.map((member) => (
                    <li key={member._id} className="flex items-center justify-between gap-2 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary-hover">
                          {initials(member.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] text-ink">{member.name}</p>
                          <p className="truncate text-[10.5px] text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      {canManage ? (
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="sm" aria-label={`Remove ${member.name}`}>
                              <UserMinus className="h-3.5 w-3.5 text-danger" />
                            </Button>
                          }
                          title={`Remove ${member.name} from this group?`}
                          description="Their assigned tasks stay in place but they will no longer be listed as a group volunteer."
                          confirmLabel="Remove"
                          onConfirm={() => unassignMutation.mutateAsync({ groupId: group._id, studentId: member._id })}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[12px] text-subtle-foreground">No volunteers assigned yet.</p>
              )}
            </SectionCard>
          ))}
        </div>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="New volunteer group"
        description="Groups belong to a single event and make task assignment simpler."
        submitLabel="Create group"
        submitting={createMutation.isPending}
        size="sm"
        onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
      >
        <FormField label="Group name" htmlFor="group-name" required error={form.formState.errors.name?.message}>
          <Input id="group-name" placeholder="Stage Management" invalid={Boolean(form.formState.errors.name)} {...form.register('name')} />
        </FormField>
        <FormField label="Event" htmlFor="group-event" required error={form.formState.errors.event?.message}>
          <Controller
            control={form.control}
            name="event"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="group-event" invalid={Boolean(form.formState.errors.event)}><SelectValue placeholder="Select event" /></SelectTrigger>
                <SelectContent>
                  {(eventsQuery.data ?? []).map((item) => (
                    <SelectItem key={item._id} value={item._id}>{item.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField label="Description" htmlFor="group-description">
          <Input id="group-description" placeholder="What this group handles" {...form.register('description')} />
        </FormField>
      </FormDialog>

      <FormDialog
        open={Boolean(assignTo)}
        onOpenChange={(value) => {
          if (!value) setAssignTo(null);
        }}
        title={`Add a volunteer to ${assignTo?.name ?? 'group'}`}
        description="Only students can be volunteers. A student can serve in multiple groups."
        submitLabel="Assign volunteer"
        submitting={assignMutation.isPending}
        size="sm"
        onSubmit={(event) => {
          event.preventDefault();
          if (!studentId || !assignTo) {
            toast.error('Select a student first');
            return;
          }
          assignMutation.mutate({ groupId: assignTo._id, studentId, asLeader });
        }}
      >
        <FormField label="Student" htmlFor="volunteer-student" required>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger id="volunteer-student">
              <SelectValue placeholder={studentsQuery.isLoading ? 'Loading students…' : 'Select student'} />
            </SelectTrigger>
            <SelectContent>
              {(studentsQuery.data?.data ?? []).map((student) => (
                <SelectItem key={student.user._id} value={student.user._id}>
                  {student.user.name} · {student.enrollmentNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
          <input
            type="checkbox"
            checked={asLeader}
            onChange={(event) => setAsLeader(event.target.checked)}
            className="h-4 w-4 accent-[#3b76e8]"
          />
          Appoint as group leader
        </label>
        <p className="rounded-lg bg-surface-subtle/70 px-3 py-2 text-[11.5px] text-muted-foreground">
          {studentsQuery.data?.pagination.total ?? 0} active students available
        </p>
      </FormDialog>
    </div>
  );
}
