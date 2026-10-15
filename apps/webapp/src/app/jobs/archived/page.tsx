import { JobStatus } from '@first2apply/core';

import { listJobs } from '@/app/actions';
import { JobListPage } from '@/app/jobs/shared/JobListPage';

export default async function ArchivedJobsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const status: JobStatus = 'archived';
  return <JobListPage status={status} jobs={await listJobs(status, params.q ?? '')} search={params.q ?? ''} />;
}
