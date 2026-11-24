import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', invalid, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex h-10 w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink shadow-[0_1px_1px_rgba(22,36,61,0.03)] transition-colors',
        'placeholder:text-subtle-foreground',
        'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15',
        'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70',
        'file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary-hover',
        invalid && 'border-danger focus-visible:border-danger focus-visible:ring-danger/15',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      'flex min-h-[92px] w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink transition-colors placeholder:text-subtle-foreground',
      'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15',
      'disabled:cursor-not-allowed disabled:bg-surface-muted',
      invalid && 'border-danger focus-visible:border-danger focus-visible:ring-danger/15',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
