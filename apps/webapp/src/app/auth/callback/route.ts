import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  } else if (tokenHash) {
    const supabase = await createClient();
    await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
  }
  return NextResponse.redirect(new URL(url.searchParams.get('next') || '/jobs/new', request.url));
}
