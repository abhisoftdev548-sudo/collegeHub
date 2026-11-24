'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronRight, LogOut, Menu, Settings, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge, statusVariant } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/auth-provider';
import { api } from '@/lib/api';
import { initials, titleCase } from '@/lib/utils';
import { GlobalSearch } from './global-search';

const labelForSegment = (segment: string): string =>
  titleCase(decodeURIComponent(segment).replace(/\.(html?|tsx?)$/, ''));

export const Topbar = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const pathname = usePathname();
  const { user, signOut, isCR, isVolunteer } = useAuth();

  const { data: notifications } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get<{ unreadCount: number }>('/notifications?limit=1'),
    refetchInterval: 60_000,
  });

  const segments = pathname.split('/').filter(Boolean).slice(1);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </Button>

      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-[13px] text-muted-foreground sm:flex">
        <Link href="/dashboard" className="hover:text-ink">
          Dashboard
        </Link>
        {segments.map((segment, index) => (
          <span key={`${segment}-${index}`} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-subtle-foreground" />
            <span className={index === segments.length - 1 ? 'truncate font-medium text-ink' : 'truncate'}>
              {labelForSegment(segment)}
            </span>
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        <GlobalSearch />
        {isCR ? (
          <Badge variant="primary" className="hidden sm:inline-flex">
            Class Representative
          </Badge>
        ) : null}
        {isVolunteer ? (
          <Badge variant="accent" className="hidden sm:inline-flex">
            Volunteer
          </Badge>
        ) : null}

        <Link
          href="/dashboard/notifications"
          className="relative rounded-lg p-2 text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink"
          aria-label={`Notifications${notifications?.unreadCount ? ` (${notifications.unreadCount} unread)` : ''}`}
        >
          <Bell className="h-[18px] w-[18px]" />
          {notifications?.unreadCount ? (
            <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-danger ring-2 ring-canvas" />
          ) : null}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 flex items-center gap-2 rounded-xl p-1 pr-2 transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
              aria-label="Account menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-[11px] text-white">
                  {initials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-left leading-tight md:block">
                <span className="block max-w-[150px] truncate text-[13px] font-medium text-ink">{user?.name}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {user?.role === 'teacher' ? user.designation ?? 'Teacher' : titleCase(user?.role)}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Signed in</DropdownMenuLabel>
            <div className="px-2.5 pb-2">
              <p className="truncate text-[13px] font-medium text-ink">{user?.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
              <Badge variant={statusVariant(user?.status)} size="sm" className="mt-1.5">
                {titleCase(user?.status ?? 'active')}
              </Badge>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile">
                <UserRound />
                My profile
              </Link>
            </DropdownMenuItem>
            {user?.permissions.includes('settings:manage') ? (
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings">
                  <Settings />
                  Settings
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="danger" onClick={() => void signOut()}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
