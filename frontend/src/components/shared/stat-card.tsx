'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CardSkeleton } from '@/components/ui/skeleton';

interface StatCardProps {
  label: string;
  value: number | string | undefined;
  icon: LucideIcon;
  hint?: string;
  href?: string;
  tone?: 'primary' | 'accent' | 'success' | 'neutral';
  loading?: boolean;
}

const toneStyles = {
  primary: 'bg-primary-soft text-primary-hover',
  accent: 'bg-accent-soft text-accent-foreground',
  success: 'bg-success-soft text-success',
  neutral: 'bg-surface-subtle text-ink-soft',
} as const;

export const StatCard = ({ label, value, icon: Icon, hint, href, tone = 'primary', loading }: StatCardProps) => {
  if (loading) return <CardSkeleton />;

  const body = (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
      className="group relative flex h-full flex-col justify-between rounded-card border border-line bg-surface p-5 shadow-soft"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', toneStyles[tone])}>
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <span className="font-display text-[26px] font-semibold leading-none tracking-tight text-ink">
          {value ?? 0}
        </span>
        {href ? (
          <ArrowUpRight className="h-4 w-4 text-subtle-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
        ) : null}
      </div>
      {hint ? <p className="mt-2 text-[11px] text-subtle-foreground">{hint}</p> : null}
    </motion.div>
  );

  return href ? (
    <Link href={href} className="block h-full rounded-card focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
};
