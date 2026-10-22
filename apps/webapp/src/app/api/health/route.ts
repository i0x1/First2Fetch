import { supabaseConfig } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export function GET() {
  try {
    supabaseConfig();
    return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ status: 'misconfigured' }, { status: 503 });
  }
}
