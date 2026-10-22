import { JobStatus } from '@first2apply/core';

import { listJobCounts, listJobSearches, listJobsPage } from '@/app/actions';
import { JobListPage } from '@/app/jobs/shared/JobListPage';

export default async function ReadyJobsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const status: JobStatus = 'ready';
  const page = await listJobsPage(status, undefined, params.q ?? '');
  return <JobListPage status={status} jobs={page.jobs} nextCursor={page.nextCursor} search={params.q ?? ''} counts={await listJobCounts()} searches={await listJobSearches()} />;
}
