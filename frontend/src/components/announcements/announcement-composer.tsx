'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Megaphone, Send } from 'lucide-react';
import { FormField } from '@/components/shared/form-field';
import { FormDialog } from '@/components/shared/form-dialog';
import { useApiMutation } from '@/components/shared/use-api-mutation';
import { Switch } from '@/components/ui/switch';
import { Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { titleCase } from '@/lib/utils';
import type { Announcement, Department, EventItem, Section } from '@/types/api';

const AUDIENCES = ['college', 'department', 'section', 'event'] as const;
type Audience = (typeof AUDIENCES)[number];

const schema = z.object({
  title: z.string().trim().min(3, 'Enter a title').max(200),
  body: z.string().trim().min(10, 'Write at least a sentence').max(5000),
  audience: z.enum(AUDIENCES),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  department: z.string().optional(),
  section: z.string().optional(),
  event: z.string().optional(),
  publishNow: z.boolean(),
});
type FormInput = z.input<typeof schema>;
type Values = z.output<typeof schema>;

const defaults: FormInput = {
  title: '',
  body: '',
  audience: 'college',
  priority: 'normal',
  department: '',
  section: '',
  event: '',
  publishNow: true,
};

export const AnnouncementComposer = ({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Announcement | null;
  onSaved: () => void;
}) => {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<FormInput, unknown, Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  const audience = form.watch('audience');

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<Department[]>('/academic/departments'),
    enabled: open,
  });
  const { data: sections } = useQuery({
    queryKey: ['sections'],
    queryFn: () => api.get<Section[]>('/academic/sections'),
    enabled: open,
  });
  const { data: events } = useQuery({
    queryKey: ['events', 'for-announcements'],
    queryFn: () => api.get<EventItem[]>('/events', { params: { limit: 100, includeSubEvents: true } }),
    enabled: open,
  });

  const saveMutation = useApiMutation({
    mutationFn: (values: Values) => {
      const payload: Record<string, unknown> = {
        title: values.title,
        body: values.body,
        audience: values.audience,
        priority: values.priority,
        published: values.publishNow,
      };
      if (values.audience === 'department') payload.department = values.department;
      if (values.audience === 'section') payload.section = values.section;
      if (values.audience === 'event') payload.event = values.event;
      return editing
        ? api.patch<Announcement>(`/announcements/${editing._id}`, payload)
        : api.post<Announcement>('/announcements', payload);
    },
    invalidate: [['announcements'], ['notifications']],
    successMessage: editing ? 'Announcement updated' : 'Announcement published',
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
      form.reset(defaults);
    },
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) {
          form.reset({
            ...defaults,
            title: editing?.title ?? '',
            body: editing?.body ?? '',
            audience: (editing?.audience as Audience) ?? 'college',
            priority: (editing?.priority as Values['priority']) ?? 'normal',
          });
        }
      }}
      title={editing ? 'Edit announcement' : 'New announcement'}
      description="Announcements notify everyone in the selected audience."
      submitLabel={editing ? 'Save changes' : 'Publish'}
      submitting={saveMutation.isPending}
      onSubmit={form.handleSubmit((values) => {
        setSubmitError(null);
        if (values.audience === 'department' && !values.department) {
          setSubmitError('Select a department for this announcement');
          return;
        }
        if (values.audience === 'section' && !values.section) {
          setSubmitError('Select a section for this announcement');
          return;
        }
        if (values.audience === 'event' && !values.event) {
          setSubmitError('Select an event for this announcement');
          return;
        }
        saveMutation.mutate(values);
      })}
    >
      <FormField label="Title" htmlFor="announcement-title" required error={form.formState.errors.title?.message}>
        <Input id="announcement-title" placeholder="Unit test schedule released" invalid={Boolean(form.formState.errors.title)} {...form.register('title')} />
      </FormField>

      <FormField label="Message" htmlFor="announcement-body" required error={form.formState.errors.body?.message}>
        <Textarea id="announcement-body" rows={5} placeholder="Write the announcement…" invalid={Boolean(form.formState.errors.body)} {...form.register('body')} />
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Audience" htmlFor="announcement-audience" required>
          <Controller
            control={form.control}
            name="audience"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="announcement-audience"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value === 'college' ? 'Entire college' : titleCase(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField label="Priority" htmlFor="announcement-priority" required>
          <Controller
            control={form.control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="announcement-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['low', 'normal', 'high', 'urgent'] as const).map((value) => (
                    <SelectItem key={value} value={value}>{titleCase(value)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </div>

      {audience === 'department' ? (
        <FormField label="Department" htmlFor="announcement-department" required>
          <Controller
            control={form.control}
            name="department"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="announcement-department"><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {(departments ?? []).map((department) => (
                    <SelectItem key={department._id} value={department._id}>{department.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      ) : null}

      {audience === 'section' ? (
        <FormField label="Section" htmlFor="announcement-section" required>
          <Controller
            control={form.control}
            name="section"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="announcement-section"><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent>
                  {(sections ?? []).map((section) => (
                    <SelectItem key={section._id} value={section._id}>
                      Section {section.name} · {typeof section.course === 'object' ? section.course.code : ''} · Sem{' '}
                      {typeof section.semester === 'object' ? section.semester.number : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      ) : null}

      {audience === 'event' ? (
        <FormField label="Event" htmlFor="announcement-event" required>
          <Controller
            control={form.control}
            name="event"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="announcement-event"><SelectValue placeholder="Select event" /></SelectTrigger>
                <SelectContent>
                  {(events ?? []).map((event) => (
                    <SelectItem key={event._id} value={event._id}>{event.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      ) : null}

      <div className="flex items-center justify-between rounded-xl border border-line bg-surface-subtle/50 px-3 py-2.5">
        <div>
          <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
            <Megaphone className="h-3.5 w-3.5 text-primary" /> Publish immediately
          </p>
          <p className="text-[11px] text-muted-foreground">Turn off to keep it as a draft</p>
        </div>
        <Controller
          control={form.control}
          name="publishNow"
          render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
        />
      </div>

      {submitError ? (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-[11.5px] text-danger" role="alert">{submitError}</p>
      ) : null}

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-subtle-foreground">
        <Send className="mt-0.5 h-3 w-3 shrink-0" />
        Publishing fans out in-app notifications to every member of the audience.
      </p>
    </FormDialog>
  );
};
