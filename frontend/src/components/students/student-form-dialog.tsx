'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Copy, KeyRound } from 'lucide-react';
import { FormField } from '@/components/shared/form-field';
import { FormDialog } from '@/components/shared/form-dialog';
import { useApiMutation } from '@/components/shared/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import type { AcademicSession, Department, Section, Student } from '@/types/api';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the student name').max(120),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().max(20).optional(),
  enrollmentNumber: z.string().trim().min(3, 'Enter the enrolment number').max(30),
  rollNumber: z.string().trim().max(30).optional(),
  section: z.string().min(1, 'Select a section'),
  admissionYear: z.coerce.number().int().min(1990).max(2100),
  guardianName: z.string().trim().max(120).optional(),
  guardianPhone: z.string().trim().max(20).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  address: z.string().trim().max(500).optional(),
  bloodGroup: z.string().trim().max(8).optional(),
  dateOfBirth: z.string().optional(),
});

type FormInput = z.input<typeof schema>;
type Values = z.output<typeof schema>;

const currentYear = new Date().getFullYear();
const defaults: FormInput = {
  name: '',
  email: '',
  phone: '',
  enrollmentNumber: '',
  rollNumber: '',
  section: '',
  admissionYear: currentYear,
  guardianName: '',
  guardianPhone: '',
  gender: undefined,
  address: '',
  bloodGroup: '',
  dateOfBirth: '',
};

/**
 * Student enrolment form.
 * Department/course/semester are derived from the chosen section (the API
 * validates that the whole chain is consistent), so the form only needs a
 * section — this avoids inconsistent combinations entirely.
 */
