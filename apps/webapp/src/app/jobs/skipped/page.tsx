import { JobStatus } from '@first2apply/core';

import { listJobCounts, listJobSearches, listJobsPage } from '@/app/actions';
import { JobListPage } from '@/app/jobs/shared/JobListPage';

export default async function SkippedJobsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const status: JobStatus = 'excluded_by_advanced_matching';
  const [page, counts, searches] = await Promise.all([
    listJobsPage(status, undefined, params.q ?? ''),
    listJobCounts(),
    listJobSearches(),
  ]);
  return <JobListPage status={status} jobs={page.jobs} nextCursor={page.nextCursor} search={params.q ?? ''} counts={counts} searches={searches} />;
}
