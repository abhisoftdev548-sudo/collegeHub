import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

/**
 * Empty state with a light, geometric illustration (no stock imagery) so the
 * interface never looks broken when a collection has no records.
 */
export const EmptyState = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center rounded-card border border-dashed border-line-strong bg-surface/60 px-6 text-center',
      compact ? 'py-8' : 'py-14',
      className,
    )}
  >
    <div className="relative mb-4 flex h-16 w-16 items-center justify-center">
      <span className="absolute inset-0 rounded-2xl bg-primary-soft/70" aria-hidden />
      <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-accent/70" aria-hidden />
      <span className="absolute -bottom-1.5 left-0 h-2.5 w-2.5 rounded-full bg-primary/25" aria-hidden />
      <Icon className="relative h-6 w-6 text-primary" strokeWidth={1.6} aria-hidden />
    </div>
    <h3 className="font-display text-[15px] font-semibold text-ink">{title}</h3>
    {description ? (
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{description}</p>
    ) : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);
