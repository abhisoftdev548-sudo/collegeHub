'use client';

import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormField } from '@/components/shared/form-field';
import { FormDialog } from '@/components/shared/form-dialog';
import { useApiMutation } from '@/components/shared/use-api-mutation';
import { Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { titleCase, toDateInputValue } from '@/lib/utils';
import type { Department, DynamicForm, EventCategory, EventItem, Teacher } from '@/types/api';

const schema = z
  .object({
    title: z.string().trim().min(3, 'Enter an event title').max(200),
    description: z.string().trim().max(5000).optional(),
    category: z.string().min(1, 'Select a category'),
    department: z.string().optional(),
    parentEvent: z.string().optional(),
    isMainEvent: z.boolean(),
    coordinator: z.string().optional(),
    startDate: z.string().min(1, 'Select a start date'),
    endDate: z.string().min(1, 'Select an end date'),
    registrationDeadline: z.string().optional(),
    venue: z.string().trim().max(200).optional(),
    status: z.enum(['draft', 'published', 'ongoing', 'completed', 'cancelled']),
    participationRules: z.string().trim().max(3000).optional(),
    requirements: z.string().trim().max(3000).optional(),
    registrationEnabled: z.boolean(),
    requiresApproval: z.boolean(),
    maxParticipants: z.coerce.number().int().min(0).optional(),
    fee: z.coerce.number().min(0).max(100000),
    feeType: z.enum(['individual', 'team']),
    form: z.string().optional(),
    isPublic: z.boolean(),
  })
  .refine((values) => new Date(values.endDate) >= new Date(values.startDate), {
    message: 'The end date cannot be before the start date',
    path: ['endDate'],
  });

type FormInput = z.input<typeof schema>;
type Values = z.output<typeof schema>;

const defaults: FormInput = {
  title: '',
  description: '',
  category: '',
  department: '',
  parentEvent: '',
  isMainEvent: true,
  coordinator: '',
  startDate: '',
  endDate: '',
  registrationDeadline: '',
  venue: '',
  status: 'draft',
  participationRules: '',
  requirements: '',
  registrationEnabled: true,
  requiresApproval: false,
  maxParticipants: undefined,
  fee: 0,
  feeType: 'individual',
  form: '',
  isPublic: true,
};

const idOf = (value: unknown): string =>
  typeof value === 'object' && value !== null && '_id' in value ? String((value as { _id: string })._id) : String(value ?? '');

export const EventFormDialog = ({
  open,
  onOpenChange,
  categories,
  departments,
  teachers,
  forms,
  parentEvents,
  editing,
  defaultParentId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: EventCategory[];
  departments: Department[];
  teachers: Teacher[];
  forms: DynamicForm[];
  parentEvents: EventItem[];
  editing?: EventItem | null;
  defaultParentId?: string;
  onSaved: () => void;
}) => {
  const form = useForm<FormInput, unknown, Values>({ resolver: zodResolver(schema), defaultValues: defaults });

  const registrationEnabled = form.watch('registrationEnabled');
  const fee = form.watch('fee');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        title: editing.title,
        description: editing.description ?? '',
        category: idOf(editing.category),
        department: editing.department ? idOf(editing.department) : '',
        parentEvent: editing.parentEvent ? idOf(editing.parentEvent) : '',
        isMainEvent: editing.isMainEvent,
        coordinator: editing.coordinator ? idOf(editing.coordinator) : '',
        startDate: toDateInputValue(editing.startDate),
        endDate: toDateInputValue(editing.endDate),
        registrationDeadline: toDateInputValue(editing.registrationDeadline),
        venue: editing.venue ?? '',
        status: (editing.status as Values['status']) ?? 'draft',
        participationRules: editing.participationRules ?? '',
        requirements: editing.requirements ?? '',
        registrationEnabled: editing.registration?.isEnabled ?? true,
        requiresApproval: editing.registration?.requiresApproval ?? false,
        maxParticipants: editing.registration?.maxParticipants || undefined,
        fee: editing.registration?.fee ?? 0,
        feeType: editing.registration?.feeType ?? 'individual',
        form: editing.registration?.form ? idOf(editing.registration.form) : '',
        isPublic: editing.isPublic ?? true,
      });
    } else {
      form.reset({ ...defaults, parentEvent: defaultParentId ?? '', isMainEvent: !defaultParentId });
    }
  }, [open, editing, defaultParentId, form]);

  const categoryOptions = useMemo(() => categories.filter((category) => category.isActive !== false), [categories]);

  const saveMutation = useApiMutation({
    mutationFn: (values: Values) => {
      const payload = {
        title: values.title,
        description: values.description || undefined,
        category: values.category,
        department: values.department || undefined,
        parentEvent: values.parentEvent || undefined,
        isMainEvent: values.isMainEvent,
        coordinator: values.coordinator || undefined,
        startDate: new Date(values.startDate).toISOString(),
        endDate: new Date(values.endDate).toISOString(),
        registrationDeadline: values.registrationDeadline
          ? new Date(values.registrationDeadline).toISOString()
          : undefined,
        venue: values.venue || undefined,
        status: values.status,
        participationRules: values.participationRules || undefined,
        requirements: values.requirements || undefined,
        registration: {
          isEnabled: values.registrationEnabled,
          requiresApproval: values.requiresApproval,
          maxParticipants: values.maxParticipants || undefined,
          fee: values.fee,
          feeType: values.feeType,
          form: values.form || undefined,
        },
        isPublic: values.isPublic,
      };
      return editing
        ? api.patch<EventItem>(`/events/${editing._id}`, payload)
        : api.post<EventItem>('/events', payload);
    },
    invalidate: [['events'], ['dashboard'], ['public-events']],
    successMessage: editing ? 'Event updated' : 'Event created',
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
      form.reset(defaults);
    },
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit event' : 'Create event'}
      description="Events can hold sub-events, competitions and a registration form."
      submitLabel={editing ? 'Save changes' : 'Create event'}
      submitting={saveMutation.isPending}
      size="lg"
      onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Event title" htmlFor="event-title" required error={form.formState.errors.title?.message} className="sm:col-span-2">
          <Input id="event-title" placeholder="Annual Tech Fest 2026" invalid={Boolean(form.formState.errors.title)} {...form.register('title')} />
        </FormField>
        <FormField label="Category" htmlFor="event-category" required error={form.formState.errors.category?.message}>
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="event-category" invalid={Boolean(form.formState.errors.category)}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category._id} value={category._id}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField label="Department" htmlFor="event-department" hint="Optional — leave empty for college-wide events">
          <Controller
            control={form.control}
            name="department"
            render={({ field }) => (
              <Select value={field.value || 'none'} onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}>
                <SelectTrigger id="event-department"><SelectValue placeholder="College-wide" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">College-wide</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department._id} value={department._id}>{department.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField label="Start date" htmlFor="event-start" required error={form.formState.errors.startDate?.message}>
          <Input id="event-start" type="date" invalid={Boolean(form.formState.errors.startDate)} {...form.register('startDate')} />
        </FormField>
        <FormField label="End date" htmlFor="event-end" required error={form.formState.errors.endDate?.message}>
          <Input id="event-end" type="date" invalid={Boolean(form.formState.errors.endDate)} {...form.register('endDate')} />
        </FormField>
        <FormField label="Registration deadline" htmlFor="event-deadline" error={form.formState.errors.registrationDeadline?.message}>
          <Input id="event-deadline" type="date" {...form.register('registrationDeadline')} />
        </FormField>
        <FormField label="Venue" htmlFor="event-venue">
          <Input id="event-venue" placeholder="Main Auditorium" {...form.register('venue')} />
        </FormField>
        <FormField label="Status" htmlFor="event-status" required hint="Draft events are hidden from students">
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="event-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['draft', 'published', 'ongoing', 'completed', 'cancelled'] as const).map((status) => (
                    <SelectItem key={status} value={status}>{titleCase(status)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField label="Parent event" htmlFor="event-parent" hint="Select a parent to make this a sub-event">
          <Controller
            control={form.control}
            name="parentEvent"
            render={({ field }) => (
              <Select
                value={field.value || 'none'}
                onValueChange={(value) => {
                  field.onChange(value === 'none' ? '' : value);
                  form.setValue('isMainEvent', value === 'none');
                }}
              >
                <SelectTrigger id="event-parent"><SelectValue placeholder="Standalone event" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Standalone event</SelectItem>
                  {parentEvents
                    .filter((event) => event._id !== editing?._id)
                    .map((event) => (
                      <SelectItem key={event._id} value={event._id}>{event.title}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField label="Coordinator" htmlFor="event-coordinator">
          <Controller
            control={form.control}
            name="coordinator"
            render={({ field }) => (
              <Select value={field.value || 'none'} onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}>
                <SelectTrigger id="event-coordinator"><SelectValue placeholder="Not assigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not assigned</SelectItem>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher._id} value={teacher._id}>{teacher.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </div>

      <FormField label="Description" htmlFor="event-description">
        <Textarea id="event-description" placeholder="What happens at this event?" {...form.register('description')} />
      </FormField>

      <fieldset className="rounded-xl border border-line p-3.5">
        <legend className="px-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle-foreground">
          Registration
        </legend>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
              <input type="checkbox" className="h-4 w-4 accent-[#3b76e8]" {...form.register('registrationEnabled')} />
              Registration open
            </label>
            <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
              <input type="checkbox" className="h-4 w-4 accent-[#3b76e8]" {...form.register('requiresApproval')} />
              Requires coordinator approval
            </label>
            <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
              <input type="checkbox" className="h-4 w-4 accent-[#3b76e8]" {...form.register('isPublic')} />
              Visible on the public site
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Fee (₹)" htmlFor="event-fee" required hint={Number(fee) > 0 ? 'Payment required' : 'Free event'}>
              <Input id="event-fee" type="number" min={0} max={100000} {...form.register('fee')} />
            </FormField>
            <FormField label="Fee basis" htmlFor="event-feetype">
              <Controller
                control={form.control}
                name="feeType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="event-feetype"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Per participant</SelectItem>
                      <SelectItem value="team">Per team</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="Capacity" htmlFor="event-capacity" hint="Empty = unlimited">
              <Input id="event-capacity" type="number" min={0} placeholder="Unlimited" {...form.register('maxParticipants')} />
            </FormField>
          </div>
          {registrationEnabled ? (
            <FormField label="Registration form" htmlFor="event-form" hint="Optional — collect extra details from participants">
              <Controller
                control={form.control}
                name="form"
                render={({ field }) => (
                  <Select value={field.value || 'none'} onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}>
                    <SelectTrigger id="event-form"><SelectValue placeholder="No additional form" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No additional form</SelectItem>
                      {forms.map((item) => (
                        <SelectItem key={item._id} value={item._id}>{item.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          ) : null}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Participation rules" htmlFor="event-rules">
          <Textarea id="event-rules" placeholder="Eligibility and rules…" {...form.register('participationRules')} />
        </FormField>
        <FormField label="Requirements" htmlFor="event-requirements">
          <Textarea id="event-requirements" placeholder="Things participants must bring…" {...form.register('requirements')} />
        </FormField>
      </div>
    </FormDialog>
  );
};
