-- Local timezone grouping: Group jobs by date in user's local timezone
-- This ensures dates match what users see on their computer

-- Function to get job date summaries grouped by LOCAL timezone date
create or replace function get_job_dates_summary(
    jobs_status "Job Status",
    jobs_search text default null,
    jobs_site_ids integer[] default null,
    jobs_link_ids integer[] default null,
    jobs_labels text[] default null,
    hide_reposted boolean default false,
    timezone_name text default 'UTC'  -- NEW: User's timezone (e.g., 'America/Los_Angeles')
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
  -- Validate and set default timezone
  if timezone_name is null or timezone_name = '' then
    timezone_name := 'UTC';
  end if;

  -- Get favorite companies for the current user
  select coalesce(array_agg(lower(fc)), ARRAY[]::text[]) into favorite_companies_lower
  from (
    select unnest(am.favorite_companies) as fc
    from public.advanced_matching am
    where am.user_id = auth.uid()
  ) favorite_values;

  return query
  select 
    -- Convert UTC timestamp to local timezone, then extract date
    (j.created_at AT TIME ZONE 'UTC' AT TIME ZONE timezone_name)::date as date_key,
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
  group by (j.created_at AT TIME ZONE 'UTC' AT TIME ZONE timezone_name)::date
  order by (j.created_at AT TIME ZONE 'UTC' AT TIME ZONE timezone_name)::date desc;
end;
$$;

-- Update list_jobs to support local timezone date filtering
create or replace function public.list_jobs(
    jobs_status "Job Status",
    jobs_after text,
    jobs_page_size integer,
    jobs_search text default null,
    jobs_site_ids integer[] default null,
    jobs_link_ids integer[] default null,
    jobs_labels text[] default null,
    hide_reposted boolean default false,
    date_filter date default null,  -- Local date to filter by
    timezone_name text default 'UTC'  -- NEW: User's timezone
)
returns setof jobs
language plpgsql
set search_path = public
as $$
declare
  after_id integer;
  after_created_at timestamp;
  favorite_companies_lower text[] := ARRAY[]::text[];
  date_filter_start timestamp;
  date_filter_end timestamp;
begin
  -- Validate timezone
  if timezone_name is null or timezone_name = '' then
    timezone_name := 'UTC';
  end if;

  if jobs_after is not null then
    after_id := split_part(jobs_after, '!', 1)::integer;
    after_created_at := split_part(jobs_after, '!', 2)::timestamp;
  end if;

  -- Convert local date filter to UTC timestamp range
  if date_filter is not null then
    -- Create timestamp at midnight in the local timezone, then convert to UTC
    -- Use make_timestamp to create a timestamp without timezone, then convert
    date_filter_start := make_timestamp(
      extract(year from date_filter)::int,
      extract(month from date_filter)::int,
      extract(day from date_filter)::int,
      0, 0, 0
    ) AT TIME ZONE timezone_name AT TIME ZONE 'UTC';
    
    -- End of day (start of next day) in local timezone, converted to UTC
    date_filter_end := make_timestamp(
      extract(year from date_filter + interval '1 day')::int,
      extract(month from date_filter + interval '1 day')::int,
      extract(day from date_filter + interval '1 day')::int,
      0, 0, 0
    ) AT TIME ZONE timezone_name AT TIME ZONE 'UTC';
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
    and (date_filter is null or (created_at >= date_filter_start and created_at < date_filter_end))
    and (jobs_after is null or (created_at, id) < (after_created_at, after_id))
    and (array_length(jobs_site_ids, 1) is null or "siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or labels && jobs_labels)
    and (jobs_search is null or job_search_vector @@ plainto_tsquery('english', jobs_search))
    and (not hide_reposted or is_repost = false or is_repost is null)
  order by 
    -- 1. Sort by LOCAL date (day) descending - newest dates first
    (created_at AT TIME ZONE 'UTC' AT TIME ZONE timezone_name)::date desc,
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

