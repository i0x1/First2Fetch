-- Fix date filter timezone conversion in list_jobs function
-- The previous implementation had issues with date to timestamp conversion

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
    timezone_name text default 'UTC'  -- User's timezone
)
returns setof jobs
language plpgsql
set search_path = public
as $$
declare
  after_id integer;
  after_created_at timestamp;
  favorite_companies_lower text[] := ARRAY[]::text[];
  date_filter_start timestamp with time zone;
  date_filter_end timestamp with time zone;
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

