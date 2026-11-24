import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  CalendarDays,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  Megaphone,
  ShieldCheck,
  Users2,
} from 'lucide-react';
import { SiteHeader } from '@/components/public/site-header';
import { SiteFooter } from '@/components/public/site-footer';
import { Hero } from '@/components/public/hero';
import { Reveal } from '@/components/shared/reveal';
import { Button } from '@/components/ui/button';

const modules = [
  {
    icon: GraduationCap,
    title: 'Academic records',
    description:
      'Departments, courses, sessions, semesters and sections modelled exactly like the college — with append-only enrolment history and audited promotions.',
  },
  {
    icon: ClipboardCheck,
    title: 'Attendance that adds up',
    description:
      'Faculty mark attendance per subject and section; class representatives see their class; students track subject-wise percentages.',
  },
  {
    icon: CalendarDays,
    title: 'Events & competitions',
    description:
      'Multi-level events with sub-events, dynamic registration forms, fee collection, judge-led competitions and published results.',
  },
  {
    icon: Users2,
    title: 'Volunteers & tasks',
    description:
      'Build volunteer groups per event, hand out tasks with priorities and deadlines, and track progress through completion.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Reports & exports',
    description:
      'Enrolment, workload, engagement and attendance reports with one-click CSV export for office records.',
  },
  {
    icon: ShieldCheck,
    title: 'Security by default',
    description:
      'Role-based access enforced on the server, HttpOnly sessions, CSRF protection, rate limiting and a full audit trail.',
  },
];

const demoAccounts = [
  { role: 'Administrator', email: 'admin@pdpscollege.edu.in', detail: 'Full academic & event control' },
  { role: 'Faculty', email: 'anil.sharma@pdpscollege.edu.in', detail: 'Assigned sections & events' },
  { role: 'Student', email: 'student1@pdpscollege.edu.in', detail: 'Courses, attendance, events' },
];

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <Hero />

      <section id="modules" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <Reveal>
          <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Platform</span>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Built around how the college actually runs
              </h2>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
                Thirteen operational modules, one consistent experience for administrators, faculty,
                class representatives, volunteers and students.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/events">
                See events <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(({ icon: Icon, title, description }, index) => (
            <Reveal key={title} delay={index * 0.05}>
              <div className="group h-full rounded-card border border-line bg-surface p-5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-raised">
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary-hover transition-colors group-hover:bg-primary group-hover:text-white">
                  <Icon className="h-5 w-5" strokeWidth={1.7} />
                </span>
                <h3 className="font-display text-[15px] font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-surface/70">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Role aware</span>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Everyone sees exactly what they need
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              Permissions are enforced on the API, not hidden in the interface. Faculty only reach their
              assigned sections and events; class representatives stay within their own section; volunteers
              only see the events they support.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                { icon: ShieldCheck, text: 'Administrators manage the full academic structure and audit log' },
                { icon: Users2, text: 'Faculty mark attendance and coordinate their events' },
                { icon: BadgeCheck, text: 'CRs monitor their class; volunteers own event logistics' },
                { icon: Award, text: 'Students register, pay, submit work and track results' },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5 text-[13px] text-ink-soft">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
                    <Icon className="h-3 w-3" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="rounded-panel border border-line bg-surface p-5 shadow-raised">
              <div className="mb-4 flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" />
                <h3 className="font-display text-[14px] font-semibold text-ink">Staff & student access</h3>
              </div>
              <ul className="space-y-3">
                {demoAccounts.map((account) => (
                  <li key={account.email} className="rounded-xl border border-line bg-surface-subtle/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12.5px] font-medium text-ink">{account.role}</p>
                      <span className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-medium text-subtle-foreground ring-1 ring-inset ring-line">
                        {account.detail}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11.5px] text-muted-foreground">{account.email}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-subtle-foreground">
                Accounts are issued by the college office. Use your institutional email and the password
                shared with you to sign in.
              </p>
              <Button className="mt-4 w-full" asChild>
                <Link href="/login">
                  Sign in to CollegeHub <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-panel border border-line bg-gradient-to-br from-primary-soft via-surface to-accent-soft/70 p-8 text-center shadow-soft sm:p-12">
            <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-40" aria-hidden />
            <div className="relative">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Ready when the session begins
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-[14px] leading-relaxed text-ink-soft">
                Sign in with your college account to manage academics, mark attendance, publish events or
                register for competitions.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                <Button size="lg" asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/events">Browse events</Link>
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  );
}
