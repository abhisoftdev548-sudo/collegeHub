'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Camera, QrCode, Search, UserCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getErrorMessage } from '@/lib/api';
import { formatDate, formatDateTime, titleCase } from '@/lib/utils';
import type { EventItem } from '@/types/api';

/**
 * GET /event-attendance/:eventId returns aggregate totals plus every registered
 * participant. `registrationId` here is the registration document id used for
 * manual check-in (the human-readable code lives on the registration itself).
 */
interface AttendanceOverview {
  totals: { registered: number; checkedIn: number; volunteers: number; teachers: number };
  participants: Array<{
    registrationId: string;
    studentId?: string;
    name?: string;
    email?: string;
    enrollmentNumber?: string;
    isTeam?: boolean;
    checkedInAt?: string | null;
  }>;
}

export default function EventCheckinPage() {
  const [eventId, setEventId] = useState('');
  const [code, setCode] = useState('');
  const [search, setSearch] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);

  const eventsQuery = useQuery({
    queryKey: ['events', 'for-checkin'],
    queryFn: () =>
      api.get<EventItem[]>('/events', { params: { limit: 100, includeSubEvents: true } }),
  });

  const overviewQuery = useQuery({
    queryKey: ['event-attendance', eventId],
    queryFn: () => api.get<AttendanceOverview>(`/event-attendance/${eventId}`),
    enabled: Boolean(eventId),
    refetchInterval: 20_000,
  });

  const activeEvent = eventsQuery.data?.find((event) => event._id === eventId);

  const checkIn = async (payload: { code: string }) => {
    setCheckingIn(true);
    try {
      await api.post(`/event-attendance/${eventId}/check-in/qr`, { code: payload.code.trim().toUpperCase() });
      toast.success(`Checked in · ${payload.code.toUpperCase()}`);
      setCode('');
      await overviewQuery.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCheckingIn(false);
    }
  };

  const checkInByRegistration = async (registrationId: string, name?: string) => {
    try {
      await api.post(`/event-attendance/${eventId}/check-in`, { registrationId });
      toast.success(`${name ?? 'Participant'} checked in`);
      await overviewQuery.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const participants = overviewQuery.data?.participants ?? [];
  const filtered = participants.filter((participant) => {
    if (!search.trim()) return participant;
    const needle = search.toLowerCase();
    return (
      (participant.name ?? '').toLowerCase().includes(needle) ||
      (participant.enrollmentNumber ?? '').toLowerCase().includes(needle) ||
      (participant.email ?? '').toLowerCase().includes(needle)
    );
  });

  const totals = overviewQuery.data?.totals;

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Event check-in"
        description="Verify participants at the venue using their QR pass or by searching the registration list."
      />

      <div className="mb-4 rounded-card border border-line bg-surface p-4 shadow-soft">
        <FormField label="Event" htmlFor="checkin-event" required>
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger id="checkin-event" className="sm:max-w-md">
              <SelectValue placeholder="Select the event you are checking in" />
            </SelectTrigger>
            <SelectContent>
              {(eventsQuery.data ?? []).map((event) => (
                <SelectItem key={event._id} value={event._id}>
                  {event.title} · {formatDate(event.startDate)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      {!eventId ? (
        <EmptyState
          icon={BadgeCheck}
          title="Select an event to begin"
          description="Only published and ongoing events are listed here."
        />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            {[
              { label: 'Registered', value: totals?.registered ?? 0, icon: Users },
              { label: 'Checked in', value: totals?.checkedIn ?? 0, icon: UserCheck },
              { label: 'Volunteers', value: totals?.volunteers ?? 0, icon: Users },
              { label: 'Faculty', value: totals?.teachers ?? 0, icon: Users },
            ].map((card) => (
              <div key={card.label} className="rounded-card border border-line bg-surface p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] text-muted-foreground">{card.label}</span>
                  <card.icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="mt-1.5 font-display text-xl font-semibold text-ink">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <SectionCard title="Scan or type a code" description="Each registration has a unique check-in code">
                <form
                  onSubmit={(submitEvent) => {
                    submitEvent.preventDefault();
                    if (!code.trim()) return;
                    void checkIn({ code });
                  }}
                  className="space-y-2.5"
                >
                  <div className="relative">
                    <QrCode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" />
                    <Input
                      value={code}
                      onChange={(changeEvent) => setCode(changeEvent.target.value)}
                      placeholder="CHK-XXXXXXXXXXXX"
                      className="pl-9 font-mono uppercase tracking-wide"
                      aria-label="Check-in code"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" className="w-full" loading={checkingIn} disabled={!code.trim()}>
                    <Camera className="h-4 w-4" /> Check in participant
                  </Button>
                </form>
                <div className="mt-3 space-y-1.5 rounded-xl bg-surface-subtle/70 p-3">
                  <p className="text-[11px] font-medium text-ink">How codes work</p>
                  <ul className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                    <li>• The code is printed on the participant's confirmation page.</li>
                    <li>• A code can only be used once — repeats are rejected.</li>
                    <li>• Codes are not case sensitive.</li>
                  </ul>
                </div>
                {activeEvent ? (
                  <div className="mt-3 rounded-xl border border-line px-3 py-2">
                    <p className="text-[11px] text-subtle-foreground">Checking in for</p>
                    <p className="text-[12.5px] font-medium text-ink">{activeEvent.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(activeEvent.startDate)} · {activeEvent.venue ?? 'Venue TBA'}
                    </p>
                  </div>
                ) : null}
              </SectionCard>
            </div>

            <div className="lg:col-span-3">
              <SectionCard
                title="Participants"
                description="Search and check in manually if a code is unavailable"
                padded={false}
                action={
                  <div className="relative w-44">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle-foreground" />
                    <Input
                      value={search}
                      onChange={(changeEvent) => setSearch(changeEvent.target.value)}
                      placeholder="Search…"
                      className="h-8 pl-8 text-[12px]"
                      aria-label="Search participants"
                    />
                  </div>
                }
              >
                {overviewQuery.isLoading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={index} className="h-12 w-full" />
                    ))}
                  </div>
                ) : overviewQuery.error ? (
                  <div className="p-4">
                    <ErrorState error={overviewQuery.error} onRetry={() => void overviewQuery.refetch()} compact />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="p-4">
                    <EmptyState
                      icon={Users}
                      title={participants.length === 0 ? 'No registrations yet' : 'No matching participants'}
                      description={participants.length === 0 ? 'Participants appear once students register.' : 'Try a different name or registration ID.'}
                      compact
                    />
                  </div>
                ) : (
                  <ul className="max-h-[520px] divide-y divide-line overflow-y-auto">
                    {filtered.map((participant) => (
                      <li key={participant.registrationId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-medium text-ink">{participant.name ?? 'Participant'}</p>
                          <p className="truncate text-[10.5px] text-muted-foreground">
                            {participant.email ?? participant.enrollmentNumber ?? '—'}
                          </p>
                        </div>
                        {participant.checkedInAt ? (
                          <div className="shrink-0 text-right">
                            <Badge variant="success" size="sm">
                              <BadgeCheck className="h-3 w-3" /> In
                            </Badge>
                            <p className="mt-0.5 text-[10px] text-subtle-foreground">
                              {formatDateTime(participant.checkedInAt)}
                            </p>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void checkInByRegistration(participant.registrationId, participant.name)}
                          >
                            Check in
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
