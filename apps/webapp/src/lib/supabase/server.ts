import { DbSchema } from '@first2apply/core';
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseConfig } from './config';

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

  const { url, key } = supabaseConfig();
  return createServerClient<DbSchema>(url, key, {
    cookies: cookieMethods,
  });
}
