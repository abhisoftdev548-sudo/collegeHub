'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GraduationCap, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getNavigation } from '@/lib/navigation';
import { useAuth } from '@/providers/auth-provider';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export const Sidebar = ({ open, onClose }: SidebarProps) => {
  const pathname = usePathname();
  const { user, hasAnyPermission, responsibilities } = useAuth();

  const { data: notificationData } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get<{ unreadCount: number }>('/notifications?limit=1'),
    refetchInterval: 60_000,
  });

  const sections = getNavigation()
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.roles && user && !item.roles.includes(user.role)) return false;
        if (item.responsibility && !responsibilities.includes(item.responsibility)) return false;
        if (item.permissions?.length && !hasAnyPermission(...item.permissions)) return false;
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  return (
    <>
      {/* Mobile scrim */}
      <div
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-ink/25 backdrop-blur-[1px] transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-line bg-surface transition-transform duration-300 lg:sticky lg:top-0 lg:z-0 lg:h-dvh lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-line px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-[0_6px_16px_-6px_rgba(59,118,232,0.8)]">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-[15px] font-semibold tracking-tight text-ink">CollegeHub</span>
              <span className="block text-[10.5px] font-medium uppercase tracking-[0.12em] text-subtle-foreground">
                PDPSC Chhatarpur
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-subtle lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="mb-1.5 px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-subtle-foreground">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          'group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors',
                          active
                            ? 'bg-primary-soft text-primary-hover'
                            : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-[17px] w-[17px] shrink-0',
                            active ? 'text-primary' : 'text-subtle-foreground group-hover:text-primary',
                          )}
                          strokeWidth={1.8}
                        />
                        <span className="truncate">{item.label}</span>
                        {item.badge === 'notifications' && (notificationData?.unreadCount ?? 0) > 0 ? (
                          <Badge variant="primary" size="sm" className="ml-auto">
                            {notificationData?.unreadCount}
                          </Badge>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {sections.length === 0 && user ? <Skeleton className="h-24 w-full" /> : null}
        </nav>

        <div className="border-t border-line p-3">
          <div className="rounded-xl bg-gradient-to-br from-primary-soft to-accent-soft/60 p-3">
            <p className="text-[11px] font-semibold text-ink">Pundit Dev Prabhakar Shashtri College</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">
              Academic & event operations · Chhatarpur, MP
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
