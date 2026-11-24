'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { FilterBar } from '@/components/shared/filter-bar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useApiMutation } from '@/components/shared/use-api-mutation';
import { AnnouncementComposer } from '@/components/announcements/announcement-composer';
import { Button } from '@/components/ui/button';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CardSkeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatDateTime, titleCase } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Announcement } from '@/types/api';

const PRIORITY_VARIANT = {
  low: 'neutral',
  normal: 'primary',
  high: 'warning',
  urgent: 'danger',
} as const;

export default function AnnouncementsPage() {
  const { hasAnyPermission, user } = useAuth();
  // GET /announcements requires announcement:manage (admins & faculty); students
  // and CRs only ever see their own feed through /announcements/me.
  const canManage = hasAnyPermission('announcement:manage');
  const [tab, setTab] = useState<'all' | 'mine'>(canManage ? 'all' : 'mine');
  const [search, setSearch] = useState('');
  const [audience, setAudience] = useState('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);

  const allQuery = useQuery({
    queryKey: ['announcements', search, audience],
    queryFn: () =>
      api.getPaginated<Announcement>('/announcements', {
        params: {
          limit: 50,
          search: search || undefined,
          audience: audience === 'all' ? undefined : audience,
        },
      }),
    enabled: tab === 'all',
  });

  const mineQuery = useQuery({
    queryKey: ['announcements', 'me'],
    queryFn: () => api.getPaginated<Announcement>('/announcements/me', { params: { limit: 50 } }),
    enabled: tab === 'mine',
  });

  const deleteMutation = useApiMutation({
    mutationFn: (id: string) => api.delete(`/announcements/${id}`),
    invalidate: [['announcements']],
    successMessage: 'Announcement deleted',
  });

  const activeQuery = tab === 'all' ? allQuery : mineQuery;
  const items = activeQuery.data?.data ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Communication"
        title="Announcements"
        description="College-wide notices and targeted messages for departments, sections and events."
        actions={
          canManage ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setComposerOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New announcement
            </Button>
          ) : null
        }
      />

      {canManage ? (
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex gap-1 rounded-xl border border-line bg-surface-subtle p-1">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              tab === 'all' ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(22,36,61,0.08)]' : 'text-muted-foreground hover:text-ink'
            }`}
          >
            All announcements
          </button>
          <button
            type="button"
            onClick={() => setTab('mine')}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              tab === 'mine' ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(22,36,61,0.08)]' : 'text-muted-foreground hover:text-ink'
            }`}
          >
            For me
          </button>
        </div>
      </div>
      ) : null}

      {tab === 'all' && canManage ? (
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search announcements…"
          className="mb-4"
          onReset={() => {
            setSearch('');
            setAudience('all');
          }}
        >
          <Select value={audience} onValueChange={setAudience}>
            <SelectTrigger className="h-9 w-full text-[13px] sm:w-44">
              <SelectValue placeholder="Any audience" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any audience</SelectItem>
              {['college', 'department', 'course', 'semester', 'section', 'event', 'volunteer_group'].map((value) => (
                <SelectItem key={value} value={value}>{titleCase(value)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar>
      ) : null}

      {activeQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <CardSkeleton key={index} className="h-28" />
          ))}
        </div>
      ) : activeQuery.error ? (
        <ErrorState error={activeQuery.error} onRetry={() => void activeQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={tab === 'mine' ? 'No announcements for you' : 'No announcements yet'}
          description={
            tab === 'mine'
              ? 'Announcements for your department, section or events will appear here.'
              : 'Publish an announcement to reach students and staff.'
          }
          action={
            canManage ? (
              <Button size="sm" onClick={() => { setEditing(null); setComposerOpen(true); }}>
                <Plus className="h-4 w-4" /> New announcement
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((announcement) => {
            const isOwner = announcement.createdBy?._id === user?.id;
            return (
              <SectionCard
                key={announcement._id}
                title={announcement.title}
                description={`${titleCase(announcement.audience)} · ${formatDateTime(announcement.publishAt)}`}
                action={
                  <div className="flex items-center gap-1.5">
                    <Badge variant={PRIORITY_VARIANT[announcement.priority as keyof typeof PRIORITY_VARIANT] ?? 'neutral'} size="sm">
                      {titleCase(announcement.priority)}
                    </Badge>
                    {announcement.expiresAt ? (
                      <Badge variant="outline" size="sm">Expires {formatDateTime(announcement.expiresAt)}</Badge>
                    ) : null}
                    {canManage ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(announcement); setComposerOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="sm" aria-label={`Delete ${announcement.title}`}>
                              <Trash2 className="h-3.5 w-3.5 text-danger" />
                            </Button>
                          }
                          title="Delete this announcement?"
                          description="It will be removed from everyone's feed. Notifications already delivered stay in place."
                          confirmLabel="Delete"
                          onConfirm={() => deleteMutation.mutateAsync(announcement._id)}
                        />
                      </>
                    ) : null}
                  </div>
                }
              >
                <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{announcement.body}</p>
                {announcement.createdBy ? (
                  <p className="mt-2.5 text-[11px] text-subtle-foreground">
                    Posted by {announcement.createdBy.name} · {titleCase(announcement.createdBy.role)}
                    {isOwner ? ' · you' : ''}
                  </p>
                ) : null}
              </SectionCard>
            );
          })}
        </div>
      )}

      <AnnouncementComposer
        open={composerOpen}
        onOpenChange={(value) => {
          setComposerOpen(value);
          if (!value) setEditing(null);
        }}
        editing={editing}
        onSaved={() => {
          void activeQuery.refetch();
        }}
      />
    </div>
  );
}
