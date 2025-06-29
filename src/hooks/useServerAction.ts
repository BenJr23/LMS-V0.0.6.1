"use client";

import { useState, useCallback } from 'react';
import { ServerActionResult } from '@/lib/server-actions';
import toast from 'react-hot-toast';

interface UseServerActionOptions {
  onSuccess?: (data: unknown) => void;
  onError?: (error: string) => void;
  showToast?: boolean;
}

export function useServerAction<T extends unknown[], R>(
  action: (...args: T) => Promise<ServerActionResult<R>>,
  options: UseServerActionOptions = {}
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: T): Promise<ServerActionResult<R> | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await action(...args);

        if (result.success) {
          if (options.showToast !== false) {
            toast.success('Operation completed successfully');
          }
          options.onSuccess?.(result.data);
        } else {
          const errorMessage = result.error || 'An unexpected error occurred';
          setError(errorMessage);
          if (options.showToast !== false) {
            toast.error(errorMessage);
          }
          options.onError?.(errorMessage);
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(errorMessage);
        if (options.showToast !== false) {
          toast.error(errorMessage);
        }
        options.onError?.(errorMessage);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [action, options]
  );

  return {
    execute,
    isLoading,
    error,
    clearError: () => setError(null),
  };
} 