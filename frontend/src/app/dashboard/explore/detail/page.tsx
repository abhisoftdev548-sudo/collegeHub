'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, CheckCircle2, MapPin, Ticket, Trophy, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { FullPageLoader } from '@/components/shared/guards';
import { RegistrationDialog } from '@/components/student/registration-dialog';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';
import type { Competition, EventItem, Registration } from '@/types/api';

const ExploreDetail = () => {
  const params = useSearchParams();
  const id = params.get('id');
  const [registerOpen, setRegisterOpen] = useState(false);

  const eventQuery = useQuery({
    queryKey: ['explore-event', id],
    queryFn: () => api.get<EventItem>(`/events/${id}`),
    enabled: Boolean(id),
  });
  const myRegistrationsQuery = useQuery({
    queryKey: ['my-registrations'],
    queryFn: () => api.get<Registration[]>('/events/my-registrations'),
  });
  const competitionsQuery = useQuery({
    queryKey: ['event-competitions', id],
    queryFn: () => api.getPaginated<Competition>('/competitions', { params: { event: id, limit: 50 } }),
    enabled: Boolean(id),
  });

  if (!id) return <EmptyState title="Event not found" description="No event reference was provided." />;
  if (eventQuery.isLoading) return <FullPageLoader label="Loading event…" />;
  if (eventQuery.error) return <ErrorState error={eventQuery.error} onRetry={() => void eventQuery.refetch()} />;
  if (!eventQuery.data) return null;

  const event = eventQuery.data;
  const myRegistration = (myRegistrationsQuery.data ?? []).find(
    (registration) => (typeof registration.event === 'object' ? registration.event._id : registration.event) === event._id,
  );
  const competitions = (competitionsQuery.data?.data ?? []).filter(
    (competition) => (typeof competition.event === 'object' ? competition.event._id : competition.event) === event._id,
  );

  const registrationOpen =
    event.registration?.isEnabled &&
    ['published', 'ongoing'].includes(event.status) &&
    (!event.registrationDeadline || new Date(event.registrationDeadline) > new Date());

  return (
    <div>
      <Link href="/dashboard/explore" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Explore events
      </Link>

      <PageHeader
        eyebrow={event.category?.name ?? 'Event'}
        title={event.title}
        description={event.description?.slice(0, 200)}
        actions={
          myRegistration ? (
            <Badge variant={statusVariant(myRegistration.status)}>
              <CheckCircle2 className="h-3 w-3" /> Registered · {titleCase(myRegistration.status)}
            </Badge>
          ) : registrationOpen ? (
            <Button size="sm" onClick={() => setRegisterOpen(true)}>
              <Ticket className="h-4 w-4" /> Register now
            </Button>
          ) : (
            <Badge variant="neutral">Registration closed</Badge>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <SectionCard title="About this event">
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">
              {event.description ?? 'The organising department will publish details shortly.'}
            </p>
            {event.participationRules ? (
              <>
                <h3 className="mt-4 font-display text-[13px] font-semibold text-ink">Participation rules</h3>
                <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-muted-foreground">{event.participationRules}</p>
              </>
            ) : null}
            {event.requirements ? (
              <>
                <h3 className="mt-4 font-display text-[13px] font-semibold text-ink">What to bring</h3>
                <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-muted-foreground">{event.requirements}</p>
              </>
            ) : null}
          </SectionCard>

          {competitions.length > 0 ? (
            <SectionCard title="Competitions" description="Register separately for each competition">
              <ul className="divide-y divide-line">
                {competitions.map((competition) => (
                  <li key={competition._id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                        <Trophy className="h-3.5 w-3.5 text-accent-foreground" />
                        {competition.title}
                      </p>
                      <p className="text-[11.5px] text-muted-foreground">
                        {formatCurrency(competition.fee)} · {competition.allowTeamRegistration ? `Teams of ${competition.teamSize}` : 'Individual'}
                        {competition.registrationDeadline ? ` · closes ${formatDate(competition.registrationDeadline)}` : ''}
                      </p>
                    </div>
                    {competition.resultsPublished ? <Badge variant="success" size="sm">Results out</Badge> : null}
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          {(event.subEvents?.length ?? 0) > 0 ? (
            <SectionCard title="Sub-events" description="Activities under this event">
              <ul className="divide-y divide-line">
                {event.subEvents!.map((subEvent) => (
                  <li key={subEvent._id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/dashboard/explore/detail?id=${subEvent._id}`} className="text-[13px] font-medium text-ink hover:text-primary">
                        {subEvent.title}
                      </Link>
                      <p className="text-[11.5px] text-muted-foreground">
                        {formatDate(subEvent.startDate)} · {formatCurrency(subEvent.registration?.fee ?? 0)}
                      </p>
                    </div>
                    <Badge variant={statusVariant(subEvent.status)} size="sm">{titleCase(subEvent.status)}</Badge>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}
        </div>

        <div className="space-y-4">
          <SectionCard title="Details">
            <dl className="space-y-3 text-[12.5px]">
              <div className="flex items-start gap-2.5">
                <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <div>
                  <dt className="text-[10.5px] uppercase tracking-wide text-subtle-foreground">Schedule</dt>
                  <dd className="text-ink">{formatDate(event.startDate)}{event.endDate !== event.startDate ? ` – ${formatDate(event.endDate)}` : ''}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <div>
                  <dt className="text-[10.5px] uppercase tracking-wide text-subtle-foreground">Venue</dt>
                  <dd className="text-ink">{event.venue ?? 'To be announced'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Ticket className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <div>
                  <dt className="text-[10.5px] uppercase tracking-wide text-subtle-foreground">Participation fee</dt>
                  <dd className="text-ink">{formatCurrency(event.registration?.fee ?? 0)}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <div>
                  <dt className="text-[10.5px] uppercase tracking-wide text-subtle-foreground">Capacity</dt>
                  <dd className="text-ink">{event.registration?.maxParticipants ?? 'Unlimited'} participants</dd>
                </div>
              </div>
            </dl>
            {event.registrationDeadline ? (
              <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-[11.5px] text-warning">
                Registrations close on {formatDate(event.registrationDeadline)}
              </p>
            ) : null}
            {!myRegistration && registrationOpen ? (
              <Button className="mt-3 w-full" onClick={() => setRegisterOpen(true)}>
                <Ticket className="h-4 w-4" /> Register for this event
              </Button>
            ) : null}
          </SectionCard>

          {myRegistration ? (
            <SectionCard title="Your registration">
              <div className="space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={statusVariant(myRegistration.status)} size="sm">{titleCase(myRegistration.status)}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Payment</span>
                  <Badge variant={statusVariant(myRegistration.paymentStatus)} size="sm">{titleCase(myRegistration.paymentStatus)}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Registration ID</span>
                  <span className="font-mono text-[11.5px]">{myRegistration.registrationId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Check-in code</span>
                  <span className="font-mono text-[11.5px] font-semibold text-primary">{myRegistration.checkInCode}</span>
                </div>
              </div>
              <Button variant="outline" className="mt-3 w-full" asChild>
                <Link href="/dashboard/my-registrations">Manage registration</Link>
              </Button>
            </SectionCard>
          ) : null}
        </div>
      </div>

      <RegistrationDialog
        event={event}
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onRegistered={() => void myRegistrationsQuery.refetch()}
      />
    </div>
  );
};

export default function ExploreDetailPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <ExploreDetail />
    </Suspense>
  );
}
