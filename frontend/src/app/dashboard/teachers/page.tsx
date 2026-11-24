'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, Plus, ShieldCheck, ShieldOff, UserCog } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, TableFooterBar, type Column } from '@/components/shared/data-table';
import { FilterBar } from '@/components/shared/filter-bar';
import { FormField } from '@/components/shared/form-field';
import { FormDialog } from '@/components/shared/form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PersonCell } from '@/components/shared/person-cell';
import { useApiMutation } from '@/components/shared/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatDate, titleCase } from '@/lib/utils';
import type { Department, Teacher } from '@/types/api';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the full name').max(120),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().max(20).optional(),
  designation: z.enum(['Professor', 'Associate Professor', 'Assistant Professor', 'Guest Faculty', 'Lab Instructor', 'HOD']),
  departmentId: z.string().min(1, 'Select a department'),
});

type FormInput = z.input<typeof schema>;
type Values = z.output<typeof schema>;

const DESIGNATIONS = ['Professor', 'Associate Professor', 'Assistant Professor', 'Guest Faculty', 'Lab Instructor', 'HOD'] as const;

export default function TeachersPage() {
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('all');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<Department[]>('/academic/departments'),
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['teachers', search, department, page],
    queryFn: () =>
      api.getPaginated<Teacher>('/teachers', {
        params: {
          search: search || undefined,
          department: department === 'all' ? undefined : department,
          page,
          limit: 12,
        },
      }),
  });

  const form = useForm<FormInput, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', designation: 'Assistant Professor', departmentId: '' },
  });

  const createMutation = useApiMutation({
    mutationFn: (values: Values) =>
      api.post<{ temporaryPassword?: string }>('/teachers', {
        name: values.name,
        email: values.email,
        phone: values.phone || undefined,
        designation: values.designation,
        departmentId: values.departmentId,
      }),
    invalidate: [['teachers'], ['departments'], ['dashboard']],
    successMessage: 'Faculty account created',
    onSuccess: (result) => {
      setOpen(false);
      const password = (result as { temporaryPassword?: string }).temporaryPassword;
      if (password) setCredentials({ email: form.getValues('email'), password });
      form.reset({ name: '', email: '', phone: '', designation: 'Assistant Professor', departmentId: '' });
    },
  });

  const resetMutation = useApiMutation({
    mutationFn: (id: string) => api.post<{ temporaryPassword: string }>(`/teachers/${id}/reset-password`),
    successMessage: 'Password reset',
    onSuccess: (result, id) => {
      const teacher = data?.data.find((item) => item._id === id);
      setCredentials({ email: teacher?.email ?? '', password: result.temporaryPassword });
    },
  });

  const suspensionMutation = useApiMutation({
    mutationFn: ({ id, suspend }: { id: string; suspend: boolean }) =>
      api.patch(`/teachers/${id}/suspension`, { suspended: suspend }),
    invalidate: [['teachers'], ['dashboard']],
    successMessage: 'Faculty status updated',
  });

  const columns: Column<Teacher>[] = [
    { key: 'teacher', header: 'Faculty', render: (row) => <PersonCell name={row.name} email={row.email} /> },
    { key: 'designation', header: 'Designation', render: (row) => <span className="text-[12.5px]">{row.designation ?? '—'}</span> },
    {
      key: 'departments',
      header: 'Departments',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.departments?.map((item) => (
            <Badge key={item._id} variant="neutral" size="sm">{item.code}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'load',
      header: 'Assignments',
      render: (row) => (
        <div className="text-[12px]">
          <span className="font-medium tabular-nums text-ink">{row.assignments ?? 0}</span>
          <span className="text-muted-foreground"> subjects</span>
          {row.extraPermissions?.length ? (
            <Badge variant="primary" size="sm" className="ml-1.5">
              +{row.extraPermissions.length} extra
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={statusVariant(row.status)}>{titleCase(row.status)}</Badge>,
    },
    {
      key: 'lastLogin',
      header: 'Last sign in',
      render: (row) => (
        <span className="text-[12px] text-muted-foreground">
          {row.lastLoginAt ? formatDate(row.lastLoginAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm" aria-label={`Reset password for ${row.name}`}>
                <KeyRound className="h-3.5 w-3.5" />
              </Button>
            }
            title={`Reset password for ${row.name}?`}
            description="A temporary password is generated and shown once. The faculty member must change it after signing in."
            confirmLabel="Reset password"
            destructive={false}
            onConfirm={() => resetMutation.mutateAsync(row._id)}
          />
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm" aria-label={row.status === 'active' ? `Suspend ${row.name}` : `Reactivate ${row.name}`}>
                {row.status === 'active' ? (
                  <ShieldOff className="h-3.5 w-3.5 text-danger" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                )}
              </Button>
            }
            title={row.status === 'active' ? `Suspend ${row.name}?` : `Reactivate ${row.name}?`}
            description={
              row.status === 'active'
                ? 'The faculty member will be unable to sign in. Assignments and attendance records are preserved.'
                : 'The faculty member regains access with all existing assignments.'
            }
            confirmLabel={row.status === 'active' ? 'Suspend' : 'Reactivate'}
            destructive={row.status === 'active'}
            onConfirm={() => suspensionMutation.mutateAsync({ id: row._id, suspend: row.status === 'active' })}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Faculty"
        description="Teaching staff accounts, department membership and teaching load."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add faculty
          </Button>
        }
      />

      {credentials ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3">
          <div>
            <p className="text-[12px] font-medium text-warning">Temporary credentials (shown once)</p>
            <p className="mt-1 font-mono text-[12.5px] text-ink">
              {credentials.email} — {credentials.password}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setCredentials(null)}>Dismiss</Button>
        </div>
      ) : null}

      <FilterBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Search faculty by name or email…"
        className="mb-4"
        onReset={() => {
          setSearch('');
          setDepartment('all');
          setPage(1);
        }}
      >
        <Select
          value={department}
          onValueChange={(value) => {
            setDepartment(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-full text-[13px] sm:w-52">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {(departments ?? []).map((item) => (
              <SelectItem key={item._id} value={item._id}>{item.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <div className="rounded-card border border-line bg-surface shadow-soft">
        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          rowKey={(row) => row._id}
          emptyIcon={UserCog}
          emptyTitle="No faculty found"
          emptyDescription="Add faculty accounts so they can be assigned to subjects and sections."
          footer={
            data ? (
              <TableFooterBar
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                total={data.pagination.total}
                onPageChange={setPage}
                label="faculty"
              />
            ) : null
          }
        />
      </div>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Add faculty"
        description="A faculty account is created with a temporary password."
        submitLabel="Create account"
        submitting={createMutation.isPending}
        onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Full name" htmlFor="teacher-name" required error={form.formState.errors.name?.message}>
            <Input id="teacher-name" placeholder="Dr. Anil Sharma" invalid={Boolean(form.formState.errors.name)} {...form.register('name')} />
          </FormField>
          <FormField label="Email" htmlFor="teacher-email" required error={form.formState.errors.email?.message}>
            <Input id="teacher-email" type="email" placeholder="name@pdpscollege.edu.in" invalid={Boolean(form.formState.errors.email)} {...form.register('email')} />
          </FormField>
          <FormField label="Phone" htmlFor="teacher-phone" error={form.formState.errors.phone?.message}>
            <Input id="teacher-phone" placeholder="+91 98765 43210" {...form.register('phone')} />
          </FormField>
          <FormField label="Designation" htmlFor="teacher-designation" required>
            <Controller
              control={form.control}
              name="designation"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="teacher-designation"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DESIGNATIONS.map((designation) => (
                      <SelectItem key={designation} value={designation}>{designation}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        </div>
        <FormField
          label="Primary department"
          required
          error={form.formState.errors.departmentId?.message}
          hint="Faculty see students and events inside their departments and assigned sections. More departments can be attached by the administrator afterwards."
        >
          <Controller
            control={form.control}
            name="departmentId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger invalid={Boolean(form.formState.errors.departmentId)}>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {(departments ?? []).map((item) => (
                    <SelectItem key={item._id} value={item._id}>{item.name}</SelectItem>
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
