'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GraduationCap, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';

const links = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Events', href: '/events' },
];

export const SiteHeader = () => {
  const { user, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full transition-all duration-300',
        scrolled ? 'border-b border-line bg-canvas/85 backdrop-blur-md' : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-[0_6px_16px_-6px_rgba(59,118,232,0.8)]">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-[15px] font-semibold tracking-tight text-ink">CollegeHub</span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-subtle-foreground">
              PDPSC · Chhatarpur
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button size="sm" asChild>
            <Link href={!loading && user ? '/dashboard' : '/login'}>
              {!loading && user ? 'Go to dashboard' : 'Sign in'}
            </Link>
          </Button>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-ink-soft md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-line bg-surface px-4 py-3 md:hidden">
          <nav className="flex flex-col">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-soft"
              >
                {link.label}
              </Link>
            ))}
            <Button size="sm" className="mt-2" asChild>
              <Link href={user ? '/dashboard' : '/login'} onClick={() => setOpen(false)}>
                {user ? 'Go to dashboard' : 'Sign in'}
              </Link>
            </Button>
          </nav>
        </div>
      ) : null}
    </header>
  );
};
