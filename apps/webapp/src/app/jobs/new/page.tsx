import { JobStatus } from '@first2apply/core';

import { listJobCounts, listJobSearches, listJobs } from '@/app/actions';
import { JobListPage } from '@/app/jobs/shared/JobListPage';

const status: JobStatus = 'new';

export default async function NewJobsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const jobs = await listJobs(status, params.q ?? '');
  return <JobListPage status={status} jobs={jobs} search={params.q ?? ''} counts={await listJobCounts()} searches={await listJobSearches()} />;
}
