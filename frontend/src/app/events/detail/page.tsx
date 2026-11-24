'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, MapPin, Ticket, Users } from 'lucide-react';
import { SiteHeader } from '@/components/public/site-header';
import { SiteFooter } from '@/components/public/site-footer';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { FullPageLoader } from '@/components/shared/guards';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';
import type { EventItem } from '@/types/api';

const EventDetail = () => {
  const params = useSearchParams();
  const id = params.get('id');

  const { data: event, isLoading, error, refetch } = useQuery({
    queryKey: ['public-event', id],
    queryFn: () => api.get<EventItem>(`/events/${id}`),
    enabled: Boolean(id),
  });

  if (!id) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <EmptyState icon={CalendarDays} title="Event not found" description="The link you followed does not include an event reference." action={<Button asChild><Link href="/events">All events</Link></Button>} />
      </div>
    );
  }

  if (isLoading) return <FullPageLoader label="Loading event…" />;

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <ErrorState error={error} onRetry={() => void refetch()} title="We could not load this event" />
      </div>
    );
  }

  if (!event) return null;

  const fee = event.registration?.fee ?? 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <Link href="/events" className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> All events
      </Link>

      <div className="overflow-hidden rounded-panel border border-line bg-surface shadow-soft">
        <div className="relative h-36 bg-gradient-to-br from-primary-soft via-surface-subtle to-accent-soft/70 sm:h-44">
          <div className="grid-backdrop absolute inset-0 opacity-50" aria-hidden />
          {event.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.bannerUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
          <div className="absolute bottom-3 left-4 flex items-center gap-1.5">
            <Badge variant="primary">{event.category?.name ?? 'General'}</Badge>
            <Badge variant={statusVariant(event.status)}>{titleCase(event.status)}</Badge>
            {event.isMainEvent ? <Badge variant="accent">Main event</Badge> : null}
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{event.title}</h1>
          {event.parentEvent ? (
            <p className="mt-1 text-[12.5px] text-muted-foreground">Part of {event.parentEvent.title}</p>
          ) : null}

          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-surface-subtle/50 p-3">
              <p className="flex items-center gap-1.5 text-[11px] text-subtle-foreground"><CalendarDays className="h-3.5 w-3.5" /> Schedule</p>
              <p className="mt-1 text-[13px] font-medium text-ink">
                {formatDate(event.startDate)}
                {event.endDate && event.endDate !== event.startDate ? ` – ${formatDate(event.endDate)}` : ''}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface-subtle/50 p-3">
              <p className="flex items-center gap-1.5 text-[11px] text-subtle-foreground"><MapPin className="h-3.5 w-3.5" /> Venue</p>
              <p className="mt-1 text-[13px] font-medium text-ink">{event.venue ?? 'To be announced'}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface-subtle/50 p-3">
              <p className="flex items-center gap-1.5 text-[11px] text-subtle-foreground"><Ticket className="h-3.5 w-3.5" /> Participation fee</p>
              <p className="mt-1 text-[13px] font-medium text-ink">{formatCurrency(fee)}</p>
            </div>
          </div>

          {event.registrationDeadline ? (
            <p className="mt-3 text-[12px] text-muted-foreground">
              Registrations close on {formatDate(event.registrationDeadline)}.
            </p>
          ) : null}

          <section className="mt-6">
            <h2 className="font-display text-[15px] font-semibold text-ink">About this event</h2>
            <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-soft">
              {event.description ?? 'The organising department will publish details shortly.'}
            </p>
          </section>

          {event.participationRules ? (
            <section className="mt-5">
              <h2 className="font-display text-[15px] font-semibold text-ink">Participation rules</h2>
              <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-soft">{event.participationRules}</p>
            </section>
          ) : null}

          {event.requirements ? (
            <section className="mt-5">
              <h2 className="font-display text-[15px] font-semibold text-ink">What to bring</h2>
              <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-soft">{event.requirements}</p>
            </section>
          ) : null}

          {(event.subEvents?.length ?? 0) > 0 ? (
            <section className="mt-6">
              <h2 className="flex items-center gap-1.5 font-display text-[15px] font-semibold text-ink">
                <Users className="h-4 w-4 text-primary" /> Sub-events
              </h2>
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                {event.subEvents!.map((subEvent) => (
                  <li key={subEvent._id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">{subEvent.title}</p>
                      <p className="text-[11.5px] text-muted-foreground">
                        {formatDate(subEvent.startDate)} · {formatCurrency(subEvent.registration?.fee ?? 0)}
                      </p>
                    </div>
                    <Badge variant={statusVariant(subEvent.status)} size="sm">{titleCase(subEvent.status)}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="mt-7 rounded-xl border border-primary-soft-strong bg-primary-soft/50 p-4">
            <p className="text-[13px] font-medium text-ink">Register through your student account</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">
              Sign in with your institutional email to register, pay the participation fee and receive your
              check-in code.
            </p>
            <Button className="mt-3" size="sm" asChild>
              <Link href={`/login?next=/dashboard/explore/detail?id=${event._id}`}>Sign in to register</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function PublicEventDetailPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <Suspense fallback={<FullPageLoader label="Loading event…" />}>
        <EventDetail />
      </Suspense>
      <SiteFooter />
    </div>
  );
}
