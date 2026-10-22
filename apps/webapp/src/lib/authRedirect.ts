/** Keep post-login navigation on this application, including encoded browser URL rules. */
export function authRedirectUrl(requestUrl: string, nextPath: string | null, appUrl?: string): URL {
  const origin = new URL(appUrl || requestUrl).origin;
  if (!nextPath?.startsWith('/') || nextPath.startsWith('//') || nextPath.includes('\\')) {
    return new URL('/jobs/new', origin);
  }
  const target = new URL(nextPath, origin);
  return target.origin === origin ? target : new URL('/jobs/new', origin);
}
