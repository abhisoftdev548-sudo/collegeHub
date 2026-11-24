'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api';

/**
 * Thin wrapper around useMutation adding toast feedback and query
 * invalidation so every write gives the user a clear outcome.
 */
export function useApiMutation<TData, TVariables>({
  mutationFn,
  invalidate = [],
  successMessage,
  onSuccess,
}: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidate?: string[][];
  successMessage?: string | ((data: TData) => string);
  onSuccess?: (data: TData, variables: TVariables) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async (data, variables) => {
      await Promise.all(
        invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
      const message = typeof successMessage === 'function' ? successMessage(data) : successMessage;
      if (message) toast.success(message);
      onSuccess?.(data, variables);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}
