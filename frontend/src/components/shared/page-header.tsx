'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
  className?: string;
}

export const PageHeader = ({ title, description, actions, eyebrow, className }: PageHeaderProps) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    className={cn('mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}
  >
    <div className="min-w-0">
      {eyebrow ? (
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          {eyebrow}
        </span>
      ) : null}
      <h1 className="truncate font-display text-[22px] font-semibold leading-tight tracking-tight text-ink sm:text-2xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </motion.div>
);
