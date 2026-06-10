-- Scope job RPCs to the current user (SECURITY DEFINER bypasses RLS).
-- Optional runtime payload for parser debugging.

alter table if exists public.html_dumps
  add column if not exists webpage_runtime_data jsonb;

create or replace function public.count_jobs(
    jobs_status "Job Status" default null,
    jobs_search text default null,
    jobs_site_ids integer[] default null,
    jobs_link_ids integer[] default null,
    jobs_labels text[] default null
)
returns table(status "Job Status", job_count bigint)
language plpgsql
set search_path = ''
as $$
begin
  return query
  select j.status, count(*) as job_count
  from public.jobs j
  where j.user_id = auth.uid()
    and (jobs_status is null or j.status = jobs_status)
    and (array_length(jobs_site_ids, 1) is null or j."siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or j.link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or j.labels && jobs_labels)
    and (jobs_search is null or j.job_search_vector @@ plainto_tsquery('english', jobs_search))
  group by j.status
  order by j.status;
end;
$$;

create or replace function public.count_jobs(
    jobs_search text default null,
    jobs_site_ids integer[] default null,
    jobs_link_ids integer[] default null,
    jobs_labels text[] default null,
    hide_reposted boolean default false
)
returns table(status "Job Status", job_count bigint)
language plpgsql
set search_path = ''
as $$
begin
  return query
  select j.status, count(*) as job_count
  from public.jobs j
  where j.user_id = auth.uid()
    and (array_length(jobs_site_ids, 1) is null or j."siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or j.link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or j.labels && jobs_labels)
    and (jobs_search is null or j.job_search_vector @@ plainto_tsquery('english', jobs_search))
    and (not hide_reposted or j.is_repost = false or j.is_repost is null)
  group by j.status
  order by j.status;
end;
$$;

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
set search_path = ''
security definer
as $$
declare
  favorite_companies_lower text[] := ARRAY[]::text[];
begin
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
  from public.jobs j
  where j.user_id = auth.uid()
    and j.status = jobs_status
    and (array_length(jobs_site_ids, 1) is null or j."siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or j.link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or j.labels && jobs_labels)
    and (jobs_search is null or j.job_search_vector @@ plainto_tsquery('english', jobs_search))
    and (not hide_reposted or j.is_repost = false or j.is_repost is null)
  group by j.created_at::date
  order by j.created_at::date desc;
end;
$$;

create or replace function get_job_dates_summary(
    jobs_status "Job Status",
    jobs_search text default null,
    jobs_site_ids integer[] default null,
    jobs_link_ids integer[] default null,
    jobs_labels text[] default null,
    hide_reposted boolean default false,
    timezone_name text default 'UTC'
)
returns table(
    date_key date,
    total_count bigint,
    favorite_count bigint
)
language plpgsql
set search_path = ''
security definer
as $$
declare
  favorite_companies_lower text[] := ARRAY[]::text[];
begin
  if timezone_name is null or timezone_name = '' then
    timezone_name := 'UTC';
  end if;

  select coalesce(array_agg(lower(fc)), ARRAY[]::text[]) into favorite_companies_lower
  from (
    select unnest(am.favorite_companies) as fc
    from public.advanced_matching am
    where am.user_id = auth.uid()
  ) favorite_values;

  return query
  select
    (timezone(timezone_name, j.created_at))::date as date_key,
    count(*) as total_count,
    count(*) filter (
      where array_length(favorite_companies_lower, 1) > 0
        and lower(j."companyName") = any(favorite_companies_lower)
    ) as favorite_count
  from public.jobs j
  where j.user_id = auth.uid()
    and j.status = jobs_status
    and (array_length(jobs_site_ids, 1) is null or j."siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or j.link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or j.labels && jobs_labels)
    and (jobs_search is null or j.job_search_vector @@ plainto_tsquery('english', jobs_search))
    and (not hide_reposted or j.is_repost = false or j.is_repost is null)
  group by (timezone(timezone_name, j.created_at))::date
  order by (timezone(timezone_name, j.created_at))::date desc;
end;
$$;

create or replace function public.list_jobs(
    jobs_status "Job Status",
    jobs_after text,
    jobs_page_size integer,
    jobs_search text default null,
    jobs_site_ids integer[] default null,
    jobs_link_ids integer[] default null,
    jobs_labels text[] default null,
    hide_reposted boolean default false,
    date_filter date default null,
    timezone_name text default 'UTC'
)
returns setof public.jobs
language plpgsql
set search_path = ''
as $$
declare
  after_id integer;
  after_created_at timestamp;
  favorite_companies_lower text[] := ARRAY[]::text[];
  date_filter_start timestamp with time zone;
  date_filter_end timestamp with time zone;
begin
  if timezone_name is null or timezone_name = '' then
    timezone_name := 'UTC';
  end if;

  if jobs_after is not null then
    after_id := split_part(jobs_after, '!', 1)::integer;
    after_created_at := split_part(jobs_after, '!', 2)::timestamp;
  end if;

  if date_filter is not null then
    date_filter_start := make_timestamp(
      extract(year from date_filter)::int,
      extract(month from date_filter)::int,
      extract(day from date_filter)::int,
      0, 0, 0
    ) AT TIME ZONE timezone_name;

    date_filter_end := make_timestamp(
      extract(year from date_filter + interval '1 day')::int,
      extract(month from date_filter + interval '1 day')::int,
      extract(day from date_filter + interval '1 day')::int,
      0, 0, 0
    ) AT TIME ZONE timezone_name;
  end if;

  select coalesce(array_agg(lower(fc)), ARRAY[]::text[]) into favorite_companies_lower
  from (
    select unnest(am.favorite_companies) as fc
    from public.advanced_matching am
    where am.user_id = auth.uid()
  ) favorite_values;

  return query
  select *
  from public.jobs
  where user_id = auth.uid()
    and status = jobs_status
    and (date_filter is null or (created_at >= date_filter_start and created_at < date_filter_end))
    and (jobs_after is null or (created_at, id) < (after_created_at, after_id))
    and (array_length(jobs_site_ids, 1) is null or "siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or labels && jobs_labels)
    and (jobs_search is null or job_search_vector @@ plainto_tsquery('english', jobs_search))
    and (not hide_reposted or is_repost = false or is_repost is null)
  order by
    (timezone(timezone_name, created_at))::date desc,
    (case
      when array_length(favorite_companies_lower, 1) > 0
        then coalesce(lower("companyName") = any(favorite_companies_lower), false)
      else false
    end) desc,
    created_at desc,
    id desc
  limit jobs_page_size;
end;
$$;
