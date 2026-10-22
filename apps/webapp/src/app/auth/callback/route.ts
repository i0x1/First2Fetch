import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { authRedirectUrl } from '@/lib/authRedirect';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const supabase = await createClient();
  let failed = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  } else if (tokenHash) {
    const requestedType = url.searchParams.get('type');
    const type = requestedType === 'invite' || requestedType === 'magiclink' || requestedType === 'signup' ? requestedType : 'email';
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    failed = Boolean(error);
  } else {
    failed = true;
  }
  const nextPath = failed ? '/login?error=This%20sign-in%20link%20is%20invalid%20or%20expired.' : url.searchParams.get('next');
  return NextResponse.redirect(authRedirectUrl(request.url, nextPath, process.env.WEBAPP_URL));
}
