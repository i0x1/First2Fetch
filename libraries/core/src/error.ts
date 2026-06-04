function looksLikeNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const parts = [error.message, error.stack ?? '', String((error as Error & { cause?: unknown }).cause ?? '')];
  return /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network/i.test(parts.join(' '));
}

/**
 * Get an error string from an exception.
 */
export function getExceptionMessage(error: unknown, noStackTrace = false) {
  if (noStackTrace && looksLikeNetworkError(error)) {
    return "Can't reach the server. Your Wi‑Fi may be blocking Supabase — try mobile hotspot or another network.";
  }

  if (error instanceof Error) {
    return noStackTrace ? error.message : (error.stack ?? error.message);
  } else if (typeof error === 'object') {
    if (error && 'message' in error && 'details' in error && 'hint' in error && 'code' in error) {
      return `${error.message} - ${error.details}`;
    }

    return JSON.stringify(error);
  } else if (typeof error === 'string') {
    return error;
  }

  return `${error}`;
}

/**
 * Helper method used to throw an error.
 * Useful in situations where you want to assign a value or throw an error inline.
 *
 * e.g. const foo = obj.foo ?? throwError('obj.foo is undefined');
 */
export function throwError(message: string): never {
  throw new Error(message);
}
