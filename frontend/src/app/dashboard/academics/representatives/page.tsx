'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BadgeCheck, Plus, Trash2 } from 'lucide-react';
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
import { useAuth } from '@/providers/auth-provider';
import type { Section, Student } from '@/types/api';

const schema = z.object({
  studentId: z.string().min(1, 'Select a student'),
  sectionId: z.string().min(1, 'Select a section'),
  isPrimary: z.boolean(),
});
type FormInput = z.input<typeof schema>;
type Values = z.output<typeof schema>;

/**
 * The API returns each CR as a user with its responsibilities (section refs
 * populated) plus the student profile. A student can be CR of more than one
 * section, so the table flattens one row per (student, section) pair.
 */
interface CRUser {
  _id: string;
  name: string;
  email: string;
  responsibilities: Array<{
    _id?: string;
    type: string;
    section?: { _id: string; name: string } | string;
    isPrimary?: boolean;
    assignedAt?: string;
  }>;
  profile?: { enrollmentNumber?: string; section?: { _id: string; name: string } | string } | null;
}

interface CRRow {
  studentId: string;
  name: string;
  email: string;
  enrollmentNumber?: string;
  sectionId: string;
  sectionName: string;
  isPrimary: boolean;
  assignedAt?: string;
}

const flattenRepresentatives = (users: CRUser[] | undefined): CRRow[] =>
  (users ?? []).flatMap((user) =>
    (user.responsibilities ?? [])
      .filter((responsibility) => responsibility.type === 'cr' && responsibility.section)
      .map((responsibility) => {
        const section = responsibility.section;
        const sectionId = typeof section === 'object' ? section?._id ?? '' : section ?? '';
        const sectionName = typeof section === 'object' ? section?.name ?? '' : '';
        return {
          studentId: user._id,
          name: user.name,
          email: user.email,
          enrollmentNumber: user.profile?.enrollmentNumber,
          sectionId,
          sectionName,
          isPrimary: Boolean(responsibility.isPrimary),
          assignedAt: responsibility.assignedAt,
        };
      }),
  );

export default function RepresentativesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('cr:assign');
  const [open, setOpen] = useState(false);
  const [sectionId, setSectionId] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['class-representatives'],
    queryFn: () => api.get<CRUser[]>('/academic/class-representatives'),
  });

  const rows = flattenRepresentatives(data);

  const { data: sections } = useQuery({
    queryKey: ['sections'],
    queryFn: () => api.get<Section[]>('/academic/sections'),
    enabled: canManage,
  });

  const { data: students } = useQuery({
    queryKey: ['students-for-cr', sectionId],
    queryFn: () => api.getPaginated<Student>('/students', { params: { section: sectionId, limit: 100 } }),
    enabled: canManage && Boolean(sectionId),
  });

  const form = useForm<FormInput, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: { studentId: '', sectionId: '', isPrimary: false },
  });

  const assignMutation = useApiMutation({
    mutationFn: (values: Values) => api.post('/academic/class-representatives', values),
    invalidate: [['class-representatives'], ['sections'], ['students']],
    successMessage: 'Class representative assigned',
    onSuccess: () => {
      setOpen(false);
      setSectionId('');
      form.reset({ studentId: '', sectionId: '', isPrimary: false });
    },
  });

  const removeMutation = useApiMutation({
    mutationFn: ({ studentId: sid, sectionId: secId }: { studentId: string; sectionId: string }) =>
      api.delete(`/academic/class-representatives/${sid}/${secId}`),
    invalidate: [['class-representatives'], ['sections'], ['students']],
    successMessage: 'Class representative removed',
  });

  const columns: Column<CRRow>[] = [
    { key: 'student', header: 'Student', render: (row) => <PersonCell name={row.name} email={row.email} meta={row.enrollmentNumber} /> },
    { key: 'section', header: 'Section', render: (row) => <span className="text-[12.5px]">Section {row.sectionName}</span> },
    { key: 'primary', header: 'Role', render: (row) => <Badge variant={row.isPrimary ? 'primary' : 'neutral'}>{row.isPrimary ? 'Primary CR' : 'CR'}</Badge> },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (row: CRRow) => (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm" aria-label="Remove class representative">
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                }
                title="Remove class representative role?"
                description="The student keeps their account and academic records but loses CR privileges for this section."
                confirmLabel="Remove role"
                onConfirm={() => removeMutation.mutateAsync({ studentId: row.studentId, sectionId: row.sectionId })}
              />
            ),
          } satisfies Column<CRRow>,
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Academics"
        title="Class representatives"
        description="CRs are regular student accounts with extra responsibility for their own section."
        actions={canManage ? <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Assign CR</Button> : null}
      />

      <div className="rounded-card border border-line bg-surface shadow-soft">
        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          rowKey={(row) => `${row.studentId}-${row.sectionId}`}
          emptyIcon={BadgeCheck}
          emptyTitle="No class representatives"
          emptyDescription="Assign a student as the CR of their section to give them limited class oversight."
        />
      </div>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Assign class representative"
        description="The student must already belong to the selected section."
        submitLabel="Assign CR"
        submitting={assignMutation.isPending}
        size="sm"
        onSubmit={form.handleSubmit((values) => assignMutation.mutate(values))}
      >
        <FormField label="Section" htmlFor="cr-section" required error={form.formState.errors.sectionId?.message}>
          <Controller
            control={form.control}
            name="sectionId"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  setSectionId(value);
                  form.setValue('studentId', '');
                }}
              >
                <SelectTrigger id="cr-section" invalid={Boolean(form.formState.errors.sectionId)}><SelectValue placeholder="Select section" /></SelectTrigger>
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
        <FormField
          label="Student"
          htmlFor="cr-student"
          required
          error={form.formState.errors.studentId?.message}
          hint={!sectionId ? 'Select a section first' : undefined}
        >
          <Controller
            control={form.control}
            name="studentId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={!sectionId}>
                <SelectTrigger id="cr-student" invalid={Boolean(form.formState.errors.studentId)}>
                  <SelectValue placeholder={sectionId ? 'Select student' : 'Choose a section first'} />
                </SelectTrigger>
                <SelectContent>
                  {(students?.data ?? []).map((student) => (
                    <SelectItem key={student.user._id} value={student.user._id}>
                      {student.user.name} · {student.enrollmentNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
          <input type="checkbox" className="h-4 w-4 accent-[#3b76e8]" {...form.register('isPrimary')} />
          Mark as the primary class representative
        </label>
      </FormDialog>
    </div>
  );
}
