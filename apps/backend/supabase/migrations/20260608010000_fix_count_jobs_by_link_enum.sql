-- count_jobs_by_link referenced status 'deleted', which is not in the Job Status enum.

create or replace function public.count_jobs_by_link()
returns table(link_id bigint, job_count bigint)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  select j.link_id, count(*)::bigint as job_count
  from public.jobs j
  where j.user_id = auth.uid()
    and j.link_id is not null
  group by j.link_id;
end;
$$;
