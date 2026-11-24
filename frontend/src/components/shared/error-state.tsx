'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api';

export const ErrorState = ({
  error,
  onRetry,
  title = 'We could not load this page',
  compact = false,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  compact?: boolean;
}) => (
  <div
    className={`flex flex-col items-center justify-center rounded-card border border-danger/20 bg-danger-soft/40 px-6 text-center ${
      compact ? 'py-8' : 'py-14'
    }`}
  >
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-soft">
      <AlertTriangle className="h-5 w-5 text-danger" />
    </div>
    <h3 className="font-display text-[15px] font-semibold text-ink">{title}</h3>
    <p className="mt-1.5 max-w-md text-[13px] text-muted-foreground">{getErrorMessage(error)}</p>
    {onRetry ? (
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" />
        Try again
      </Button>
    ) : null}
  </div>
);
