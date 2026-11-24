'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin, Search, Ticket } from 'lucide-react';
import { SiteHeader } from '@/components/public/site-header';
import { SiteFooter } from '@/components/public/site-footer';
import { Reveal } from '@/components/shared/reveal';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';
import type { EventItem } from '@/types/api';

export default function PublicEventsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');

  const { data: categories } = useQuery({
    queryKey: ['public-event-categories'],
    queryFn: () => api.get<Array<{ _id: string; name: string; color: string }>>('/events/categories'),
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['public-events', search, category],
    queryFn: () =>
      api.get<EventItem[]>('/events', {
        params: {
          publicOnly: true,
          isMainEvent: true,
          search: search || undefined,
          category: category === 'all' ? undefined : category,
          limit: 24,
        },
      }),
  });

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-line">
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Campus calendar</span>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Events at PDPSC
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            Technical fests, cultural programmes, sports meets and departmental activities. Sign in with your
            college account to register.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search events…"
                className="pl-9"
                aria-label="Search events"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCategory('all')}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  category === 'all' ? 'bg-primary text-white' : 'border border-line bg-surface text-ink-soft hover:bg-surface-subtle'
                }`}
              >
                All
              </button>
              {(categories ?? []).map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => setCategory(item._id)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    category === item._id
                      ? 'bg-primary text-white'
                      : 'border border-line bg-surface text-ink-soft hover:bg-surface-subtle'
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <CardSkeleton key={index} className="h-52" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No events published yet"
            description="Upcoming campus events will be listed here as soon as they are published by the college."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((event, index) => (
              <Reveal key={event._id} delay={Math.min(index * 0.04, 0.3)}>
                <Link
                  href={`/events/detail?id=${event._id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-raised"
                >
                  <div className="relative h-28 overflow-hidden bg-gradient-to-br from-primary-soft via-surface-subtle to-accent-soft/70">
                    <div className="grid-backdrop absolute inset-0 opacity-50" aria-hidden />
                    {event.bannerUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={event.bannerUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                    <div className="absolute left-3 top-3 flex items-center gap-1.5">
                      <Badge variant="primary" size="sm">
                        {event.category?.name ?? 'General'}
                      </Badge>
                      {event.status !== 'published' ? (
                        <Badge variant={statusVariant(event.status)} size="sm">
                          {titleCase(event.status)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <h2 className="font-display text-[15px] font-semibold leading-snug text-ink group-hover:text-primary">
                      {event.title}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
                      {event.description ?? 'Details will be shared by the organising department.'}
                    </p>

                    <dl className="mt-3 space-y-1.5 text-[11.5px] text-ink-soft">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-primary" />
                        {formatDate(event.startDate)}
                        {event.endDate && event.endDate !== event.startDate ? ` – ${formatDate(event.endDate)}` : ''}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        {event.venue ?? 'Venue to be announced'}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Ticket className="h-3.5 w-3.5 text-primary" />
                        {formatCurrency(event.registration?.fee ?? 0)}
                        {(event.stats?.subEvents ?? 0) > 0 ? ` · ${event.stats?.subEvents} sub-events` : ''}
                      </div>
                    </dl>

                    <span className="mt-3 inline-flex items-center text-[12px] font-medium text-primary">
                      View details
                      <span className="ml-1 transition-transform group-hover:translate-x-0.5">→</span>
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}

        <div className="mt-10 rounded-card border border-line bg-surface p-5 text-center shadow-soft">
          <p className="text-[13px] text-ink-soft">
            Are you a student of PDPSC? Sign in to register for events, submit competition entries and track
            your participation.
          </p>
          <Button className="mt-3" asChild>
            <Link href="/login">Sign in to register</Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
