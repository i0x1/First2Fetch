import { inviteMember, listWorkspaceMembers, removeMember } from '@/app/actions';
import { createClient } from '@/lib/supabase/server';

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const members = await listWorkspaceMembers();
  const isOwner = members.every((member) => member.member_user_id !== user?.id);

  return (
    <main className="shell">
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <p><a href="/jobs/new">← Back to jobs</a></p>
        <h1>Team access</h1>
        <p className="muted">The helper can review jobs and update application status. It cannot control scanning or API keys.</p>
        {params.error && <p style={{ color: '#a12525' }}>{params.error}</p>}
        {params.message && <p style={{ color: '#226b3a' }}>{params.message}</p>}
        {isOwner ? (
          <>
            <form action={inviteMember} style={{ display: 'flex', gap: 8, maxWidth: 560 }}>
              <input className="field" name="email" type="email" placeholder="Helper account email" required />
              <button className="button primary" type="submit">Send invitation</button>
            </form>
            <p className="muted">New helpers receive an invitation email. Existing accounts receive a one-time workspace access link.</p>
          </>
        ) : <p>Your account has access as a helper.</p>}
      </div>
      <div className="card" style={{ padding: 20 }}>
        <h2>Members</h2>
        {members.length === 0 ? <p className="muted">No helper accounts are connected.</p> : members.map((member) => (
          <div key={member.member_user_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid #e4e9f0' }}>
            <span>{member.member_email ?? 'Helper account'}</span>
            {isOwner && <form action={removeMember}><input type="hidden" name="memberId" value={member.member_user_id} /><button className="button danger" type="submit">Remove</button></form>}
          </div>
        ))}
      </div>
    </main>
  );
}
