-- Add posting date fields to jobs table
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS posted_at_raw TEXT NULL,
ADD COLUMN IF NOT EXISTS is_repost BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN public.jobs.posted_at_raw IS 'Raw posting date text from job site (e.g., "8 hours ago", "Reposted 1 week ago")';
COMMENT ON COLUMN public.jobs.is_repost IS 'Whether the job was reposted (extracted from posted_at_raw)';

