import { JobStatus } from '@first2apply/core';

import { listJobsPage } from '@/app/actions';
import { JobBoard } from './JobBoard';

export async function JobListPage({ status, jobs, nextCursor, search, counts, searches }: { status: JobStatus; jobs: Awaited<ReturnType<typeof listJobsPage>>['jobs']; nextCursor?: string; search: string; counts: { new: number; ready: number; applied: number; archived: number; filtered: number }; searches: Array<{ id: number; title: string }> }) {
  return (
    <section>
      {jobs.length === 0 ? <div className="card job-board-empty">No jobs found.</div> : <JobBoard jobs={jobs} nextCursor={nextCursor} status={status} search={search} counts={counts} searches={searches} />}
    </section>
  );
}