export const StudentFormDialog = ({
  open,
  onOpenChange,
  sections,
  sessions,
  departments,
  onSaved,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: Section[];
  sessions: AcademicSession[];
  departments?: Department[];
  onSaved: () => void;
  editing?: Student | null;
}) => {
  const form = useForm<FormInput, unknown, Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        name: editing.user?.name ?? '',
        email: editing.user?.email ?? '',
        phone: editing.user?.phone ?? '',
        enrollmentNumber: editing.enrollmentNumber,
        rollNumber: editing.rollNumber ?? '',
        section: editing.section?._id ?? '',
        admissionYear: editing.admissionYear ?? currentYear,
        guardianName: editing.guardianName ?? '',
        guardianPhone: editing.guardianPhone ?? '',
        gender: (editing.gender as Values['gender']) ?? undefined,
        address: editing.address ?? '',
        bloodGroup: editing.bloodGroup ?? '',
        dateOfBirth: editing.dateOfBirth ? new Date(editing.dateOfBirth).toISOString().slice(0, 10) : '',
      });
    } else {
      form.reset({ ...defaults, admissionYear: currentYear });
    }
  }, [open, editing, form]);

  const sectionLookup = useMemo(() => new Map(sections.map((section) => [section._id, section])), [sections]);

  const saveMutation = useApiMutation({
    mutationFn: (values: Values) => {
      const section = sectionLookup.get(values.section);
      if (!section) throw new Error('Select a valid section');
      const semesterId = typeof section.semester === 'object' ? section.semester._id : section.semester;
      const courseId = typeof section.course === 'object' ? section.course._id : section.course;
      const departmentId = typeof section.department === 'object' ? section.department._id : section.department;
      const sessionId = typeof section.academicSession === 'object' ? section.academicSession._id : section.academicSession;

      const common = {
        name: values.name,
        email: values.email,
        phone: values.phone || undefined,
        rollNumber: values.rollNumber || undefined,
        section: values.section,
        guardianName: values.guardianName || undefined,
        guardianPhone: values.guardianPhone || undefined,
        gender: values.gender,
        address: values.address || undefined,
        bloodGroup: values.bloodGroup || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
      };

      if (editing) {
        return api.patch(`/students/${editing._id}`, common);
      }

      return api.post<{ temporaryPassword?: string }>('/students', {
        ...common,
        enrollmentNumber: values.enrollmentNumber,
        department: departmentId,
        course: courseId,
        semester: semesterId,
        academicSession: sessionId,
        admissionYear: values.admissionYear,
      });
    },
    invalidate: [['students'], ['dashboard'], ['class-representatives']],
    successMessage: editing ? 'Student updated' : 'Student enrolled',
    onSuccess: (data) => {
      onSaved();
      form.reset(defaults);
      const temporaryPassword = (data as { temporaryPassword?: string } | undefined)?.temporaryPassword;
      if (!editing && temporaryPassword) {
        // Show the one-time credential instead of closing so the office can
        // hand it to the student. It is never retrievable again.
        setCredentials({ email: form.getValues('email'), password: temporaryPassword });
      } else {
        onOpenChange(false);
      }
    },
  });

  const copyCredentials = async () => {
    if (!credentials) return;
    await navigator.clipboard.writeText(`Email: ${credentials.email}\nTemporary password: ${credentials.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (credentials) {
    return (
      <FormDialog
        open={open}
        onOpenChange={(value) => {
          onOpenChange(value);
          if (!value) setCredentials(null);
        }}
        title="Student account created"
        description="Share these credentials with the student. The password is shown only once."
        submitLabel="Done"
        onSubmit={(event) => {
          event.preventDefault();
          setCredentials(null);
          onOpenChange(false);
        }}
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-surface-subtle/60 p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-subtle-foreground">Email</p>
            <p className="mt-0.5 font-mono text-[13px] text-ink">{credentials.email}</p>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-subtle-foreground">Temporary password</p>
            <p className="mt-0.5 font-mono text-[13px] font-semibold text-ink">{credentials.password}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void copyCredentials()}>
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy credentials'}
          </Button>
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-[11.5px] leading-relaxed text-warning">
            The student must change this password after signing in. If it is lost, use “Reset password” on the student record.
          </p>
        </div>
      </FormDialog>
    );
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit student' : 'Enrol a new student'}
      description={
        editing
          ? 'Update contact details and section placement.'
          : 'A login account is created automatically with a temporary password.'
      }
      submitLabel={editing ? 'Save changes' : 'Enrol student'}
      submitting={saveMutation.isPending}
      size="lg"
      onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Full name" htmlFor="student-name" required error={form.formState.errors.name?.message}>
          <Input id="student-name" placeholder="Aarav Verma" invalid={Boolean(form.formState.errors.name)} {...form.register('name')} />
        </FormField>
        <FormField label="Email" htmlFor="student-email" required error={form.formState.errors.email?.message}>
          <Input id="student-email" type="email" placeholder="aarav.verma@pdpscollege.edu.in" invalid={Boolean(form.formState.errors.email)} {...form.register('email')} />
        </FormField>
        <FormField label="Enrolment number" htmlFor="student-enrollment" required error={form.formState.errors.enrollmentNumber?.message} hint={editing ? 'Cannot be changed after enrolment' : undefined}>
          <Input id="student-enrollment" placeholder="PDPSC2026001" className="uppercase" disabled={Boolean(editing)} invalid={Boolean(form.formState.errors.enrollmentNumber)} {...form.register('enrollmentNumber')} />
        </FormField>
        <FormField label="Roll number" htmlFor="student-roll" error={form.formState.errors.rollNumber?.message}>
          <Input id="student-roll" placeholder="26CSE001" className="uppercase" {...form.register('rollNumber')} />
        </FormField>
        <FormField
          label="Section"
          htmlFor="student-section"
          required
          error={form.formState.errors.section?.message}
          hint="Course, semester and department come from this section"
          className="sm:col-span-2"
        >
          <Controller
            control={form.control}
            name="section"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="student-section" invalid={Boolean(form.formState.errors.section)}>
                  <SelectValue placeholder="Select a section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section._id} value={section._id}>
                      {typeof section.department === 'object' ? section.department.code : ''} ·{' '}
                      {typeof section.course === 'object' ? section.course.code : ''} · Sem{' '}
                      {typeof section.semester === 'object' ? section.semester.number : ''} · Section {section.name} ·{' '}
                      {typeof section.academicSession === 'object' ? section.academicSession.name : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField label="Admission year" htmlFor="student-year" required error={form.formState.errors.admissionYear?.message}>
          <Input id="student-year" type="number" min={1990} max={2100} disabled={Boolean(editing)} {...form.register('admissionYear')} />
        </FormField>
        <FormField label="Phone" htmlFor="student-phone" error={form.formState.errors.phone?.message}>
          <Input id="student-phone" placeholder="+91 98765 43210" {...form.register('phone')} />
        </FormField>
        <FormField label="Guardian name" htmlFor="student-guardian">
          <Input id="student-guardian" placeholder="Parent or guardian" {...form.register('guardianName')} />
        </FormField>
        <FormField label="Guardian phone" htmlFor="student-guardian-phone">
          <Input id="student-guardian-phone" placeholder="+91 98765 43210" {...form.register('guardianPhone')} />
        </FormField>
        <FormField label="Gender" htmlFor="student-gender">
          <Controller
            control={form.control}
            name="gender"
            render={({ field }) => (
              <Select value={field.value ?? 'unset'} onValueChange={(value) => field.onChange(value === 'unset' ? undefined : value)}>
                <SelectTrigger id="student-gender"><SelectValue placeholder="Prefer not to say" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Prefer not to say</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField label="Date of birth" htmlFor="student-dob">
          <Input id="student-dob" type="date" {...form.register('dateOfBirth')} />
        </FormField>
        <FormField label="Blood group" htmlFor="student-blood">
          <Input id="student-blood" placeholder="O+" className="uppercase" {...form.register('bloodGroup')} />
        </FormField>
      </div>
      <FormField label="Address" htmlFor="student-address">
        <Textarea id="student-address" placeholder="House, street, city, PIN" {...form.register('address')} />
      </FormField>
      {!editing ? (
        <p className="flex items-start gap-2 rounded-xl bg-primary-soft/60 px-3 py-2 text-[11.5px] leading-relaxed text-ink-soft">
          <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          A temporary password is generated and shown once after enrolment. The student is prompted to change it on first sign in.
        </p>
      ) : null}
    </FormDialog>
  );
};
