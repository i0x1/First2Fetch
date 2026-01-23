-- Optimize indexes for slow job queries
-- This migration adds composite indexes to improve performance of get_job_dates_summary and list_jobs functions

-- Index for get_job_dates_summary: groups by date and filters by status
-- This supports the WHERE status = X and GROUP BY date(created_at) pattern
create index if not exists idx_jobs_status_created_at 
on public.jobs(status, created_at desc);

-- Index for list_jobs: filters by status and orders by created_at
-- This supports WHERE status = X ORDER BY created_at DESC, id DESC
create index if not exists idx_jobs_status_created_at_id 
on public.jobs(status, created_at desc, id desc);

-- Index for filtering by siteId with status (common filter combination)
create index if not exists idx_jobs_status_siteid_created_at 
on public.jobs(status, "siteId", created_at desc);

-- Index for filtering by link_id with status (common filter combination)
create index if not exists idx_jobs_status_link_id_created_at 
on public.jobs(status, link_id, created_at desc);

-- Index for labels array filtering (GIN index for array containment operations)
-- Note: GIN indexes don't support enum types, so we index labels separately
-- The query planner will use this index along with the status index
create index if not exists idx_jobs_labels 
on public.jobs using gin(labels);

-- Note: job_search_vector already has a GIN index from the search vector migration
-- The existing indexes on siteId and link_id are kept for foreign key lookups

-- Composite index for user_id + status + created_at (most common query pattern)
-- This supports functions that filter by user_id and status, then order by created_at
create index if not exists idx_jobs_user_id_status_created_at 
on public.jobs(user_id, status, created_at desc);

