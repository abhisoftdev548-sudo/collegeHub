'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin, Search, Ticket } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';
import type { EventCategory, EventItem } from '@/types/api';

export default function ExplorePage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const categoriesQuery = useQuery({
    queryKey: ['event-categories'],
    queryFn: () => api.get<EventCategory[]>('/events/categories'),
  });
  const eventsQuery = useQuery({
    queryKey: ['explore-events', search, category],
    queryFn: () =>
      api.getPaginated<EventItem>('/events', {
        params: {
          search: search || undefined,
          category: category === 'all' ? undefined : category,
          limit: 60,
        },
      }),
  });

  const events = eventsQuery.data?.data ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Events"
        title="Explore events"
        description="Browse campus events and register with your student account."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/my-registrations">My registrations</Link>
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
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
          {(categoriesQuery.data ?? []).map((item) => (
            <button
              key={item._id}
              type="button"
              onClick={() => setCategory(item._id)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                category === item._id ? 'bg-primary text-white' : 'border border-line bg-surface text-ink-soft hover:bg-surface-subtle'
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>

      {eventsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <CardSkeleton key={index} className="h-52" />
          ))}
        </div>
      ) : eventsQuery.error ? (
        <ErrorState error={eventsQuery.error} onRetry={() => void eventsQuery.refetch()} />
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No events open right now"
          description="Events published by the college will appear here. Check back soon."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Link
              key={event._id}
              href={`/dashboard/explore/detail?id=${event._id}`}
              className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-raised"
            >
              <div className="relative h-24 bg-gradient-to-br from-primary-soft via-surface-subtle to-accent-soft/70">
                <div className="grid-backdrop absolute inset-0 opacity-50" aria-hidden />
                {event.bannerUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={event.bannerUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
                <div className="absolute left-3 top-3 flex gap-1.5">
                  <Badge variant="primary" size="sm">{event.category?.name ?? 'General'}</Badge>
                  <Badge variant={statusVariant(event.status)} size="sm">{titleCase(event.status)}</Badge>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h2 className="font-display text-[14.5px] font-semibold leading-snug text-ink group-hover:text-primary">
                  {event.title}
                </h2>
                <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                  {event.description ?? 'Details will be shared by the organising department.'}
                </p>
                <dl className="mt-3 space-y-1 text-[11.5px] text-ink-soft">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="h-3 w-3 text-primary" />
                    {formatDate(event.startDate)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 text-primary" />
                    {event.venue ?? 'Venue TBA'}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Ticket className="h-3 w-3 text-primary" />
                    {formatCurrency(event.registration?.fee ?? 0)}
                    {(event.stats?.subEvents ?? 0) > 0 ? ` · ${event.stats?.subEvents} sub-events` : ''}
                  </div>
                </dl>
                <span className="mt-auto pt-3 text-[12px] font-medium text-primary">View & register →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
