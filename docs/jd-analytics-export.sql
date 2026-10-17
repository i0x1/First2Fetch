-- Run in the Supabase SQL Editor when you need a point-in-time CSV export.
-- Query 1: exactly one row per job, with its full stored description and source/search.
-- Export the result as CSV. Do not join the event table here: that would repeat
-- one job row for every workflow change.
select
  j.id as job_id,
  j.user_id as workspace_owner_id,
  j.status,
  j.exclude_reason,
  j.title,
  j."companyName" as company_name,
  j."companyLogo" as company_logo,
  j.location,
  j.salary,
  j.tags,
  j."jobType" as job_type,
  j.labels,
  j."externalId" as external_id,
  j."externalUrl" as job_url,
  j."siteId" as site_id,
  s.name as source_name,
  s.provider as source_provider,
  j.link_id as search_id,
  l.title as search_name,
  l.url as search_url,
  j.created_at,
  j.updated_at,
  j.posted_at_raw,
  j.is_repost,
  j.description_hash,
  j.description
from public.jobs j
left join public.sites s on s.id = j."siteId"
left join public.links l on l.id = j.link_id
-- Include processing jobs too, so the export contains every existing job row.
order by j.id;

-- Query 2: optional separate CSV, one row per recorded workflow event.
-- Join the files by job_id after export to see who changed a job and why.
select
  e.id as event_id,
  e.workspace_owner_id,
  e.job_id,
  e.created_at,
  e.action,
  e.from_status,
  e.to_status,
  e.from_labels,
  e.to_labels,
  e.actor_kind,
  e.actor_user_id,
  e.actor_email,
  e.channel,
  e.reason_code,
  e.reason_text
from public.workspace_job_events e
order by e.id;
