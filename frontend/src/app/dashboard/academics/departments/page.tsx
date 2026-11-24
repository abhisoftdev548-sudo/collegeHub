'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Pencil, Plus, Trash2, Users } from 'lucide-react';
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
import { api } from '@/lib/api';
import { titleCase } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Department, Teacher } from '@/types/api';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the department name').max(160),
  code: z.string().trim().min(2, 'Enter a short code').max(12).regex(/^[A-Za-z0-9-]+$/, 'Letters, numbers and hyphens only'),
  description: z.string().trim().max(2000).optional(),
  head: z.string().optional(),
  isActive: z.boolean(),
});

type Values = z.input<typeof schema>;

const defaults: Values = { name: '', code: '', description: '', head: '', isActive: true };

export default function DepartmentsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('department:manage');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Department | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['departments', search],
    queryFn: () => api.get<Department[]>('/academic/departments', { params: { search: search || undefined } }),
  });

  const { data: teachers } = useQuery({
    queryKey: ['teachers', 'options'],
    queryFn: () => api.getPaginated<Teacher>('/teachers', { params: { limit: 100 } }),
    enabled: canManage,
  });

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });

  const saveMutation = useApiMutation({
    mutationFn: (values: Values) => {
      // The API validates strictly: create accepts name/code/description/head,
      // update additionally accepts isActive.
      const createPayload = {
        name: values.name,
        code: values.code,
        description: values.description || undefined,
        head: values.head || '',
      };
      return editing
        ? api.patch<Department>(`/academic/departments/${editing._id}`, { ...createPayload, isActive: values.isActive })
        : api.post<Department>('/academic/departments', createPayload);
    },
    invalidate: [['departments'], ['dashboard']],
    successMessage: editing ? 'Department updated' : 'Department created',
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      form.reset(defaults);
    },
  });

  const deleteMutation = useApiMutation({
    mutationFn: (id: string) => api.delete(`/academic/departments/${id}`),
    invalidate: [['departments'], ['dashboard']],
    successMessage: 'Department deactivated',
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(defaults);
    setOpen(true);
  };

  const openEdit = (department: Department) => {
    setEditing(department);
    const headId = typeof department.head === 'object' ? department.head?._id : department.head;
    form.reset({
      name: department.name,
      code: department.code,
      description: department.description ?? '',
      head: headId ?? '',
      isActive: department.isActive,
    });
    setOpen(true);
  };

  const columns: Column<Department>[] = [
    {
      key: 'name',
      header: 'Department',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary-hover">
            <Building2 className="h-4 w-4" />
          </span>
          <div>
            <p className="font-medium text-ink">{row.name}</p>
            <p className="text-[11px] text-muted-foreground">{row.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'head',
      header: 'Head of department',
      render: (row) =>
        typeof row.head === 'object' && row.head ? (
          <span className="text-[12.5px] text-ink">{row.head.name}</span>
        ) : (
          <span className="text-[12.5px] text-subtle-foreground">Not assigned</span>
        ),
    },
    {
      key: 'stats',
      header: 'Courses / Students',
      render: (row) => (
        <span className="tabular-nums text-[12.5px]">
          {row.stats?.courses ?? 0} / {row.stats?.students ?? 0}
        </span>
      ),
    },
    {
      key: 'teachers',
      header: 'Faculty',
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-[12.5px]">
          <Users className="h-3.5 w-3.5 text-subtle-foreground" />
          {row.teachers?.length ?? 0}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={statusVariant(row.isActive ? 'active' : 'blocked')}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            headerClassName: 'text-right',
            className: 'text-right',
            render: (row: Department) => (
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
                  description="The department will be hidden from new enrolments. Existing students, courses and history are preserved."
                  confirmLabel="Deactivate"
                  onConfirm={() => deleteMutation.mutateAsync(row._id)}
                />
              </div>
            ),
          } satisfies Column<Department>,
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Academics"
        title="Departments"
        description="Faculties that group courses, faculty and students."
        actions={
          canManage ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> New department
            </Button>
          ) : null
        }
      />

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search departments…" className="mb-4" />

      <div className="rounded-card border border-line bg-surface shadow-soft">
        <DataTable
          columns={columns}
          rows={data}
          loading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          rowKey={(row) => row._id}
          emptyIcon={Building2}
          emptyTitle="No departments yet"
          emptyDescription="Create the first department to start adding courses and students."
          emptyAction={
            canManage ? (
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" /> New department
              </Button>
            ) : null
          }
        />
      </div>

      <FormDialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setEditing(null);
        }}
        title={editing ? 'Edit department' : 'New department'}
        description="Departments organise courses, faculty and students."
        submitLabel={editing ? 'Save changes' : 'Create department'}
        submitting={saveMutation.isPending}
        onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Department name" htmlFor="name" required error={form.formState.errors.name?.message}>
            <Input id="name" placeholder="Computer Science & Engineering" invalid={Boolean(form.formState.errors.name)} {...form.register('name')} />
          </FormField>
          <FormField label="Code" htmlFor="code" required error={form.formState.errors.code?.message} hint="Short code used in reports">
            <Input id="code" placeholder="CSE" className="uppercase" invalid={Boolean(form.formState.errors.code)} {...form.register('code')} />
          </FormField>
        </div>
        <FormField label="Description" htmlFor="description" error={form.formState.errors.description?.message}>
          <Textarea id="description" placeholder="What this department offers…" {...form.register('description')} />
        </FormField>
        <FormField label="Head of department" htmlFor="head" hint="Optional — must be an active teacher">
          <Controller
            control={form.control}
            name="head"
            render={({ field }) => (
              <Select value={field.value || 'none'} onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}>
                <SelectTrigger id="head">
                  <SelectValue placeholder="Not assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not assigned</SelectItem>
                  {(teachers?.data ?? []).map((teacher) => (
                    <SelectItem key={teacher._id} value={teacher._id}>
                      {teacher.name} · {titleCase(teacher.designation)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        {editing ? (
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface-subtle/60 px-3 py-2.5">
            <div>
              <p className="text-[12.5px] font-medium text-ink">Active</p>
              <p className="text-[11px] text-muted-foreground">Inactive departments are hidden from enrolment</p>
            </div>
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                  className="h-4 w-4 accent-[#3b76e8]"
                  aria-label="Active department"
                />
              )}
            />
          </div>
        ) : null}
      </FormDialog>
    </div>
  );
}
