'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Award, CalendarDays, Megaphone, Search, UserRound, Users, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

interface SearchResults {
  term: string;
  students: Array<{ _id: string; name: string; email: string; enrollmentNumber: string }>;
  teachers: Array<{ _id: string; name: string; email: string; designation?: string }>;
  events: Array<{ _id: string; title: string; status: string; startDate?: string }>;
  competitions: Array<{ _id: string; title: string; category?: string }>;
  announcements: Array<{ _id: string; title: string; audience: string }>;
}

const EMPTY: SearchResults = { term: '', students: [], teachers: [], events: [], competitions: [], announcements: [] };

/** Topbar quick search — keyboard accessible, scoped by the API. */
export const GlobalSearch = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      // Cmd/Ctrl+K focuses search, matching common dashboard conventions.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        containerRef.current?.querySelector('input')?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ['global-search', debounced],
    queryFn: () => api.get<SearchResults>('/search', { params: { q: debounced } }),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const results = data ?? EMPTY;
  const groups = [
    {
      key: 'students',
      label: 'Students',
      icon: Users,
      items: results.students.map((item) => ({
        id: item._id,
        title: item.name,
        subtitle: item.enrollmentNumber,
        href: `/dashboard/students/detail?id=${item._id}`,
      })),
    },
    {
      key: 'teachers',
      label: 'Teachers',
      icon: UserRound,
      items: results.teachers.map((item) => ({
        id: item._id,
        title: item.name,
        subtitle: item.designation ?? item.email,
        href: `/dashboard/teachers`,
      })),
    },
    {
      key: 'events',
      label: 'Events',
      icon: CalendarDays,
      items: results.events.map((item) => ({
        id: item._id,
        title: item.title,
        subtitle: item.status,
        href: `/dashboard/events/detail?id=${item._id}`,
      })),
    },
    {
      key: 'competitions',
      label: 'Competitions',
      icon: Award,
      items: results.competitions.map((item) => ({
        id: item._id,
        title: item.title,
        subtitle: item.category ?? 'Competition',
        href: `/dashboard/competitions/detail?id=${item._id}`,
      })),
    },
    {
      key: 'announcements',
      label: 'Announcements',
      icon: Megaphone,
      items: results.announcements.map((item) => ({
        id: item._id,
        title: item.title,
        subtitle: item.audience,
        href: `/dashboard/announcements`,
      })),
    },
  ].filter((group) => group.items.length > 0);

  const hasResults = groups.length > 0;
  const showPanel = open && debounced.length >= 2;

  // Students can only browse events; hide the box entirely for them.
  if (user?.role === 'student') return null;

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle-foreground" />
      <input
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search…"
        aria-label="Search students, teachers and events"
        className="h-8 w-52 rounded-lg border border-line bg-surface pl-8 pr-7 text-[12.5px] text-ink outline-none transition-all placeholder:text-subtle-foreground focus:w-64 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
      />
      {term ? (
        <button
          type="button"
          onClick={() => {
            setTerm('');
            setOpen(false);
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-subtle-foreground hover:text-ink"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1 text-[9.5px] text-subtle-foreground lg:block">
          ⌘K
        </kbd>
      )}

      {showPanel ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-80 overflow-hidden rounded-xl border border-line bg-surface shadow-raised">
          {isFetching && !hasResults ? (
            <p className="px-3 py-3 text-[12px] text-muted-foreground">Searching…</p>
          ) : !hasResults ? (
            <p className="px-3 py-3 text-[12px] text-muted-foreground">No matches for “{debounced}”.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {groups.map((group) => (
                <div key={group.key}>
                  <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-subtle-foreground">
                    <group.icon className="h-3 w-3" /> {group.label}
                  </p>
                  {group.items.map((item) => (
                    <button
                      key={`${group.key}-${item.id}`}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        setTerm('');
                        router.push(item.href);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left',
                        'hover:bg-surface-subtle focus:bg-surface-subtle focus:outline-none',
                      )}
                    >
                      <span className="truncate text-[12.5px] text-ink">{item.title}</span>
                      <span className="shrink-0 text-[10.5px] text-subtle-foreground">{item.subtitle}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
