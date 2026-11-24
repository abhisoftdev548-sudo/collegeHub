'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, IndianRupee, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, TableFooterBar, type Column } from '@/components/shared/data-table';
import { FilterBar } from '@/components/shared/filter-bar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, getErrorMessage } from '@/lib/api';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';
import type { Payment } from '@/types/api';

export default function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['payments', status, page, search],
    queryFn: () =>
      api.getPaginated<Payment>('/events/payments', {
        params: {
          page,
          limit: 20,
          status: status === 'all' ? undefined : status,
          search: search || undefined,
        },
      }),
  });

  const verify = async (paymentId: string, outcome: 'paid' | 'failed' | 'refunded') => {
    try {
      await api.post(`/events/payments/${paymentId}/verify`, { outcome });
      toast.success(`Payment marked ${outcome}`);
      await refetch();
    } catch (verifyError) {
      toast.error(getErrorMessage(verifyError));
    }
  };

  const columns: Column<Payment>[] = [
    {
      key: 'payment',
      header: 'Payment',
      render: (row) => (
        <div>
          <p className="font-mono text-[12px] text-ink">{row.paymentId}</p>
          <p className="text-[11px] text-muted-foreground">
            {typeof row.student === 'object' ? row.student?.name : 'Student'} ·{' '}
            {typeof row.event === 'object' ? row.event?.title : 'Event'}
          </p>
        </div>
      ),
    },
    { key: 'amount', header: 'Amount', render: (row) => <span className="tabular-nums font-medium text-ink">{formatCurrency(row.amount)}</span> },
    { key: 'method', header: 'Method', render: (row) => <Badge variant="neutral" size="sm">{titleCase(row.method)}</Badge> },
    { key: 'reference', header: 'Reference', render: (row) => <span className="font-mono text-[11.5px]">{row.reference ?? '—'}</span> },
    { key: 'status', header: 'Status', render: (row) => <Badge variant={statusVariant(row.status)}>{titleCase(row.status)}</Badge> },
    { key: 'created', header: 'Created', render: (row) => <span className="text-[12px] text-muted-foreground">{formatDate(row.createdAt)}</span> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) =>
        row.status === 'pending' ? (
          <div className="flex justify-end gap-1">
            <ConfirmDialog
              trigger={<Button size="sm"><CheckCircle2 className="h-3.5 w-3.5" /> Mark paid</Button>}
              title="Confirm this payment?"
              description={`${formatCurrency(row.amount)} will be recorded as paid and the participant's registration confirmed automatically.`}
              confirmLabel="Confirm payment"
              destructive={false}
              onConfirm={() => verify(row._id, 'paid')}
            />
            <ConfirmDialog
              trigger={<Button variant="ghost" size="sm"><XCircle className="h-3.5 w-3.5 text-danger" /></Button>}
              title="Reject this payment?"
              description="The participant will be notified that the payment could not be verified."
              confirmLabel="Reject"
              onConfirm={() => verify(row._id, 'failed')}
            />
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
      <PageHeader
        eyebrow="Events"
        title="Payments"
        description="Verify manual UPI or bank transfers. Paid registrations are confirmed automatically."
      />

      <FilterBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Search payment ID or reference…"
        className="mb-4"
        onReset={() => {
          setSearch('');
          setStatus('pending');
          setPage(1);
        }}
      >
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-full text-[13px] sm:w-40">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {['pending', 'paid', 'failed', 'refunded'].map((value) => (
              <SelectItem key={value} value={value}>{titleCase(value)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <div className="rounded-card border border-line bg-surface shadow-soft">
        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          rowKey={(row) => row._id}
          emptyIcon={IndianRupee}
          emptyTitle={status === 'pending' ? 'No pending payments' : 'No payments found'}
          emptyDescription={
            status === 'pending'
              ? 'All payment references have been reviewed.'
              : 'Payments appear here when participants register for paid events.'
          }
          footer={
            data ? (
              <TableFooterBar
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                total={data.pagination.total}
                onPageChange={setPage}
                label="payments"
              />
            ) : null
          }
        />
      </div>
    </div>
  );
}
