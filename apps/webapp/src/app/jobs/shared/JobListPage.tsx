import { JobStatus } from '@first2apply/core';

import { listJobs } from '@/app/actions';
import { JobBoard } from './JobBoard';

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
      {jobs.length === 0 ? <div className="card job-board-empty">No jobs found.</div> : <JobBoard jobs={jobs} />}
    </section>
  );
}
