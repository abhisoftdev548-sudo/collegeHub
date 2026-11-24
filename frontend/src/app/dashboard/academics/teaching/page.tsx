'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, UserCog } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { FormField } from '@/components/shared/form-field';
import { FormDialog } from '@/components/shared/form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useApiMutation } from '@/components/shared/use-api-mutation';
import { PersonCell } from '@/components/shared/person-cell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatDate, titleCase } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Section, Subject, Teacher } from '@/types/api';

interface TeachingAssignmentRow {
  _id: string;
  teacher: { _id: string; name: string; email: string; designation?: string };
  subject: { _id: string; name: string; code: string };
  section: { _id: string; name: string; semester?: { number: number } };
  isActive: boolean;
  createdAt: string;
}

const schema = z.object({
  teacher: z.string().min(1, 'Select a teacher'),
  subject: z.string().min(1, 'Select a subject'),
  section: z.string().min(1, 'Select a section'),
});
type FormInput = z.input<typeof schema>;
type Values = z.output<typeof schema>;

export default function TeachingAssignmentsPage() {
  const { hasAnyPermission } = useAuth();
  const canManage = hasAnyPermission('section:manage', 'subject:manage');
  const [open, setOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['teaching-assignments'],
    queryFn: () => api.get<TeachingAssignmentRow[]>('/academic/teaching-assignments'),
  });
  const { data: teachers } = useQuery({
    queryKey: ['teachers', 'options'],
    queryFn: () => api.getPaginated<Teacher>('/teachers', { params: { limit: 100 } }),
    enabled: canManage,
  });
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.get<Subject[]>('/academic/subjects'),
    enabled: canManage,
  });
  const { data: sections } = useQuery({
    queryKey: ['sections'],
    queryFn: () => api.get<Section[]>('/academic/sections'),
    enabled: canManage,
  });

  const form = useForm<FormInput, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: { teacher: '', subject: '', section: '' },
  });

  const createMutation = useApiMutation({
    mutationFn: (values: Values) => api.post('/academic/teaching-assignments', values),
    invalidate: [['teaching-assignments'], ['teachers'], ['sections']],
    successMessage: 'Teaching assignment created',
    onSuccess: () => {
      setOpen(false);
      form.reset({ teacher: '', subject: '', section: '' });
    },
  });

  const removeMutation = useApiMutation({
    mutationFn: (id: string) => api.delete(`/academic/teaching-assignments/${id}`),
    invalidate: [['teaching-assignments'], ['teachers']],
    successMessage: 'Teaching assignment removed',
  });

  const columns: Column<TeachingAssignmentRow>[] = [
    {
      key: 'teacher',
      header: 'Faculty',
      render: (row) => <PersonCell name={row.teacher?.name} email={row.teacher?.designation ? titleCase(row.teacher.designation) : row.teacher?.email} />,
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (row) => (
        <div>
          <p className="font-medium text-ink">{row.subject?.name}</p>
          <p className="text-[11px] text-muted-foreground">{row.subject?.code}</p>
        </div>
      ),
    },
    {
      key: 'section',
      header: 'Section',
      render: (row) => (
        <span className="text-[12.5px]">
          Section {row.section?.name}
          {row.section?.semester?.number ? ` · Sem ${row.section.semester.number}` : ''}
        </span>
      ),
    },
    { key: 'since', header: 'Assigned', render: (row) => <span className="text-[12px] text-muted-foreground">{formatDate(row.createdAt)}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={row.isActive ? 'success' : 'danger'}>{row.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (row: TeachingAssignmentRow) => (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm" aria-label="Remove assignment">
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                }
                title="Remove this teaching assignment?"
                description="The teacher will lose access to this subject and section. Attendance already recorded is preserved."
                confirmLabel="Remove"
                onConfirm={() => removeMutation.mutateAsync(row._id)}
              />
            ),
          } satisfies Column<TeachingAssignmentRow>,
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Academics"
        title="Teaching assignments"
        description="Which faculty teach which subject in which section. These drive teacher access and attendance sheets."
        actions={canManage ? <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Assign faculty</Button> : null}
      />

      <div className="rounded-card border border-line bg-surface shadow-soft">
        <DataTable
          columns={columns}
          rows={data}
          loading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          rowKey={(row) => row._id}
          emptyIcon={UserCog}
          emptyTitle="No teaching assignments"
          emptyDescription="Assign faculty to subjects and sections to enable attendance marking."
          emptyAction={canManage ? <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Assign faculty</Button> : null}
        />
      </div>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Assign faculty"
        description="Each assignment grants the teacher access to that subject and section."
        submitLabel="Create assignment"
        submitting={createMutation.isPending}
        size="sm"
        onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
      >
        <FormField label="Faculty" htmlFor="ta-teacher" required error={form.formState.errors.teacher?.message}>
          <Controller
            control={form.control}
            name="teacher"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="ta-teacher" invalid={Boolean(form.formState.errors.teacher)}><SelectValue placeholder="Select faculty" /></SelectTrigger>
                <SelectContent>
                  {(teachers?.data ?? []).map((teacher) => (
                    <SelectItem key={teacher._id} value={teacher._id}>{teacher.name} · {titleCase(teacher.designation)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField label="Subject" htmlFor="ta-subject" required error={form.formState.errors.subject?.message}>
          <Controller
            control={form.control}
            name="subject"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="ta-subject" invalid={Boolean(form.formState.errors.subject)}><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {(subjects ?? []).map((subject) => (
                    <SelectItem key={subject._id} value={subject._id}>{subject.code} · {subject.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField label="Section" htmlFor="ta-section" required error={form.formState.errors.section?.message}>
          <Controller
            control={form.control}
            name="section"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="ta-section" invalid={Boolean(form.formState.errors.section)}><SelectValue placeholder="Select section" /></SelectTrigger>
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
      </FormDialog>
    </div>
  );
}
