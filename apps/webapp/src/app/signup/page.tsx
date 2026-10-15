import Link from 'next/link';

import { signup } from '@/app/actions';

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="shell" style={{ maxWidth: 480 }}>
      <div className="card" style={{ padding: 28 }}>
        <p className="muted">First 2 Fetch</p>
        <h1>Create helper account</h1>
        <p className="muted">Create this account first. The workspace owner can then add its email from Team.</p>
        {params.error && <p style={{ color: '#a12525' }}>{params.error}</p>}
        <form action={signup} style={{ display: 'grid', gap: 14 }}>
          <label>
            Email
            <input className="field" name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input className="field" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <button className="button primary" type="submit">Create account</button>
        </form>
        <p className="muted" style={{ marginTop: 18 }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
