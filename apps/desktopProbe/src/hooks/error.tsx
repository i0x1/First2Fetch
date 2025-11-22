import { useCallback, useState } from 'react';

import { getExceptionMessage } from '@first2apply/core';
import { useToast } from '@first2apply/ui';

/**
 * Hook used to handle errors.
 */
export function useError() {
  const { toast } = useToast();

  const [error, setError] = useState<unknown>(null);

  const handleError = useCallback(
    ({
      error,
      title = 'Oops, something went wrong!',
      silent = false,
    }: {
      error: unknown;
      title?: string;
      silent?: boolean;
    }) => {
      console.error(getExceptionMessage(error));

      if (!silent) {
        toast({
          title,
          description: getExceptionMessage(error, true),
          variant: 'destructive',
        });
      }

      setError(error);
    },
    [toast],
  );

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  return { error, handleError, resetError };
}
