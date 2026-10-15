import Link from 'next/link';
import { EMAIL_OTP_MAX_LENGTH, EMAIL_OTP_MIN_LENGTH, EMAIL_OTP_PATTERN, EMAIL_OTP_PLACEHOLDER } from '@first2apply/core';

import { login, requestLoginCode, verifyLoginCode } from '@/app/actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; step?: string; email?: string }> }) {
  const params = await searchParams;
  return (
    <main className="shell" style={{ maxWidth: 480 }}>
      <div className="card" style={{ padding: 28 }}>
        <p className="muted">First 2 Fetch</p>
        <h1>Sign in</h1>
        <p className="muted">Open the shared job workspace from any browser.</p>
        {params.error && <p style={{ color: '#a12525' }}>{params.error}</p>}
        {params.message && <p style={{ color: '#226b3a' }}>{params.message}</p>}
        {params.step === 'code' && params.email ? <form action={verifyLoginCode} style={{ display: 'grid', gap: 14 }}>
          <input type="hidden" name="email" value={params.email} />
          <label>Email code<input className="field" name="token" inputMode="numeric" pattern={EMAIL_OTP_PATTERN} minLength={EMAIL_OTP_MIN_LENGTH} maxLength={EMAIL_OTP_MAX_LENGTH} placeholder={EMAIL_OTP_PLACEHOLDER} autoComplete="one-time-code" required /></label>
          <button className="button primary" type="submit">Verify code</button>
          <button className="button" formAction={requestLoginCode} formNoValidate type="submit">Send a new code</button>
        </form> : <>
        <form action={login} style={{ display: 'grid', gap: 14 }}>
          <label>
            Email
            <input className="field" name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input className="field" name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="button primary" type="submit">Sign in</button>
        </form>
        <form action={requestLoginCode} style={{ marginTop: 12 }}>
          <label>Sign in with email code<input className="field" name="email" type="email" autoComplete="email" required /></label>
          <button className="button" type="submit" style={{ marginTop: 8 }}>Email me a code</button>
        </form>
        </>}
        <p className="muted" style={{ marginTop: 18 }}>
          Need the helper account? <Link href="/signup">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
