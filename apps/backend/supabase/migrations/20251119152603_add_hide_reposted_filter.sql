-- Add hide_reposted filter to list_jobs and count_jobs functions
-- This allows users to filter out reposted jobs from their listings

-- Update list_jobs function to support hiding reposted jobs
create or replace function public.list_jobs(
    jobs_status "Job Status",
    jobs_after text,
    jobs_page_size integer,
    jobs_search text default null,
    jobs_site_ids integer[] default null,
    jobs_link_ids integer[] default null,
    jobs_labels text[] default null,
    hide_reposted boolean default false
)
returns setof jobs
language plpgsql
set search_path = public
as $$
declare
  after_id integer;
  after_updated_at timestamp;
  favorite_companies_lower text[] := ARRAY[]::text[];
begin
  if jobs_after is not null then
    after_id := split_part(jobs_after, '!', 1)::integer;
    after_updated_at := split_part(jobs_after, '!', 2)::timestamp;
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
    and (jobs_after is null or (updated_at, id) < (after_updated_at, after_id))
    and (array_length(jobs_site_ids, 1) is null or "siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or labels && jobs_labels)
    and (jobs_search is null or job_search_vector @@ plainto_tsquery('english', jobs_search))
    and (not hide_reposted or is_repost = false or is_repost is null)
  order by (case
              when array_length(favorite_companies_lower, 1) > 0
                then coalesce(lower("companyName") = any(favorite_companies_lower), false)
              else false
            end) desc,
           updated_at desc,
           id desc
  limit jobs_page_size;
end;
$$;

-- Update count_jobs function to support hiding reposted jobs
create or replace function public.count_jobs(
    jobs_search text default null,
    jobs_site_ids integer[] default null,
    jobs_link_ids integer[] default null,
    jobs_labels text[] default null,
    hide_reposted boolean default false
)
returns table(status "Job Status", job_count bigint) 
language plpgsql
set search_path = public
as $$
begin
  return query
  select j.status, count(*) as job_count
  from jobs j
  where (array_length(jobs_site_ids, 1) is null or j."siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or j.link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or j.labels && jobs_labels)
    and (jobs_search is null or j.job_search_vector @@ plainto_tsquery('english', jobs_search))
    and (not hide_reposted or j.is_repost = false or j.is_repost is null)
  group by j.status
  order by j.status;
end;
$$;

