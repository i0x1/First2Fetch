import Link from 'next/link';

import { JobStatus } from '@first2apply/core';

import { listJobs } from '@/app/actions';

export async function JobListPage({ status, jobs, search }: { status: JobStatus; jobs: Awaited<ReturnType<typeof listJobs>>; search: string }) {
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'end', marginBottom: 18 }}>
        <div><p className="muted">Shared workspace</p><h1 style={{ textTransform: 'capitalize' }}>{status} jobs</h1></div>
        <form method="get" style={{ display: 'flex', gap: 8 }}>
          <input className="field" name="q" defaultValue={search} placeholder="Search title or company" />
          <button className="button" type="submit">Search</button>
        </form>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {jobs.length === 0 ? <p style={{ padding: 20 }}>No jobs found.</p> : jobs.map((job) => (
          <article key={job.id} style={{ padding: 18, borderBottom: '1px solid #e4e9f0' }}>
            <Link href={`/jobs/${job.id}`}><h2 style={{ margin: 0, fontSize: 18 }}>{job.title}</h2></Link>
            <p style={{ margin: '6px 0' }}><strong>{job.companyName}</strong>{job.location ? ` · ${job.location}` : ''}</p>
            <p className="muted" style={{ margin: 0 }}>{job.salary ?? 'Salary not listed'} · Found {new Date(job.created_at).toLocaleDateString()}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
