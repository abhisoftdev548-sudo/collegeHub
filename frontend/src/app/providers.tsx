'use client';

import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';

export const Providers = ({ children }: { children: React.ReactNode }) => (
  <QueryProvider>
    <AuthProvider>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            classNames: {
              toast: 'rounded-xl border border-line bg-surface text-ink shadow-raised',
              title: 'text-sm font-medium text-ink',
              description: 'text-xs text-muted-foreground',
            },
          }}
        />
      </TooltipProvider>
    </AuthProvider>
  </QueryProvider>
);
