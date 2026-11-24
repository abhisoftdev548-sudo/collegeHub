'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { FormField } from '@/components/shared/form-field';
import { FullPageLoader } from '@/components/shared/guards';
import { useApiMutation } from '@/components/shared/use-api-mutation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, getErrorMessage } from '@/lib/api';
import { formatDate, initials, titleCase } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[a-z]/, 'Include at least one lowercase letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Confirm the new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type PasswordValues = z.infer<typeof passwordSchema>;

const ProfileContent = () => {
  const { user, refresh } = useAuth();
  const params = useSearchParams();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const forceChange = params.get('changePassword') === '1' || Boolean(user?.mustChangePassword);

  useEffect(() => {
    if (forceChange) {
      toast.info('Please set a new password to continue using your account');
    }
  }, [forceChange]);

  const changePassword = async (values: PasswordValues) => {
    setSubmitting(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success('Password changed');
      form.reset();
      await refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return <FullPageLoader />;

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="My profile"
        description="Your account details as held by the college office."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Account" description="Identity issued by the college">
          <div className="flex items-center gap-3.5">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-primary text-base text-white">{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-display text-[16px] font-semibold text-ink">{user.name}</p>
              <p className="text-[12px] text-muted-foreground">
                {user.role === 'teacher' ? user.designation ?? 'Faculty' : titleCase(user.role)}
              </p>
              <Badge variant={statusVariant(user.status)} size="sm" className="mt-1">
                {titleCase(user.status)}
              </Badge>
            </div>
          </div>
          <dl className="mt-4 space-y-2.5 text-[12.5px]">
            <div className="flex items-start gap-2.5">
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle-foreground" />
              <div>
                <dt className="text-[10.5px] uppercase tracking-wide text-subtle-foreground">Email</dt>
                <dd className="break-all text-ink">{user.email}</dd>
              </div>
            </div>
            {user.phone ? (
              <div className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle-foreground" />
                <div>
                  <dt className="text-[10.5px] uppercase tracking-wide text-subtle-foreground">Phone</dt>
                  <dd className="text-ink">{user.phone}</dd>
                </div>
              </div>
            ) : null}
            {user.studentProfile ? (
              <div className="flex items-start gap-2.5">
                <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle-foreground" />
                <div>
                  <dt className="text-[10.5px] uppercase tracking-wide text-subtle-foreground">Enrolment</dt>
                  <dd className="text-ink">
                    {user.studentProfile.enrollmentNumber}
                    {user.studentProfile.course ? ` · ${user.studentProfile.course.code}` : ''}
                    {user.studentProfile.semester ? ` · Semester ${user.studentProfile.semester.number}` : ''}
                    {user.studentProfile.section ? ` · Section ${user.studentProfile.section.name}` : ''}
                  </dd>
                </div>
              </div>
            ) : null}
            {user.lastLoginAt ? (
              <div>
                <dt className="text-[10.5px] uppercase tracking-wide text-subtle-foreground">Last sign in</dt>
                <dd className="text-ink">{formatDate(user.lastLoginAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</dd>
              </div>
            ) : null}
          </dl>
        </SectionCard>

        <div className="lg:col-span-2">
          <SectionCard
            title="Change password"
            description="Choose a strong password you do not use elsewhere"
            action={forceChange ? <Badge variant="warning">Required</Badge> : null}
          >
            <form onSubmit={form.handleSubmit(changePassword)} className="space-y-3" noValidate>
              <FormField label="Current password" htmlFor="current-password" required error={form.formState.errors.currentPassword?.message}>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  invalid={Boolean(form.formState.errors.currentPassword)}
                  {...form.register('currentPassword')}
                />
              </FormField>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  label="New password"
                  htmlFor="new-password"
                  required
                  error={form.formState.errors.newPassword?.message}
                  hint="8+ characters with upper, lower and a number"
                >
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    invalid={Boolean(form.formState.errors.newPassword)}
                    {...form.register('newPassword')}
                  />
                </FormField>
                <FormField label="Confirm password" htmlFor="confirm-password" required error={form.formState.errors.confirmPassword?.message}>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    invalid={Boolean(form.formState.errors.confirmPassword)}
                    {...form.register('confirmPassword')}
                  />
                </FormField>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" loading={submitting}>
                  <KeyRound className="h-4 w-4" /> Update password
                </Button>
                <p className="flex items-center gap-1 text-[11px] text-subtle-foreground">
                  <ShieldCheck className="h-3 w-3" /> Sessions stay signed in on this device
                </p>
              </div>
            </form>
          </SectionCard>
        </div>
      </div>
    </div>
  );
};

export default function ProfilePage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <ProfileContent />
    </Suspense>
  );
}
