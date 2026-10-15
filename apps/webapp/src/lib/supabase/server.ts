import { DbSchema } from '@first2apply/core';
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  const cookieMethods: CookieMethodsServer = {
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      } catch {
        // Server components cannot always write cookies. Middleware refreshes the session.
      }
    },
  };

  return createServerClient<DbSchema>(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookies: cookieMethods,
  });
}
