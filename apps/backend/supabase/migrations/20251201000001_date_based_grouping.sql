-- Date-based grouping: Get job summaries per date
-- This enables efficient two-phase loading: summaries first, then jobs on-demand

-- Function to get job date summaries (counts per date)
-- Returns all dates with total count and favorite count for efficient UI rendering
create or replace function get_job_dates_summary(
    jobs_status "Job Status",
    jobs_search text default null,
    jobs_site_ids integer[] default null,
    jobs_link_ids integer[] default null,
    jobs_labels text[] default null,
    hide_reposted boolean default false
)
returns table(
    date_key date,
    total_count bigint,
    favorite_count bigint
)
language plpgsql
set search_path = public
security definer
as $$
declare
  favorite_companies_lower text[] := ARRAY[]::text[];
begin
  -- Get favorite companies for the current user
  select coalesce(array_agg(lower(fc)), ARRAY[]::text[]) into favorite_companies_lower
  from (
    select unnest(am.favorite_companies) as fc
    from public.advanced_matching am
    where am.user_id = auth.uid()
  ) favorite_values;

  return query
  select 
    j.created_at::date as date_key,
    count(*) as total_count,
    count(*) filter (
      where array_length(favorite_companies_lower, 1) > 0
        and lower(j."companyName") = any(favorite_companies_lower)
    ) as favorite_count
  from jobs j
  where j.status = jobs_status
    and (array_length(jobs_site_ids, 1) is null or j."siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or j.link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or j.labels && jobs_labels)
    and (jobs_search is null or j.job_search_vector @@ plainto_tsquery('english', jobs_search))
    and (not hide_reposted or j.is_repost = false or j.is_repost is null)
  group by j.created_at::date
  order by j.created_at::date desc;
end;
$$;

-- Update list_jobs to support date filtering
-- This allows loading jobs for a specific date on-demand
create or replace function public.list_jobs(
    jobs_status "Job Status",
    jobs_after text,
    jobs_page_size integer,
    jobs_search text default null,
    jobs_site_ids integer[] default null,
    jobs_link_ids integer[] default null,
    jobs_labels text[] default null,
    hide_reposted boolean default false,
    date_filter date default null  -- NEW: Filter by specific date
)
returns setof jobs
language plpgsql
set search_path = public
as $$
declare
  after_id integer;
  after_created_at timestamp;
  favorite_companies_lower text[] := ARRAY[]::text[];
begin
  if jobs_after is not null then
    after_id := split_part(jobs_after, '!', 1)::integer;
    after_created_at := split_part(jobs_after, '!', 2)::timestamp;
  end if;

  -- Get favorite companies for the current user
  select coalesce(array_agg(lower(fc)), ARRAY[]::text[]) into favorite_companies_lower
  from (
    select unnest(am.favorite_companies) as fc
    from public.advanced_matching am
    where am.user_id = auth.uid()
  ) favorite_values;

  return query
  select *
  from jobs
  where status = jobs_status
    and (date_filter is null or created_at::date = date_filter)  -- NEW: Date filter
    and (jobs_after is null or (created_at, id) < (after_created_at, after_id))
    and (array_length(jobs_site_ids, 1) is null or "siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or labels && jobs_labels)
    and (jobs_search is null or job_search_vector @@ plainto_tsquery('english', jobs_search))
    and (not hide_reposted or is_repost = false or is_repost is null)
  order by 
    -- 1. Sort by date (day) descending - newest dates first
    created_at::date desc,
    -- 2. Within each date, favorites come first
    (case
      when array_length(favorite_companies_lower, 1) > 0
        then coalesce(lower("companyName") = any(favorite_companies_lower), false)
      else false
    end) desc,
    -- 3. Within each category, sort by exact time descending (newest first)
    created_at desc,
    id desc
  limit jobs_page_size;
end;
$$;

