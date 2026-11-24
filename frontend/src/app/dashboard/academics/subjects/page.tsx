'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { FilterBar } from '@/components/shared/filter-bar';
import { FormField } from '@/components/shared/form-field';
import { FormDialog } from '@/components/shared/form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useApiMutation } from '@/components/shared/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import type { Course, Department, Subject } from '@/types/api';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the subject name').max(160),
  code: z.string().trim().min(2, 'Enter a subject code').max(24),
  course: z.string().min(1, 'Select a course'),
  semesterNumber: z.coerce.number().int().min(1).max(12),
  credits: z.coerce.number().min(0).max(20).optional(),
  description: z.string().trim().max(1000).optional(),
});

type FormInput = z.input<typeof schema>;
type Values = z.output<typeof schema>;

const defaults: FormInput = { name: '', code: '', course: '', semesterNumber: 1, credits: 4, description: '' };

export default function SubjectsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('subject:manage') || hasPermission('department:manage');
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [editing, setEditing] = useState<Subject | null>(null);
  const [open, setOpen] = useState(false);

  const { data: courses } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.get<Course[]>('/academic/courses'),
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['subjects', courseFilter],
    queryFn: () =>
      api.get<Subject[]>('/academic/subjects', {
        params: { course: courseFilter === 'all' ? undefined : courseFilter },
      }),
  });

  const filtered = data?.filter((subject) => {
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return `${subject.name} ${subject.code}`.toLowerCase().includes(needle);
  });

  const form = useForm<FormInput, unknown, Values>({ resolver: zodResolver(schema), defaultValues: defaults });

  const saveMutation = useApiMutation({
    mutationFn: (values: Values) => {
      const payload = {
        name: values.name,
        code: values.code,
        course: values.course,
        semesterNumber: values.semesterNumber,
        credits: values.credits,
        description: values.description || undefined,
      };
      return editing
        ? api.patch<Subject>(`/academic/subjects/${editing._id}`, payload)
        : api.post<Subject>('/academic/subjects', payload);
    },
    invalidate: [['subjects'], ['dashboard']],
    successMessage: editing ? 'Subject updated' : 'Subject created',
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      form.reset(defaults);
    },
  });

  const deleteMutation = useApiMutation({
    mutationFn: (id: string) => api.delete(`/academic/subjects/${id}`),
    invalidate: [['subjects']],
    successMessage: 'Subject deactivated',
  });

  const openEdit = (subject: Subject) => {
    setEditing(subject);
    form.reset({
      name: subject.name,
      code: subject.code,
      course: typeof subject.course === 'object' ? subject.course._id : subject.course,
      semesterNumber: subject.semesterNumber,
      credits: subject.credits ?? 0,
      description: '',
    });
    setOpen(true);
  };

  const columns: Column<Subject>[] = [
    {
      key: 'name',
      header: 'Subject',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary-hover">
            <BookOpen className="h-4 w-4" />
          </span>
          <div>
            <p className="font-medium text-ink">{row.name}</p>
            <p className="text-[11px] text-muted-foreground">{row.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'course',
      header: 'Course · Semester',
      render: (row) => (
        <span className="text-[12.5px]">
          {typeof row.course === 'object' ? row.course.name : 'Course'} · Sem {row.semesterNumber}
        </span>
      ),
    },
    { key: 'credits', header: 'Credits', render: (row) => <span className="tabular-nums text-[12.5px]">{row.credits ?? '—'}</span> },
    {
      key: 'teachers',
      header: 'Faculty',
      render: (row) =>
        row.teachers?.length ? (
          <div className="flex flex-wrap gap-1">
            {row.teachers.slice(0, 2).map((teacher) => (
              <Badge key={teacher._id} variant="neutral" size="sm">{teacher.name}</Badge>
            ))}
            {row.teachers.length > 2 ? <Badge variant="outline" size="sm">+{row.teachers.length - 2}</Badge> : null}
          </div>
        ) : (
          <span className="text-[12px] text-subtle-foreground">Unassigned</span>
        ),
    },
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
            render: (row: Subject) => (
              <div className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(row)} aria-label={`Edit ${row.name}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="sm" aria-label={`Deactivate ${row.name}`} disabled={!row.isActive}>
                      <Trash2 className="h-3.5 w-3.5 text-danger" />
                    </Button>
                  }
                  title={`Deactivate ${row.name}?`}
                  description="Teaching assignments and attendance history remain intact; the subject is hidden from new assignments."
                  confirmLabel="Deactivate"
                  onConfirm={() => deleteMutation.mutateAsync(row._id)}
                />
              </div>
            ),
          } satisfies Column<Subject>,
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Academics"
        title="Subjects"
        description="Subjects are attached to a course and semester, then assigned to faculty per section."
        actions={canManage ? <Button size="sm" onClick={() => { setEditing(null); form.reset(defaults); setOpen(true); }}><Plus className="h-4 w-4" /> New subject</Button> : null}
      />

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search subjects…" className="mb-4">
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="h-9 w-full text-[13px] sm:w-52">
            <SelectValue placeholder="All courses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All courses</SelectItem>
            {(courses ?? []).map((course) => (
              <SelectItem key={course._id} value={course._id}>{course.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <div className="rounded-card border border-line bg-surface shadow-soft">
        <DataTable
          columns={columns}
          rows={filtered}
          loading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          rowKey={(row) => row._id}
          emptyIcon={BookOpen}
          emptyTitle="No subjects yet"
          emptyDescription="Create subjects for each course and semester."
        />
      </div>

      <FormDialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setEditing(null);
        }}
        title={editing ? 'Edit subject' : 'New subject'}
        description="Subjects define the curriculum for a semester."
        submitLabel={editing ? 'Save changes' : 'Create subject'}
        submitting={saveMutation.isPending}
        onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Subject name" htmlFor="subject-name" required error={form.formState.errors.name?.message} className="sm:col-span-2">
            <Input id="subject-name" placeholder="Data Structures & Algorithms" invalid={Boolean(form.formState.errors.name)} {...form.register('name')} />
          </FormField>
          <FormField label="Code" htmlFor="subject-code" required error={form.formState.errors.code?.message}>
            <Input id="subject-code" placeholder="CS301" className="uppercase" invalid={Boolean(form.formState.errors.code)} {...form.register('code')} />
          </FormField>
          <FormField label="Course" htmlFor="subject-course" required error={form.formState.errors.course?.message}>
            <Controller
              control={form.control}
              name="course"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="subject-course" invalid={Boolean(form.formState.errors.course)}>
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {(courses ?? []).map((course) => (
                      <SelectItem key={course._id} value={course._id}>{course.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label="Semester number" htmlFor="subject-semester" required error={form.formState.errors.semesterNumber?.message}>
            <Input id="subject-semester" type="number" min={1} max={12} invalid={Boolean(form.formState.errors.semesterNumber)} {...form.register('semesterNumber')} />
          </FormField>
          <FormField label="Credits" htmlFor="subject-credits" error={form.formState.errors.credits?.message}>
            <Input id="subject-credits" type="number" min={0} max={20} step={0.5} {...form.register('credits')} />
          </FormField>
        </div>
        <FormField label="Description" htmlFor="subject-desc">
          <Textarea id="subject-desc" placeholder="Syllabus overview…" {...form.register('description')} />
        </FormField>
      </FormDialog>
    </div>
  );
}
