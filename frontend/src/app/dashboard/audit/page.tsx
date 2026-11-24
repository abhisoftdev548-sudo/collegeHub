'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, TableFooterBar, type Column } from '@/components/shared/data-table';
import { FilterBar } from '@/components/shared/filter-bar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { formatDateTime, titleCase } from '@/lib/utils';
import type { AuditLogEntry } from '@/types/api';

const ENTITY_VARIANT: Record<string, 'primary' | 'accent' | 'success' | 'neutral' | 'warning' | 'danger'> = {
  User: 'primary',
  StudentProfile: 'accent',
  Event: 'success',
  EventRegistration: 'warning',
  Payment: 'danger',
  Announcement: 'accent',
};

export default function AuditPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['audit-logs', page, entity],
    queryFn: () =>
      api.getPaginated<AuditLogEntry>('/reports/audit-logs', {
        params: { page, limit: 25, entity: entity || undefined },
      }),
  });

  const rows = (data?.data ?? []).filter((row) => {
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return (
      row.action.toLowerCase().includes(needle) ||
      (row.description ?? '').toLowerCase().includes(needle) ||
      row.entity.toLowerCase().includes(needle)
    );
  });

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <div>
          <p className="font-mono text-[12px] font-medium text-ink">{row.action}</p>
          {row.description ? <p className="text-[11px] text-muted-foreground">{row.description}</p> : null}
        </div>
      ),
    },
    {
      key: 'entity',
      header: 'Entity',
      render: (row) => (
        <Badge variant={ENTITY_VARIANT[row.entity] ?? 'neutral'} size="sm">
          {titleCase(row.entity)}
        </Badge>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (row) => (
        <span className="text-[12px]">
          {row.actor?.name ?? 'System'}
          {row.actor?.role ? <span className="text-muted-foreground"> · {titleCase(row.actor.role)}</span> : null}
        </span>
      ),
    },
    {
      key: 'ip',
      header: 'Source',
      render: (row) => <span className="font-mono text-[11px] text-muted-foreground">{row.ip ?? '—'}</span>,
    },
    {
      key: 'time',
      header: 'When',
      render: (row) => <span className="text-[11.5px] text-muted-foreground">{formatDateTime(row.createdAt)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Activity log"
        description="Every administrative action, authentication event and record change, kept for audit."
      />

      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-primary-soft-strong bg-primary-soft/40 px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          The audit trail is append-only. Entries record who performed an action, from which IP address, and
          when — useful for compliance reviews and incident investigations.
        </p>
      </div>

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Filter by action or description…" className="mb-4" onReset={() => { setSearch(''); setEntity(''); setPage(1); }}>
        <Input
          value={entity}
          onChange={(event) => {
            setEntity(event.target.value);
            setPage(1);
          }}
          placeholder="Entity (e.g. User)"
          className="h-9 w-full text-[13px] sm:w-44"
          aria-label="Filter by entity"
        />
      </FilterBar>

      <div className="rounded-card border border-line bg-surface shadow-soft">
        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          rowKey={(row) => row._id}
          emptyIcon={Activity}
          emptyTitle="No activity recorded"
          emptyDescription="Actions performed in the system will appear here."
          footer={
            data ? (
              <TableFooterBar
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                total={data.pagination.total}
                onPageChange={setPage}
                label="entries"
              />
            ) : null
          }
        />
      </div>
    </div>
  );
}
