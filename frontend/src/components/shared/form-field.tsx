'use client';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Consistent label + control + validation message block used by every form. */
export const FormField = ({ label, htmlFor, error, hint, required, children, className }: FormFieldProps) => (
  <div className={cn('space-y-1.5', className)}>
    <Label htmlFor={htmlFor} required={required}>
      {label}
    </Label>
    {children}
    {error ? (
      <p className="text-[11.5px] font-medium text-danger" role="alert">
        {error}
      </p>
    ) : hint ? (
      <p className="text-[11px] leading-relaxed text-subtle-foreground">{hint}</p>
    ) : null}
  </div>
);
