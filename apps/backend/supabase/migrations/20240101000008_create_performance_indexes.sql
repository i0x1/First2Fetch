-- Create performance indexes for foreign keys and common queries
-- This migration adds indexes to improve JOIN performance and foreign key constraint checks

-- Indexes for jobs table foreign keys
create index if not exists idx_jobs_siteid on public.jobs("siteId");
create index if not exists idx_jobs_link_id on public.jobs(link_id);

-- Indexes for links table foreign keys
create index if not exists idx_links_site_id on public.links(site_id);
create index if not exists idx_links_user_id on public.links(user_id);

-- Indexes for notes table foreign keys
create index if not exists idx_notes_job_id on public.notes(job_id);
create index if not exists idx_notes_user_id on public.notes(user_id);

