'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getErrorMessage } from '@/lib/api';
import { cn, formatDateTime, titleCase } from '@/lib/utils';
import type { NotificationItem } from '@/types/api';

/** GET /notifications returns { items, unreadCount }; POST /notifications/read takes { ids }. */
interface NotificationResponse {
  items: NotificationItem[];
  unreadCount: number;
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const notificationsQuery = useQuery({
    queryKey: ['notifications', filter],
    queryFn: () => api.get<NotificationResponse>('/notifications', { params: { limit: 50 } }),
  });

  const items = notificationsQuery.data?.items ?? [];
  const unreadCount = notificationsQuery.data?.unreadCount ?? items.filter((item) => !item.read).length;
  const visible = filter === 'unread' ? items.filter((item) => !item.read) : items;

  const markAll = async () => {
    try {
      await api.post('/notifications/read', {});
      toast.success('All notifications marked as read');
      await notificationsQuery.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const markOne = async (id: string) => {
    try {
      await api.post('/notifications/read', { ids: [id] });
      await notificationsQuery.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Notifications"
        description="Registrations, payments, results and announcements relevant to you."
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={() => void markAll()}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          ) : null
        }
      />

      <div className="mb-4 inline-flex gap-1 rounded-xl border border-line bg-surface-subtle p-1">
        {(['all', 'unread'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              filter === value
                ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(22,36,61,0.08)]'
                : 'text-muted-foreground hover:text-ink',
            )}
          >
            {titleCase(value)}
            {value === 'unread' && unreadCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] text-white">{unreadCount}</span>
            ) : null}
          </button>
        ))}
      </div>

      {notificationsQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : notificationsQuery.error ? (
        <ErrorState error={notificationsQuery.error} onRetry={() => void notificationsQuery.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={filter === 'unread' ? 'You are all caught up' : 'No notifications yet'}
          description="Activity on your registrations, tasks and announcements will show up here."
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => (
            <li
              key={item._id}
              className={cn(
                'flex items-start gap-3 rounded-card border px-4 py-3 transition-colors',
                item.read ? 'border-line bg-surface' : 'border-primary/20 bg-primary-soft/30',
              )}
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Bell className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-medium text-ink">{item.title}</p>
                  {!item.read ? <Badge variant="primary" size="sm">New</Badge> : null}
                </div>
                {item.message ? <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{item.message}</p> : null}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[10.5px] text-subtle-foreground">{formatDateTime(item.createdAt)}</span>
                  {item.link ? (
                    <Link href={item.link} className="text-[11px] font-medium text-primary hover:underline">
                      View
                    </Link>
                  ) : null}
                  {!item.read ? (
                    <button
                      type="button"
                      onClick={() => void markOne(item._id)}
                      className="text-[11px] text-muted-foreground hover:text-ink"
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
