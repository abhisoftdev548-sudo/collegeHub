import type { Metadata } from 'next';
import Link from 'next/link';
import { GraduationCap, Mail, MapPin, Phone } from 'lucide-react';
import { SiteHeader } from '@/components/public/site-header';
import { SiteFooter } from '@/components/public/site-footer';
import { Reveal } from '@/components/shared/reveal';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'About the college',
  description:
    'About Pundit Dev Prabhakar Shashtri College, Chhatarpur (Madhya Pradesh) and the CollegeHub platform.',
};

const values = [
  { title: 'Academic rigour', body: 'Structured semesters, transparent attendance and documented progression for every student.' },
  { title: 'Student life', body: 'Technical, cultural and sports events with competitions judged by faculty and external experts.' },
  { title: 'Service', body: 'Student volunteers and class representatives support every campus activity.' },
];

export default function AboutPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-line">
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Our institution</span>
          <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            Pundit Dev Prabhakar Shashtri College, Chhatarpur
          </h1>
          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-ink-soft">
            A multi-faculty institution in Chhatarpur, Madhya Pradesh, offering undergraduate and
            postgraduate programmes across engineering, science, commerce and the arts. CollegeHub is the
            digital backbone for its academic and campus operations.
          </p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-3">
        {values.map((value, index) => (
          <Reveal key={value.title} delay={index * 0.07}>
            <div className="h-full rounded-card border border-line bg-surface p-5 shadow-soft">
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <GraduationCap className="h-4 w-4" />
              </span>
              <h2 className="font-display text-[15px] font-semibold text-ink">{value.title}</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{value.body}</p>
            </div>
          </Reveal>
        ))}
      </section>

      <section className="border-y border-line bg-surface/70">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-xl font-semibold text-ink">About CollegeHub</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
              CollegeHub was built for this campus. It models academic sessions, departments, courses,
              semesters and sections faithfully; keeps a permanent enrolment history; and provides an event
              engine with dynamic forms, fee handling, attendance and results.
            </p>
            <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
              Every figure in the platform is computed from live college data. Nothing is mocked, and no
              personal information is exposed publicly.
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="rounded-card border border-line bg-surface p-5 shadow-soft">
              <h3 className="font-display text-[14px] font-semibold text-ink">Contact the office</h3>
              <ul className="mt-3 space-y-3 text-[13px] text-ink-soft">
                <li className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Pundit Dev Prabhakar Shashtri College, Chhatarpur, Madhya Pradesh 471001
                </li>
                <li className="flex items-start gap-2.5">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  office@pdpscollege.edu.in
                </li>
                <li className="flex items-start gap-2.5">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  +91 7682 000 000
                </li>
              </ul>
              <Button variant="outline" size="sm" className="mt-4" asChild>
                <Link href="/login">Sign in to CollegeHub</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
