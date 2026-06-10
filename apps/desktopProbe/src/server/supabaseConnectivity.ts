/**
 * Detect whether Supabase Cloud is reachable from this machine/network.
 * Used at startup to surface router/firewall blocks that cause ECONNREFUSED on Wi‑Fi.
 */
export type SupabaseReachabilityResult =
  | { ok: true }
  | { ok: false; kind: 'local'; message: string }
  | { ok: false; kind: 'network_blocked'; message: string }
  | { ok: false; kind: 'unreachable'; message: string };

function isLocalSupabaseHost(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
}

function isConnectionRefused(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const parts = [error.message, error.stack ?? '', String((error as Error & { cause?: unknown }).cause ?? '')];
  return /ECONNREFUSED|fetch failed/i.test(parts.join(' '));
}

export async function checkSupabaseReachability(supabaseUrl: string): Promise<SupabaseReachabilityResult> {
  let parsed: URL;
  try {
    parsed = new URL(supabaseUrl);
  } catch {
    return { ok: false, kind: 'unreachable', message: 'SUPABASE_URL is not a valid URL.' };
  }

  const healthUrl = `${parsed.origin}/auth/v1/health`;
  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: { apikey: 'reachability-check' },
      signal: AbortSignal.timeout(10_000),
    });

    // Missing apikey still proves TCP/TLS to the project API works.
    if (response.status === 401 || response.status === 200) {
      return { ok: true };
    }

    return {
      ok: false,
      kind: 'unreachable',
      message: `Supabase health check returned HTTP ${response.status}.`,
    };
  } catch (error) {
    if (isConnectionRefused(error)) {
      if (isLocalSupabaseHost(parsed.hostname)) {
        return {
          ok: false,
          kind: 'local',
          message:
            'Local Supabase is not running.\n\n' +
            'In a terminal:\n' +
            '  cd apps/backend && npx supabase start   (not apps/desktopProbe)\n\n' +
            'Then set SUPABASE_URL=http://127.0.0.1:54321 in apps/desktopProbe/.env',
        };
      }

      return {
        ok: false,
        kind: 'network_blocked',
        message:
          'Your network is blocking connections to Supabase Cloud (ECONNREFUSED on the project API host).\n\n' +
          'This is usually your Wi‑Fi router or firewall blocking certain Cloudflare IP ranges — not a bug in today\'s app changes.\n\n' +
          'What works:\n' +
          '• Mobile hotspot or VPN on Wi‑Fi\n' +
          '• Local Supabase: SUPABASE_URL=http://127.0.0.1:54321 and `cd apps/backend && npx supabase start`\n\n' +
          'Router fixes: disable “threat protection”, Pi-hole/AdGuard on the router, or parental-control security filters, then reboot the router.',
      };
    }

    return {
      ok: false,
      kind: 'unreachable',
      message: `Cannot reach Supabase at ${parsed.hostname}. ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
