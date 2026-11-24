import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-5 ring-1 ring-inset whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-subtle text-ink-soft ring-line',
        primary: 'bg-primary-soft text-primary-hover ring-primary-soft-strong',
        success: 'bg-success-soft text-success ring-success/20',
        warning: 'bg-warning-soft text-warning ring-warning/20',
        danger: 'bg-danger-soft text-danger ring-danger/20',
        accent: 'bg-accent-soft text-accent-foreground ring-accent/40',
        outline: 'bg-transparent text-muted-foreground ring-line-strong',
      },
      size: {
        sm: 'px-2 py-0 text-[10px]',
        default: '',
      },
    },
    defaultVariants: { variant: 'neutral', size: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, size, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
);

/** Maps common domain status strings to badge styling, consistently. */
export const statusVariant = (
  status?: string | null,
): 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'accent' => {
  switch ((status ?? '').toLowerCase()) {
    case 'active':
    case 'confirmed':
    case 'paid':
    case 'present':
    case 'completed':
    case 'published':
    case 'approved':
    case 'accepted':
      return 'success';
    case 'pending':
    case 'draft':
    case 'preview':
    case 'upcoming':
    case 'waitlisted':
    case 'in_progress':
    case 'late':
      return 'warning';
    case 'cancelled':
    case 'rejected':
    case 'failed':
    case 'absent':
    case 'suspended':
    case 'blocked':
    case 'detained':
      return 'danger';
    case 'ongoing':
    case 'open':
    case 'registered':
      return 'primary';
    case 'paid_out':
    case 'refunded':
    case 'graduated':
      return 'accent';
    default:
      return 'neutral';
  }
};
export { badgeVariants };
