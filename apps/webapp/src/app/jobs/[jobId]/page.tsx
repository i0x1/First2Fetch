import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getJob, listJobEvents } from '@/app/actions';
import { updateJobReview } from '@/app/actions';
import { LocalTimestamp } from '@/app/components/LocalTimestamp';

export default async function JobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const parsedJobId = Number(jobId);
  if (!Number.isInteger(parsedJobId)) notFound();

  let job;
  try {
    job = await getJob(parsedJobId);
  } catch {
    notFound();
  }
  const events = await listJobEvents(parsedJobId);

  return (
    <section>
      <p><Link href="/jobs/new">← Back to jobs</Link></p>
      <article className="card" style={{ padding: 24 }}>
        <p className="muted">{job.companyName}{job.location ? ` · ${job.location}` : ''}</p>
        <h1>{job.title}</h1>
        <p className="muted">{job.salary ?? 'Salary not listed'} · Found <LocalTimestamp value={job.created_at} /> · Posted at scan: {job.posted_at_raw || 'not captured'}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '20px 0' }}>
          <a className="button primary" href={job.externalUrl} target="_blank" rel="noreferrer">Open application link</a>
          {job.status !== 'applied' && <ReviewButton jobId={job.id} status="applied" label="Mark applied" />}
          {job.status !== 'archived' && <ReviewButton jobId={job.id} status="archived" label="Archive" />}
          {job.status !== 'new' && <ReviewButton jobId={job.id} status="new" label="Move to new" />}
        </div>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{job.description || 'The job description is not available yet.'}</p>
        {job.labels?.length ? <p className="muted">Labels: {job.labels.join(', ')}</p> : null}
      </article>
      <article className="card" style={{ padding: 24, marginTop: 16 }}>
        <h2>Activity</h2>
        {events.length === 0 ? <p className="muted">No review activity yet.</p> : (
          <div style={{ display: 'grid', gap: 12 }}>
            {events.map((event) => (
              <div key={event.id} style={{ borderBottom: '1px solid #e4e9f0', paddingBottom: 10 }}>
                <strong>{event.actor_email || (event.actor_kind === 'system' ? 'System' : 'Unknown')}</strong>{' '}
                {event.action === 'status_changed' ? `changed status from ${event.from_status ?? 'none'} to ${event.to_status}` : 'changed labels'}
                {event.reason_code !== 'unspecified' ? ` · ${event.reason_code.replace(/_/g, ' ')}` : ''}
                {event.reason_text ? ` · ${event.reason_text}` : ''}
                <div className="muted"><LocalTimestamp value={event.created_at} /> · {event.channel}</div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}

function ReviewButton({ jobId, status, label }: { jobId: number; status: 'new' | 'applied' | 'archived'; label: string }) {
  return <form action={updateJobReview}><input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="status" value={status} /><button className="button" type="submit">{label}</button></form>;
}
