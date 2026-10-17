-- Existing deployed web builds require descriptions in list_jobs. Keep that
-- contract while updated clients use an explicit lightweight list function.
alter function public.list_jobs(public."Job Status",text,integer,text,integer[],integer[],text[],boolean,date,text)
  rename to workspace_list_jobs_v2;

create function public.list_jobs(
  jobs_status public."Job Status",jobs_after text,jobs_page_size integer,
  jobs_search text default null,jobs_site_ids integer[] default null,
  jobs_link_ids integer[] default null,jobs_labels text[] default null,
  hide_reposted boolean default false,date_filter date default null,timezone_name text default 'UTC'
)
returns setof public.jobs language sql security invoker set search_path = '' as $$
  select j.* from public.workspace_list_jobs_v2(
    jobs_status,jobs_after,jobs_page_size,jobs_search,jobs_site_ids,jobs_link_ids,jobs_labels,
    hide_reposted,date_filter,timezone_name
  ) with ordinality as page
  join public.jobs j on j.id=page.id
  order by page.ordinality;
$$;
revoke all on function public.list_jobs(public."Job Status",text,integer,text,integer[],integer[],text[],boolean,date,text) from public,anon,authenticated;
grant execute on function public.list_jobs(public."Job Status",text,integer,text,integer[],integer[],text[],boolean,date,text) to authenticated;
