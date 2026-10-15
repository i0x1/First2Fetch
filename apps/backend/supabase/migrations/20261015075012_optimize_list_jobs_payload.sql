-- Keep the job list response small. Descriptions are fetched separately, and
-- the search vector is only used by the database for filtering.
create or replace function public.list_jobs(
  jobs_status public."Job Status",
  jobs_after text,
  jobs_page_size integer,
  jobs_search text default null,
  jobs_site_ids integer[] default null,
  jobs_link_ids integer[] default null,
  jobs_labels text[] default null
)
returns setof public.jobs
language plpgsql
set search_path = ''
as $$
declare
  after_id integer;
  after_updated_at timestamp;
  favorite_companies_lower text[] := array[]::text[];
begin
  if jobs_after is not null then
    after_id := split_part(jobs_after, '!', 1)::integer;
    after_updated_at := split_part(jobs_after, '!', 2)::timestamp;
  end if;

  select coalesce(array_agg(lower(favorite_company)), array[]::text[])
  into favorite_companies_lower
  from (
    select unnest(am.favorite_companies) as favorite_company
    from public.advanced_matching am
    where am.user_id = (select auth.uid())
  ) favorite_values;

  return query
  select
    j.id,
    j.user_id,
    j."externalId",
    j."externalUrl",
    j."siteId",
    j.title,
    j."companyName",
    j."companyLogo",
    j.location,
    j.created_at,
    j.updated_at,
    j.salary,
    j.tags,
    j."jobType",
    j.status,
    null::text as description,
    j.labels,
    j.link_id,
    j.exclude_reason,
    null::tsvector as job_search_vector,
    j.posted_at_raw,
    j.is_repost,
    j.description_hash
  from public.jobs j
  where j.status = jobs_status
    and (jobs_after is null or (j.updated_at, j.id) < (after_updated_at, after_id))
    and (array_length(jobs_site_ids, 1) is null or j."siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or j.link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or j.labels && jobs_labels)
    and (jobs_search is null or j.job_search_vector @@ plainto_tsquery('english', jobs_search))
  order by
    case
      when array_length(favorite_companies_lower, 1) > 0
        then coalesce(lower(j."companyName") = any(favorite_companies_lower), false)
      else false
    end desc,
    j.updated_at desc,
    j.id desc
  limit jobs_page_size;
end;
$$;
