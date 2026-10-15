import { JobStatus } from '@first2apply/core';

import { listJobCounts, listJobSearches, listJobs } from '@/app/actions';
import { JobListPage } from '@/app/jobs/shared/JobListPage';

export default async function AppliedJobsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const status: JobStatus = 'applied';
  return <JobListPage status={status} jobs={await listJobs(status, params.q ?? '')} search={params.q ?? ''} counts={await listJobCounts()} searches={await listJobSearches()} />;
}
