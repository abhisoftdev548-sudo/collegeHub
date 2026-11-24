'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ExternalLink, Pencil, Plus, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { FilterBar } from '@/components/shared/filter-bar';
import { EventFormDialog } from '@/components/events/event-form-dialog';
import { Button } from '@/components/ui/button';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Department, DynamicForm, EventCategory, EventItem, Teacher } from '@/types/api';

export default function EventsPage() {
  const { hasAnyPermission } = useAuth();
  const canManage = hasAnyPermission('event:update', 'event:create');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventItem | null>(null);

  const { data: categories } = useQuery({
    queryKey: ['event-categories'],
    queryFn: () => api.get<EventCategory[]>('/events/categories', { params: { includeInactive: true } }),
  });
  const { data: forms } = useQuery({
    queryKey: ['forms'],
    queryFn: () => api.get<DynamicForm[]>('/events/forms'),
    enabled: canManage,
  });
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<Department[]>('/academic/departments'),
    enabled: canManage,
  });
  const { data: teachers } = useQuery({
    queryKey: ['teachers', 'options'],
    queryFn: () => api.getPaginated<Teacher>('/teachers', { params: { limit: 100 } }),
    enabled: canManage,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['events', search, status, category],
    queryFn: () =>
      api.get<EventItem[]>('/events', {
        params: {
          search: search || undefined,
          status: status === 'all' ? undefined : status,
          category: category === 'all' ? undefined : category,
          includeSubEvents: true,
          limit: 100,
        },
      }),
  });

  const columns: Column<EventItem>[] = [
    {
      key: 'title',
      header: 'Event',
      render: (row) => (
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-hover">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <Link href={`/dashboard/events/detail?id=${row._id}`} className="font-medium text-ink hover:text-primary">
              {row.title}
            </Link>
            <p className="text-[11px] text-muted-foreground">
              {row.isMainEvent ? 'Main event' : `Sub-event of ${row.parentEvent?.title ?? 'parent event'}`}
              {row.venue ? ` · ${row.venue}` : ''}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'Schedule',
      render: (row) => (
        <span className="text-[12px]">
          {formatDate(row.startDate)}
          {row.endDate !== row.startDate ? ` – ${formatDate(row.endDate)}` : ''}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => <Badge variant="neutral" size="sm">{row.category?.name ?? 'General'}</Badge>,
    },
    {
      key: 'registration',
      header: 'Registrations',
      render: (row) => (
        <div className="text-[12px]">
          <span className="inline-flex items-center gap-1 font-medium tabular-nums text-ink">
            <Users className="h-3 w-3 text-subtle-foreground" />
            {row.stats?.registrations ?? 0}
          </span>
          <span className="text-muted-foreground"> · {formatCurrency(row.registration?.fee ?? 0)}</span>
          {row.registration?.requiresApproval ? (
            <Badge variant="warning" size="sm" className="ml-1">Approval</Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={statusVariant(row.status)}>{titleCase(row.status)}</Badge>,
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (row: EventItem) => (
              <div className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="sm" asChild aria-label={`Open ${row.title}`}>
                  <Link href={`/dashboard/events/detail?id=${row._id}`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(row);
                    setDialogOpen(true);
                  }}
                  aria-label={`Edit ${row.title}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          } satisfies Column<EventItem>,
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Events"
        title="Event management"
        description="Create events, publish them and track registrations, fees and check-ins."
        actions={
          canManage ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New event
            </Button>
          ) : null
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search events…"
        className="mb-4"
        onReset={() => {
          setSearch('');
          setStatus('all');
          setCategory('all');
        }}
      >
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-full text-[13px] sm:w-40">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {['draft', 'published', 'ongoing', 'completed', 'cancelled'].map((value) => (
              <SelectItem key={value} value={value}>{titleCase(value)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-full text-[13px] sm:w-40">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(categories ?? []).map((item) => (
              <SelectItem key={item._id} value={item._id}>{item.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <div className="rounded-card border border-line bg-surface shadow-soft">
        <DataTable
          columns={columns}
          rows={data}
          loading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          rowKey={(row) => row._id}
          emptyIcon={CalendarDays}
          emptyTitle="No events yet"
          emptyDescription="Create an event to start collecting registrations and payments."
          emptyAction={
            canManage ? (
              <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
                <Plus className="h-4 w-4" /> New event
              </Button>
            ) : null
          }
        />
      </div>

      <EventFormDialog
        open={dialogOpen}
        onOpenChange={(value) => {
          setDialogOpen(value);
          if (!value) setEditing(null);
        }}
        categories={categories ?? []}
        departments={departments ?? []}
        teachers={teachers?.data ?? []}
        forms={forms ?? []}
        parentEvents={(data ?? []).filter((event) => event.isMainEvent)}
        editing={editing}
        onSaved={() => void refetch()}
      />
    </div>
  );
}
