'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Download,
  IndianRupee,
  MapPin,
  QrCode,
  Ticket,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { DataTable, TableFooterBar, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { FullPageLoader } from '@/components/shared/guards';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, downloadFile, getErrorMessage } from '@/lib/api';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { EventItem, Payment, Registration } from '@/types/api';

/** Shape returned by GET /event-attendance/:eventId */
interface AttendanceOverview {
  totals: { registered: number; checkedIn: number; volunteers: number; teachers: number };
  participants: Array<{
    registrationId: string;
    studentId?: string;
    name?: string;
    email?: string;
    checkedInAt?: string | null;
  }>;
}

const EventDetail = () => {
  const params = useSearchParams();
  const id = params.get('id');
  const { hasAnyPermission } = useAuth();
  const canManage = hasAnyPermission('event:update', 'registration:read');
  const canVerifyPayments = hasAnyPermission('payment:manage');

  const [tab, setTab] = useState('registrations');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);

  const { data: event, isLoading, error, refetch } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.get<EventItem>(`/events/${id}`),
    enabled: Boolean(id),
  });

  const summaryQuery = useQuery({
    queryKey: ['event-attendance-overview', id],
    queryFn: () => api.get<AttendanceOverview>(`/event-attendance/${id}`),
    enabled: Boolean(id) && canManage,
  });

  const registrationsQuery = useQuery({
    queryKey: ['event-registrations', id, page, statusFilter, search],
    queryFn: () =>
      api.getPaginated<Registration>(`/events/${id}/registrations`, {
        params: {
          page,
          limit: 10,
          status: statusFilter === 'all' ? undefined : statusFilter,
          search: search || undefined,
        },
      }),
    enabled: Boolean(id) && canManage,
  });

  const paymentsQuery = useQuery({
    queryKey: ['event-payments', id],
    queryFn: () => api.getPaginated<Payment>('/events/payments', { params: { event: id, limit: 50 } }),
    enabled: Boolean(id) && canVerifyPayments && tab === 'payments',
  });

  const verifyPayment = async (paymentId: string, outcome: 'paid' | 'failed' | 'refunded') => {
    try {
      await api.post(`/events/payments/${paymentId}/verify`, { outcome });
      toast.success(`Payment marked ${outcome}`);
      await Promise.all([paymentsQuery.refetch(), registrationsQuery.refetch(), summaryQuery.refetch()]);
    } catch (verifyError) {
      toast.error(getErrorMessage(verifyError));
    }
  };

  const checkInByCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!qrCode.trim()) return;
    setCheckingIn(true);
    try {
      await api.post(`/event-attendance/${id}/check-in/qr`, { code: qrCode.trim().toUpperCase() });
      toast.success('Participant checked in');
      setQrCode('');
      await Promise.all([summaryQuery.refetch(), registrationsQuery.refetch()]);
    } catch (checkInError) {
      toast.error(getErrorMessage(checkInError));
    } finally {
      setCheckingIn(false);
    }
  };

  const updateStatus = async (registrationId: string, status: string) => {
    try {
      await api.patch(`/events/registrations/${id}/${registrationId}`, { status });
      toast.success(`Registration ${status}`);
      await Promise.all([registrationsQuery.refetch(), summaryQuery.refetch()]);
    } catch (statusError) {
      toast.error(getErrorMessage(statusError));
    }
  };

  if (!id) return <EmptyState title="Event not found" description="No event reference was provided." />;
  if (isLoading) return <FullPageLoader label="Loading event…" />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!event) return null;

  const overviewTotals = summaryQuery.data?.totals;
  const registered = overviewTotals?.registered ?? event.stats?.registrations ?? 0;
  const checkedIn = overviewTotals?.checkedIn ?? 0;
  const verifiedRevenue =
    paymentsQuery.data?.data.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + payment.amount, 0) ?? 0;
  const pendingCount = registrationsQuery.data?.data.filter((row) => row.status === 'pending').length ?? 0;

  const registrationColumns: Column<Registration>[] = [
    {
      key: 'student',
      header: 'Participant',
      render: (row) => {
        const student = typeof row.student === 'object' ? row.student : null;
        return (
          <div>
            <p className="font-medium text-ink">{student?.name ?? 'Student'}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{row.registrationId}</p>
          </div>
        );
      },
    },
    {
      key: 'competition',
      header: 'Competition',
      render: (row) =>
        typeof row.competition === 'object' && row.competition ? (
          <span className="text-[12px]">{row.competition.title}</span>
        ) : (
          <span className="text-[12px] text-subtle-foreground">—</span>
        ),
    },
    {
      key: 'fee',
      header: 'Fee',
      render: (row) => (
        <div className="text-[12px]">
          <p className="tabular-nums text-ink">{formatCurrency(row.feeAmount)}</p>
          <Badge variant={statusVariant(row.paymentStatus)} size="sm">{titleCase(row.paymentStatus)}</Badge>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={statusVariant(row.status)}>{titleCase(row.status)}</Badge>,
    },
    {
      key: 'checkin',
      header: 'Check-in',
      render: (row) =>
        row.checkedInAt ? (
          <Badge variant="success" size="sm"><CheckCircle2 className="h-3 w-3" /> Checked in</Badge>
        ) : (
          <span className="font-mono text-[11px] text-subtle-foreground">{row.checkInCode}</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {row.status === 'pending' ? (
            <>
              <Button variant="outline" size="sm" onClick={() => void updateStatus(row._id, 'confirmed')}>
                Approve
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void updateStatus(row._id, 'rejected')}>Reject</Button>
            </>
          ) : null}
          {row.status === 'confirmed' && !row.checkedInAt ? (
            <ConfirmDialog
              trigger={<Button variant="ghost" size="sm">Check in</Button>}
              title="Check this participant in?"
              description={`Mark ${typeof row.student === 'object' ? row.student?.name : 'the participant'} as present at the venue.`}
              confirmLabel="Check in"
              destructive={false}
              onConfirm={async () => {
                await api.post(`/event-attendance/${id}/check-in`, { registrationId: row._id });
                toast.success('Participant checked in');
                await Promise.all([registrationsQuery.refetch(), summaryQuery.refetch()]);
              }}
            />
          ) : null}
        </div>
      ),
    },
  ];

  const paymentColumns: Column<Payment>[] = [
    {
      key: 'payment',
      header: 'Payment',
      render: (row) => (
        <div>
          <p className="font-mono text-[12px] text-ink">{row.paymentId}</p>
          <p className="text-[11px] text-muted-foreground">
            {typeof row.student === 'object' ? row.student?.name : 'Student'}
          </p>
        </div>
      ),
    },
    { key: 'amount', header: 'Amount', render: (row) => <span className="tabular-nums font-medium">{formatCurrency(row.amount)}</span> },
    { key: 'method', header: 'Method', render: (row) => <Badge variant="neutral" size="sm">{titleCase(row.method)}</Badge> },
    { key: 'reference', header: 'Reference', render: (row) => <span className="font-mono text-[11.5px]">{row.reference ?? '—'}</span> },
    { key: 'status', header: 'Status', render: (row) => <Badge variant={statusVariant(row.status)}>{titleCase(row.status)}</Badge> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) =>
        row.status === 'pending' ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" onClick={() => void verifyPayment(row._id, 'paid')}>Mark paid</Button>
            <Button variant="ghost" size="sm" onClick={() => void verifyPayment(row._id, 'failed')}>Fail</Button>
          </div>
        ) : (
          <span className="text-[11.5px] text-subtle-foreground">
            {row.verifiedAt ? formatDate(row.verifiedAt) : '—'}
          </span>
        ),
    },
  ];

  return (
    <div>
      <Link href="/dashboard/events" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> All events
      </Link>

      <PageHeader
        eyebrow={event.category?.name ?? 'Event'}
        title={event.title}
        description={event.description?.slice(0, 180)}
        actions={
          <>
            {canManage ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void downloadFile(`/events/${id}/registrations/export`, `${event.slug || 'event'}-registrations.csv`)
                }
              >
                <Download className="h-4 w-4" /> Export registrations
              </Button>
            ) : null}
            <Badge variant={statusVariant(event.status)}>{titleCase(event.status)}</Badge>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Registrations', value: registered, icon: Ticket, hint: 'Total received' },
          { label: 'Pending on page', value: pendingCount, icon: Users, hint: 'Awaiting review' },
          { label: 'Checked in', value: checkedIn, icon: CheckCircle2, hint: 'At the venue' },
          { label: 'Verified fees', value: formatCurrency(verifiedRevenue), icon: IndianRupee, hint: 'From loaded payments' },
        ].map((card) => (
          <div key={card.label} className="rounded-card border border-line bg-surface p-4 shadow-soft">
            <div className="flex items-start justify-between">
              <span className="text-[11.5px] text-muted-foreground">{card.label}</span>
              <card.icon className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="mt-1.5 font-display text-xl font-semibold text-ink">{card.value}</p>
            <p className="mt-0.5 text-[10.5px] text-subtle-foreground">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="flex items-center gap-1.5 text-[11px] text-subtle-foreground"><CalendarDays className="h-3.5 w-3.5" /> Schedule</p>
          <p className="mt-1 text-[12.5px] font-medium text-ink">
            {formatDate(event.startDate)} – {formatDate(event.endDate)}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="flex items-center gap-1.5 text-[11px] text-subtle-foreground"><MapPin className="h-3.5 w-3.5" /> Venue</p>
          <p className="mt-1 text-[12.5px] font-medium text-ink">{event.venue ?? 'To be announced'}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="flex items-center gap-1.5 text-[11px] text-subtle-foreground"><Ticket className="h-3.5 w-3.5" /> Registration</p>
          <p className="mt-1 text-[12.5px] font-medium text-ink">
            {event.registration?.isEnabled ? 'Open' : 'Closed'} · {formatCurrency(event.registration?.fee ?? 0)}
            {event.registration?.maxParticipants ? ` · max ${event.registration.maxParticipants}` : ''}
          </p>
        </div>
      </div>

      {canManage ? (
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value);
            setPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="registrations">Registrations</TabsTrigger>
            <TabsTrigger value="checkin">Check-in</TabsTrigger>
            {canVerifyPayments ? <TabsTrigger value="payments">Payments</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="registrations">
            <SectionCard
              title="Registrations"
              description="Approve pending participants and mark attendance"
              padded={false}
              action={
                <Input
                  value={search}
                  onChange={(inputEvent) => {
                    setSearch(inputEvent.target.value);
                    setPage(1);
                  }}
                  placeholder="Search participant…"
                  className="h-8 w-48 text-[12px]"
                  aria-label="Search registrations"
                />
              }
            >
              <div className="flex flex-wrap gap-1.5 px-5 pb-3">
                {['all', 'pending', 'confirmed', 'rejected', 'cancelled'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setStatusFilter(value);
                      setPage(1);
                    }}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      statusFilter === value
                        ? 'bg-primary text-white'
                        : 'border border-line text-ink-soft hover:bg-surface-subtle'
                    }`}
                  >
                    {titleCase(value)}
                  </button>
                ))}
              </div>
              <DataTable
                columns={registrationColumns}
                rows={registrationsQuery.data?.data}
                loading={registrationsQuery.isLoading}
                error={registrationsQuery.error}
                onRetry={() => void registrationsQuery.refetch()}
                rowKey={(row) => row._id}
                emptyIcon={Ticket}
                emptyTitle="No registrations yet"
                emptyDescription="Participants appear here once students register."
                footer={
                  registrationsQuery.data ? (
                    <TableFooterBar
                      page={registrationsQuery.data.pagination.page}
                      totalPages={registrationsQuery.data.pagination.totalPages}
                      total={registrationsQuery.data.pagination.total}
                      onPageChange={setPage}
                      label="registrations"
                    />
                  ) : null
                }
              />
            </SectionCard>
          </TabsContent>

          <TabsContent value="checkin">
            <SectionCard title="Check-in" description="Scan a participant's QR code or paste the code printed on their pass">
              <form onSubmit={checkInByCode} className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <QrCode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" />
                  <Input
                    value={qrCode}
                    onChange={(checkInEvent) => setQrCode(checkInEvent.target.value)}
                    placeholder="CHK-XXXXXXXXXXXX"
                    className="pl-9 font-mono uppercase"
                    aria-label="Check-in code"
                  />
                </div>
                <Button type="submit" loading={checkingIn} disabled={!qrCode.trim()}>
                  Check in
                </Button>
              </form>
              <p className="mt-3 rounded-xl bg-surface-subtle/70 px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
                Every registration has a unique code. A code can only be checked in once — duplicate scans are
                rejected by the server. You can also check in from the registrations list using the participant row.
              </p>
            </SectionCard>
          </TabsContent>

          {canVerifyPayments ? (
            <TabsContent value="payments">
              <SectionCard title="Payments" description="Verify UPI or bank references submitted by participants" padded={false}>
                <DataTable
                  columns={paymentColumns}
                  rows={paymentsQuery.data?.data}
                  loading={paymentsQuery.isLoading}
                  error={paymentsQuery.error}
                  onRetry={() => void paymentsQuery.refetch()}
                  rowKey={(row) => row._id}
                  emptyIcon={IndianRupee}
                  emptyTitle="No payments for this event"
                  emptyDescription="Payments appear here once participants submit a payment reference."
                />
              </SectionCard>
            </TabsContent>
          ) : null}
        </Tabs>
      ) : null}

      {(event.subEvents?.length ?? 0) > 0 ? (
        <div className="mt-4">
          <SectionCard title="Sub-events" description="Competitions and activities under this event">
            <ul className="divide-y divide-line">
              {event.subEvents!.map((subEvent) => (
                <li key={subEvent._id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/dashboard/events/detail?id=${subEvent._id}`} className="truncate text-[13px] font-medium text-ink hover:text-primary">
                      {subEvent.title}
                    </Link>
                    <p className="text-[11.5px] text-muted-foreground">
                      {formatDate(subEvent.startDate)} · {subEvent.stats?.registrations ?? 0} registrations ·{' '}
                      {formatCurrency(subEvent.registration?.fee ?? 0)}
                    </p>
                  </div>
                  <Badge variant={statusVariant(subEvent.status)} size="sm">{titleCase(subEvent.status)}</Badge>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
};

export default function EventDetailPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <EventDetail />
    </Suspense>
  );
}
