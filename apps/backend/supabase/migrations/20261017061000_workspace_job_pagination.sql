-- Match the active Electron/web 10-argument list contract, with bounded payloads.
create or replace function public.list_jobs(
  jobs_status public."Job Status",jobs_after text,jobs_page_size integer,
  jobs_search text default null,jobs_site_ids integer[] default null,
  jobs_link_ids integer[] default null,jobs_labels text[] default null,
  hide_reposted boolean default false,date_filter date default null,timezone_name text default 'UTC'
)
returns setof public.jobs language plpgsql security definer set search_path = '' as $$
declare
  workspace_owner uuid := public.current_workspace_owner_id();
  favorites text[] := array[]::text[];
  after_id bigint;
  after_time timestamptz;
  after_favorite boolean := false;
  zone text := coalesce(nullif(timezone_name,''),'UTC');
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select coalesce(array_agg(lower(fc)),array[]::text[]) into favorites
    from public.advanced_matching am cross join lateral unnest(am.favorite_companies) fc
    where am.user_id=workspace_owner;
  if jobs_after is not null then
    after_id := split_part(jobs_after,'!',1)::bigint;
    after_time := split_part(jobs_after,'!',2)::timestamptz;
    select coalesce(lower(j."companyName")=any(favorites),false) into after_favorite
      from public.jobs j where j.id=after_id and j.user_id=workspace_owner;
    if not found then raise exception 'Invalid job page cursor'; end if;
  end if;
  return query select
    j.id,j.user_id,j."externalId",j."externalUrl",j."siteId",j.title,j."companyName",j."companyLogo",
    j.location,j.created_at,j.updated_at,j.salary,j.tags,j."jobType",j.status,null::text as description,
    j.labels,j.link_id,j.exclude_reason,null::tsvector as job_search_vector,j.posted_at_raw,j.is_repost,j.description_hash
  from public.jobs j
  where j.user_id=workspace_owner and j.status=jobs_status
    and (date_filter is null or (j.created_at >= (date_filter::timestamp at time zone zone) and j.created_at < ((date_filter+1)::timestamp at time zone zone)))
    and (jobs_after is null or
      (timezone(zone,j.created_at)::date,coalesce(lower(j."companyName")=any(favorites),false),j.created_at,j.id)
      < (timezone(zone,after_time)::date,after_favorite,after_time,after_id))
    and (array_length(jobs_site_ids,1) is null or j."siteId"=any(jobs_site_ids))
    and (array_length(jobs_link_ids,1) is null or j.link_id=any(jobs_link_ids))
    and (array_length(jobs_labels,1) is null or j.labels && jobs_labels)
    and (jobs_search is null or j.job_search_vector @@ plainto_tsquery('english',jobs_search))
    and (not hide_reposted or coalesce(j.is_repost,false)=false)
  order by timezone(zone,j.created_at)::date desc,
    coalesce(lower(j."companyName")=any(favorites),false) desc,j.created_at desc,j.id desc
  limit greatest(1,least(coalesce(jobs_page_size,50),100));
end $$;
revoke all on function public.list_jobs(public."Job Status",text,integer,text,integer[],integer[],text[],boolean,date,text) from public,anon,authenticated;
grant execute on function public.list_jobs(public."Job Status",text,integer,text,integer[],integer[],text[],boolean,date,text) to authenticated;
