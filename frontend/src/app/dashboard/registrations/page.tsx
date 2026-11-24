'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Download, Ticket } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, TableFooterBar, type Column } from '@/components/shared/data-table';
import { FilterBar } from '@/components/shared/filter-bar';
import { Button } from '@/components/ui/button';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, downloadFile } from '@/lib/api';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';
import type { EventItem, Registration } from '@/types/api';

/** Aggregate view of registrations across all events. */
export default function RegistrationsPage() {
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const { data: events } = useQuery({
    queryKey: ['events', 'for-registrations'],
    queryFn: () => api.get<EventItem[]>('/events', { params: { limit: 100, includeSubEvents: true } }),
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['registrations-all', eventFilter, status, page, search],
    queryFn: () =>
      api.getPaginated<Registration>(`/events/${eventFilter}/registrations`, {
        params: {
          page,
          limit: 20,
          status: status === 'all' ? undefined : status,
          search: search || undefined,
        },
      }),
    enabled: eventFilter !== 'all',
  });

  const columns: Column<Registration>[] = [
    {
      key: 'student',
      header: 'Participant',
      render: (row) => {
        const student = typeof row.student === 'object' ? row.student : null;
        return (
          <div>
            <p className="font-medium text-ink">{student?.name ?? 'Student'}</p>
            <p className="text-[11px] text-muted-foreground">{student?.email ?? '—'}</p>
          </div>
        );
      },
    },
    { key: 'registrationId', header: 'Registration', render: (row) => <span className="font-mono text-[11.5px]">{row.registrationId}</span> },
    {
      key: 'event',
      header: 'Event',
      render: (row) => (
        <Link
          href={`/dashboard/events/detail?id=${typeof row.event === 'object' ? row.event._id : row.event}`}
          className="text-[12.5px] text-primary hover:underline"
        >
          {typeof row.event === 'object' ? row.event.title : 'Event'}
        </Link>
      ),
    },
    {
      key: 'fee',
      header: 'Fee',
      render: (row) => (
        <div className="text-[12px]">
          <p className="tabular-nums">{formatCurrency(row.feeAmount)}</p>
          <Badge variant={statusVariant(row.paymentStatus)} size="sm">{titleCase(row.paymentStatus)}</Badge>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <Badge variant={statusVariant(row.status)}>{titleCase(row.status)}</Badge> },
    { key: 'submitted', header: 'Registered', render: (row) => <span className="text-[12px] text-muted-foreground">{formatDate(row.submittedAt)}</span> },
    {
      key: 'checkin',
      header: 'Check-in',
      render: (row) =>
        row.checkedInAt ? (
          <Badge variant="success" size="sm">Checked in</Badge>
        ) : (
          <span className="text-[11.5px] text-subtle-foreground">Not yet</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Events"
        title="Registrations"
        description="Browse participant registrations per event, with fees and check-in status."
        actions={
          eventFilter !== 'all' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void downloadFile(`/events/${eventFilter}/registrations/export`, 'event-registrations.csv')}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          ) : null
        }
      />

      <FilterBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Search participant…"
        className="mb-4"
        onReset={() => {
          setSearch('');
          setEventFilter('all');
          setStatus('all');
          setPage(1);
        }}
      >
        <Select
          value={eventFilter}
          onValueChange={(value) => {
            setEventFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-full text-[13px] sm:w-64">
            <SelectValue placeholder="Select an event" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Select an event…</SelectItem>
            {(events ?? []).map((event) => (
              <SelectItem key={event._id} value={event._id}>{event.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-full text-[13px] sm:w-36">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {['pending', 'confirmed', 'rejected', 'cancelled', 'waitlisted'].map((value) => (
              <SelectItem key={value} value={value}>{titleCase(value)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {eventFilter === 'all' ? (
        <div className="rounded-card border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
          <Ticket className="mx-auto mb-3 h-6 w-6 text-primary" strokeWidth={1.6} />
          <h3 className="font-display text-[15px] font-semibold text-ink">Choose an event</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Registrations are listed per event. Select an event above to review its participants.
          </p>
        </div>
      ) : (
        <div className="rounded-card border border-line bg-surface shadow-soft">
          <DataTable
            columns={columns}
            rows={data?.data}
            loading={isLoading}
            error={error}
            onRetry={() => void refetch()}
            rowKey={(row) => row._id}
            emptyIcon={Ticket}
            emptyTitle="No registrations"
            emptyDescription="No participants match the current filters."
            footer={
              data ? (
                <TableFooterBar
                  page={data.pagination.page}
                  totalPages={data.pagination.totalPages}
                  total={data.pagination.total}
                  onPageChange={setPage}
                  label="registrations"
                />
              ) : null
            }
          />
        </div>
      )}
    </div>
  );
}
