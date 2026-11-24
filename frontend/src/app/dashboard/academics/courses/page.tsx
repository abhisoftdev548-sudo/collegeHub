'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { titleCase } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Course, Department } from '@/types/api';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the course name').max(160),
  code: z.string().trim().min(2, 'Enter a course code').max(16),
  department: z.string().min(1, 'Select a department'),
  description: z.string().trim().max(2000).optional(),
  durationYears: z.coerce.number().int().min(1).max(6),
  totalSemesters: z.coerce.number().int().min(1).max(12),
  degreeLevel: z.enum(['undergraduate', 'postgraduate', 'diploma', 'certificate']),
});

type FormInput = z.input<typeof schema>;
type Values = z.output<typeof schema>;

const defaults: FormInput = {
  name: '',
  code: '',
  department: '',
  description: '',
  durationYears: 4,
  totalSemesters: 8,
  degreeLevel: 'undergraduate',
};

export default function CoursesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('course:manage');
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [editing, setEditing] = useState<Course | null>(null);
  const [open, setOpen] = useState(false);

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<Department[]>('/academic/departments'),
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['courses', search, departmentFilter],
    queryFn: () =>
      api.get<Course[]>('/academic/courses', {
        params: {
          search: search || undefined,
          department: departmentFilter === 'all' ? undefined : departmentFilter,
        },
      }),
  });

  const form = useForm<FormInput, unknown, Values>({ resolver: zodResolver(schema), defaultValues: defaults });

  const saveMutation = useApiMutation({
    mutationFn: (values: Values) => {
      const payload = {
        name: values.name,
        code: values.code,
        department: values.department,
        description: values.description || undefined,
        durationYears: values.durationYears,
        totalSemesters: values.totalSemesters,
        degreeLevel: values.degreeLevel,
      };
      return editing
        ? api.patch<Course>(`/academic/courses/${editing._id}`, payload)
        : api.post<Course>('/academic/courses', payload);
    },
    invalidate: [['courses'], ['dashboard']],
    successMessage: editing ? 'Course updated' : 'Course created',
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      form.reset(defaults);
    },
  });

  const deleteMutation = useApiMutation({
    mutationFn: (id: string) => api.delete(`/academic/courses/${id}`),
    invalidate: [['courses']],
    successMessage: 'Course deactivated',
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(defaults);
    setOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditing(course);
    form.reset({
      name: course.name,
      code: course.code,
      department: typeof course.department === 'object' ? course.department._id : course.department,
      description: '',
      durationYears: course.durationYears,
      totalSemesters: course.totalSemesters,
      degreeLevel: (course.degreeLevel as Values['degreeLevel']) ?? 'undergraduate',
    });
    setOpen(true);
  };

  const columns: Column<Course>[] = [
    {
      key: 'name',
      header: 'Course',
      render: (row) => (
        <div>
          <p className="font-medium text-ink">{row.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {row.code} · {typeof row.department === 'object' ? row.department.name : 'Department'}
          </p>
        </div>
      ),
    },
    { key: 'level', header: 'Level', render: (row) => <Badge variant="neutral">{titleCase(row.degreeLevel)}</Badge> },
    {
      key: 'duration',
      header: 'Duration',
      render: (row) => <span className="text-[12.5px]">{row.durationYears} yr · {row.totalSemesters} semesters</span>,
    },
    {
      key: 'stats',
      header: 'Sections / Students',
      render: (row) => (
        <span className="tabular-nums text-[12.5px]">{row.stats?.sections ?? 0} / {row.stats?.students ?? 0}</span>
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
            render: (row: Course) => (
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
                  description="Students, sections and academic history are unaffected. The course will no longer accept new enrolments."
                  confirmLabel="Deactivate"
                  onConfirm={() => deleteMutation.mutateAsync(row._id)}
                />
              </div>
            ),
          } satisfies Column<Course>,
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Academics"
        title="Courses"
        description="Degree and diploma programmes offered by each department."
        actions={canManage ? <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> New course</Button> : null}
      />

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search courses…" className="mb-4">
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="h-9 w-full text-[13px] sm:w-52">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {(departments ?? []).map((department) => (
              <SelectItem key={department._id} value={department._id}>
                {department.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <div className="rounded-card border border-line bg-surface shadow-soft">
        <DataTable
          columns={columns}
          rows={data}
          loading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          rowKey={(row) => row._id}
          emptyIcon={GraduationCap}
          emptyTitle="No courses yet"
          emptyDescription="Add a course to a department to begin creating semesters and sections."
          emptyAction={canManage ? <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> New course</Button> : null}
        />
      </div>

      <FormDialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setEditing(null);
        }}
        title={editing ? 'Edit course' : 'New course'}
        description="Semesters are generated from the course structure."
        submitLabel={editing ? 'Save changes' : 'Create course'}
        submitting={saveMutation.isPending}
        onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Course name" htmlFor="course-name" required error={form.formState.errors.name?.message} className="sm:col-span-2">
            <Input id="course-name" placeholder="B.Tech Computer Science" invalid={Boolean(form.formState.errors.name)} {...form.register('name')} />
          </FormField>
          <FormField label="Code" htmlFor="course-code" required error={form.formState.errors.code?.message}>
            <Input id="course-code" placeholder="BTECH-CS" className="uppercase" invalid={Boolean(form.formState.errors.code)} {...form.register('code')} />
          </FormField>
          <FormField label="Department" htmlFor="course-department" required error={form.formState.errors.department?.message}>
            <Controller
              control={form.control}
              name="department"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="course-department" invalid={Boolean(form.formState.errors.department)}>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {(departments ?? []).map((department) => (
                      <SelectItem key={department._id} value={department._id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label="Degree level" htmlFor="course-level" required>
            <Controller
              control={form.control}
              name="degreeLevel"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="course-level"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['undergraduate', 'postgraduate', 'diploma', 'certificate'] as const).map((level) => (
                      <SelectItem key={level} value={level}>{titleCase(level)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label="Duration (years)" htmlFor="course-years" required error={form.formState.errors.durationYears?.message}>
            <Input id="course-years" type="number" min={1} max={6} invalid={Boolean(form.formState.errors.durationYears)} {...form.register('durationYears')} />
          </FormField>
          <FormField label="Total semesters" htmlFor="course-sems" required error={form.formState.errors.totalSemesters?.message} className="sm:col-span-2">
            <Input id="course-sems" type="number" min={1} max={12} invalid={Boolean(form.formState.errors.totalSemesters)} {...form.register('totalSemesters')} />
          </FormField>
        </div>
        <FormField label="Description" htmlFor="course-desc">
          <Textarea id="course-desc" placeholder="Programme highlights…" {...form.register('description')} />
        </FormField>
      </FormDialog>
    </div>
  );
}
