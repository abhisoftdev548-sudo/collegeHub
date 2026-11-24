'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { motion } from 'motion/react';
import { ArrowRight, CalendarDays, ClipboardCheck, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/auth-provider';

const highlights = [
  { icon: Users, label: 'Student records', detail: 'Admissions to graduation' },
  { icon: ClipboardCheck, label: 'Attendance', detail: 'Academic & QR check-in' },
  { icon: CalendarDays, label: 'Campus events', detail: 'Registrations & results' },
  { icon: ShieldCheck, label: 'Role-based access', detail: 'Admin · Faculty · Student' },
];

export const Hero = () => {
  const container = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // GSAP carries the page-level entrance; Motion handles micro-interactions.
  useEffect(() => {
    if (!container.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
      timeline
        .from('[data-hero="eyebrow"]', { y: 14, opacity: 0, duration: 0.5 })
        .from('[data-hero="title"] span', { y: 26, opacity: 0, duration: 0.7, stagger: 0.08 }, '-=0.25')
        .from('[data-hero="copy"]', { y: 16, opacity: 0, duration: 0.5 }, '-=0.4')
        .from('[data-hero="cta"]', { y: 12, opacity: 0, duration: 0.45 }, '-=0.3')
        .from('[data-hero="card"]', { y: 24, opacity: 0, duration: 0.6 }, '-=0.35')
        .from('[data-hero="item"]', { y: 10, opacity: 0, duration: 0.4, stagger: 0.07 }, '-=0.4');
    }, container);

    return () => context.revert();
  }, []);

  return (
    <section ref={container} className="relative overflow-hidden">
      <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-[0.55]" aria-hidden />
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/25 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -left-32 top-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" aria-hidden />

      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pb-24 lg:pt-20">
        <div>
          <span
            data-hero="eyebrow"
            className="inline-flex items-center gap-2 rounded-full border border-primary-soft-strong bg-primary-soft/70 px-3 py-1 text-[11.5px] font-medium text-primary-hover"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Academic year 2026–27 · Admissions open
          </span>

          <h1 data-hero="title" className="mt-5 font-display text-[34px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">
            <span className="block">One campus platform for</span>
            <span className="block">
              academics,{' '}
              <span className="relative inline-block text-primary">
                events
                <svg className="absolute -bottom-1 left-0 w-full" height="8" viewBox="0 0 120 8" fill="none" preserveAspectRatio="none" aria-hidden>
                  <path d="M1 6C24 2.5 58 1.5 119 4" stroke="#f8d77e" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
            </span>
            <span className="block">and everything between.</span>
          </h1>

          <p data-hero="copy" className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-ink-soft">
            CollegeHub brings student records, teaching assignments, attendance, event registrations,
            competitions and volunteer operations of Pundit Dev Prabhakar Shashtri College into a single,
            role-aware workspace.
          </p>

          <div data-hero="cta" className="mt-7 flex flex-wrap items-center gap-2.5">
            <Button size="lg" asChild>
              <Link href={user ? '/dashboard' : '/login'}>
                {user ? 'Open dashboard' : 'Sign in to your account'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/events">Browse campus events</Link>
            </Button>
          </div>

          <dl data-hero="card" className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {highlights.map(({ icon: Icon, label, detail }) => (
              <div key={label} data-hero="item" className="rounded-xl border border-line bg-surface/80 p-3 shadow-soft backdrop-blur-sm">
                <Icon className="mb-2 h-4 w-4 text-primary" strokeWidth={1.8} />
                <dt className="text-[12px] font-medium text-ink">{label}</dt>
                <dd className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>

        <motion.div
          data-hero="card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="relative mx-auto w-full max-w-md"
        >
          <div className="rounded-panel border border-line bg-surface p-4 shadow-raised">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle-foreground">Today</p>
                <p className="font-display text-[15px] font-semibold text-ink">Campus snapshot</p>
              </div>
              <span className="rounded-lg bg-success-soft px-2 py-1 text-[10.5px] font-medium text-success">Live</span>
            </div>

            <div className="mt-3 space-y-2.5">
              {[
                { title: 'Annual Tech Fest 2026', meta: 'Registrations open · 8 sub-events', tone: 'bg-primary-soft text-primary-hover' },
                { title: 'Unit Test II schedule', meta: 'Semester 1 · all departments', tone: 'bg-accent-soft text-accent-foreground' },
                { title: 'Campus clean-up drive', meta: 'Volunteers · 24 assigned', tone: 'bg-success-soft text-success' },
              ].map((row, index) => (
                <motion.div
                  key={row.title}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + index * 0.1, duration: 0.35 }}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface-subtle/60 p-2.5"
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${row.tone}`}>
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium text-ink">{row.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{row.meta}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
              {[
                { value: '4', label: 'Roles' },
                { value: '17', label: 'API modules' },
                { value: '100%', label: 'Real data' },
              ].map((item) => (
                <div key={item.label}>
                  <p className="font-display text-lg font-semibold text-ink">{item.value}</p>
                  <p className="text-[10.5px] text-subtle-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute -bottom-4 -left-3 hidden rounded-xl border border-line bg-surface px-3 py-2 shadow-raised sm:block">
            <p className="text-[10px] text-subtle-foreground">Attendance synced</p>
            <p className="text-[12px] font-semibold text-ink">QR check-in enabled</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
