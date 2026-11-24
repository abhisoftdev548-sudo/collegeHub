'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'motion/react';
import { ArrowLeft, Eye, EyeOff, GraduationCap, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/providers/auth-provider';
import { ApiError, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  email: z.string().min(1, 'Enter your email address').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

type LoginValues = z.infer<typeof loginSchema>;

export const LoginForm = () => {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const next = params.get('next') ?? '/dashboard';

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

  const onSubmit = async (values: LoginValues) => {
    setFormError(null);
    try {
      const signedIn = await signIn(values.email.trim().toLowerCase(), values.password);
      toast.success(`Welcome back, ${signedIn.name.split(' ')[0]}`);
      if (signedIn.mustChangePassword) {
        router.replace('/dashboard/profile?changePassword=1');
      } else {
        router.replace(next);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError(getErrorMessage(error));
      }
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Form panel */}
      <div className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to website
          </Link>

          <div className="mb-7 flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-[0_8px_20px_-8px_rgba(59,118,232,0.9)]">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-[16px] font-semibold text-ink">CollegeHub</span>
              <span className="block text-[10.5px] font-medium uppercase tracking-[0.14em] text-subtle-foreground">
                PDPSC · Chhatarpur
              </span>
            </span>
          </div>

          <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink">Sign in</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Use the institutional email address issued by the college office.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email" required>Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@pdpscollege.edu.in"
                invalid={Boolean(errors.email)}
                {...register('email')}
              />
              {errors.email ? <p className="text-[11.5px] text-danger">{errors.email.message}</p> : null}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" required>Password</Label>
                <span className="text-[11px] text-subtle-foreground">Issued by the college office</span>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Your password"
                  invalid={Boolean(errors.password)}
                  className="pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-subtle-foreground transition-colors hover:text-ink"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password ? <p className="text-[11.5px] text-danger">{errors.password.message}</p> : null}
            </div>

            {formError ? (
              <div
                role="alert"
                className={cn('rounded-xl border border-danger/20 bg-danger-soft px-3 py-2.5 text-[12.5px] text-danger')}
              >
                {formError}
              </div>
            ) : null}

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <div className="mt-6 rounded-xl border border-line bg-surface-subtle/70 p-3.5">
            <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Forgot your password?
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
              Contact the college office or your department administrator. They can issue a temporary
              password, which you will be asked to change after signing in.
            </p>
          </div>
        </div>
      </div>

      {/* Brand panel */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12"
      >
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-[0.16]" aria-hidden />
        <div className="pointer-events-none absolute -right-16 top-24 h-64 w-64 rounded-full bg-accent/30 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-12 bottom-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" aria-hidden />

        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">Pundit Dev Prabhakar Shashtri College</p>
          <h2 className="mt-3 max-w-sm font-display text-[28px] font-semibold leading-tight text-white">
            The campus workspace for academics and events.
          </h2>
          <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-white/80">
            Attendance, enrolments, announcements, competitions and volunteer operations — all in one
            secure place.
          </p>
        </div>

        <div className="relative space-y-3">
          {[
            { label: 'Attendance & academics', detail: 'Subject-wise records with promotion history' },
            { label: 'Events & competitions', detail: 'Dynamic forms, fee collection and results' },
            { label: 'Secure by design', detail: 'Server-enforced roles and a complete audit trail' },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.1, duration: 0.4 }}
              className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm"
            >
              <p className="text-[12.5px] font-medium text-white">{item.label}</p>
              <p className="mt-0.5 text-[11.5px] text-white/70">{item.detail}</p>
            </motion.div>
          ))}
        </div>

        <p className="relative text-[11px] text-white/60">
          Chhatarpur, Madhya Pradesh · India
        </p>
      </motion.div>
    </div>
  );
};
