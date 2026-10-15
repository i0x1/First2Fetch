import Link from 'next/link';

import { signOut } from '@/app/actions';

export function Navbar() {
  return (
    <aside className="side-rail">
      <div className="rail-brand" title="First 2 Fetch">F2</div>
      <nav className="rail-nav" aria-label="Main navigation">
        <Link className="rail-link active" href="/jobs/new" title="Jobs">▣<span>Jobs</span></Link>
        <Link className="rail-link" href="/team" title="Team">◉<span>Team</span></Link>
      </nav>
      <div className="rail-bottom">
        <form action={signOut}>
          <button className="rail-link" title="Sign out" type="submit">⇥<span>Sign out</span></button>
        </form>
      </div>
    </aside>
  );
}
