import { updateSession } from './lib/supabase/middleware';

export async function middleware(request: Parameters<typeof updateSession>[0]) {
  return updateSession(request);
}

export const runtime = 'nodejs';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
