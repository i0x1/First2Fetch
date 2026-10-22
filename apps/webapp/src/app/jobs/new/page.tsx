import { JobStatus } from '@first2apply/core';

import { listJobCounts, listJobSearches, listJobsPage } from '@/app/actions';
import { JobListPage } from '@/app/jobs/shared/JobListPage';

const status: JobStatus = 'new';

export default async function NewJobsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const page = await listJobsPage(status, undefined, params.q ?? '');
  return <JobListPage status={status} jobs={page.jobs} nextCursor={page.nextCursor} search={params.q ?? ''} counts={await listJobCounts()} searches={await listJobSearches()} />;
}
