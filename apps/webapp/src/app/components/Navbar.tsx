import Link from 'next/link';

import { signOut } from '@/app/actions';

export function Navbar() {
  return (
    <header className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', marginBottom: 20 }}>
      <strong>First 2 Fetch</strong>
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <Link href="/jobs/new">New</Link>
        <Link href="/jobs/applied">Applied</Link>
        <Link href="/jobs/archived">Archived</Link>
        <Link href="/team">Team</Link>
        <form action={signOut}>
          <button className="button" type="submit">Sign out</button>
        </form>
      </nav>
    </header>
  );
}
