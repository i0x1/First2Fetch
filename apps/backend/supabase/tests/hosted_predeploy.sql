-- Run as project administrator. Every fixture and job change is rolled back.
begin;
do $$
declare
  target_job public.jobs;
  owner_id uuid;
  helper_id uuid;
  event_count bigint;
  baseline_count bigint;
begin
  select count(*) into baseline_count from public.jobs;
  select * into strict target_job from public.jobs order by id limit 1;
  owner_id := target_job.user_id;
  select member_user_id into helper_id from public.workspace_memberships where workspace_owner_id=owner_id limit 1;
  select count(*) into event_count from public.workspace_job_events;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform public.workspace_update_job_review_v2(target_job.id,'ready',null,'not_interested','Transaction-only audit check','web');
  if not exists(select 1 from public.workspace_job_events where job_id=target_job.id and actor_user_id=owner_id and channel='web' and reason_text='Transaction-only audit check' and to_status='ready') then raise exception 'Owner audit check failed'; end if;
  if helper_id is not null then
    perform set_config('request.jwt.claim.sub',helper_id::text,true);
    perform public.workspace_update_job_review_v2(target_job.id,'applied',null,'unspecified',null,'electron');
    if not exists(select 1 from public.workspace_job_events where job_id=target_job.id and actor_user_id=helper_id and channel='electron' and to_status='applied') then raise exception 'Helper audit check failed'; end if;
  end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  begin
    perform public.workspace_update_job_review_v2(target_job.id,'archived');
    raise exception 'Outsider access was incorrectly allowed';
  exception when raise_exception then
    if sqlerrm <> 'Job not found in the current workspace' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  begin
    perform public.workspace_update_job_review_v2(target_job.id,'archived',null,'invalid');
    raise exception 'Invalid reason was incorrectly allowed';
  exception when raise_exception then
    if sqlerrm <> 'Invalid reason code' then raise; end if;
  end;
  perform public.workspace_update_job_review_v2(target_job.id,'applied',null,'unspecified',null,'web');
  update public.jobs set status='new' where id=target_job.id and status in ('processing','new');
  if (select status from public.jobs where id=target_job.id)<>'applied' then raise exception 'Scanner retry changed a reviewed job'; end if;
  if (select description from public.jobs where id=target_job.id) is distinct from target_job.description then raise exception 'Job description changed'; end if;
  if to_regprocedure('public.workspace_apply_job_scan_v1(bigint,jsonb)') is not null then
    perform public.workspace_apply_job_scan_v1(target_job.id,'{"status":"new"}'::jsonb);
    if (select status from public.jobs where id=target_job.id)<>'applied' then raise exception 'Scanner RPC reopened a reviewed job'; end if;
    perform public.workspace_update_job_review_v2(target_job.id,'new',null,'unspecified',null,'web');
    perform public.workspace_apply_job_scan_v1(target_job.id,'{"status":"excluded_by_advanced_matching","exclude_reason":"Scanner test reason"}'::jsonb);
    if not exists(select 1 from public.workspace_job_events where job_id=target_job.id and actor_kind='system' and actor_user_id is null and channel='scanner' and reason_text='Scanner test reason') then raise exception 'Scanner attribution check failed'; end if;
    if helper_id is not null then
      perform set_config('request.jwt.claim.sub',helper_id::text,true);
      begin
        perform public.workspace_apply_job_scan_v1(target_job.id,'{"status":"new"}'::jsonb);
        raise exception 'Helper scanner access was incorrectly allowed';
      exception when raise_exception then
        if sqlerrm <> 'Job not found in the owner workspace' then raise; end if;
      end;
    end if;
  end if;
  if (select count(*) from public.jobs) <> baseline_count then raise exception 'Unexpected job count'; end if;
  if exists(select 1 from information_schema.tables where table_schema='public' and table_name in ('job_description_documents','job_description_versions','job_system_decisions','job_requirement_extractions','job_analytics_queue')) then raise exception 'Unexpected analytics copy table'; end if;
end $$;
select 'PASS: owner/helper actions, attribution, outsider rejection, reason validation, scanner guard, description preservation, and job count' as result;
do $$
declare
  owner_id uuid;
  helper_id uuid;
  source_id bigint;
  favorite text;
  page_cursor text;
  page_row public.jobs;
  page_count integer;
  seen bigint[] := array[]::bigint[];
  owner_seen bigint[];
  attempt integer;
  identity_id uuid;
begin
  select j.user_id,j."siteId" into owner_id,source_id from public.jobs j order by j.id limit 1;
  select member_user_id into helper_id from public.workspace_memberships where workspace_owner_id=owner_id limit 1;
  select favorite_companies[1] into favorite from public.advanced_matching where user_id=owner_id;
  for attempt in 1..120 loop
    insert into public.jobs(user_id,"siteId","externalId","externalUrl",title,"companyName",status,description,created_at)
    values(owner_id,source_id,'f2f-predeploy-'||gen_random_uuid()::text,'https://example.test/fixture',
      'F2F Pagination Fixture',case when attempt<=60 then coalesce(favorite,'Fixture favorite') else 'Fixture other company' end,
      'ready','Fixture description', '2040-01-01T12:00:00Z'::timestamptz-make_interval(secs=>case when attempt<=60 then 1000+attempt else attempt end));
  end loop;
  foreach identity_id in array array[owner_id,helper_id] loop
    continue when identity_id is null;
    perform set_config('request.jwt.claim.sub',identity_id::text,true);
    page_cursor:=null;
    seen:=array[]::bigint[];
    for attempt in 1..5 loop
      page_count:=0;
      for page_row in select * from public.workspace_list_jobs_v2('ready',page_cursor,50,'F2F Pagination Fixture',null,null,null,false,null,'UTC') loop
        if page_row.id=any(seen) then raise exception 'Pagination repeated a job'; end if;
        if page_row.description is not null or page_row.job_search_vector is not null then raise exception 'List payload includes large detail fields'; end if;
        seen:=array_append(seen,page_row.id);
        page_count:=page_count+1;
        page_cursor:=page_row.id::text||'!'||page_row.created_at::text;
      end loop;
      exit when page_count<50;
    end loop;
    if array_length(seen,1)<>120 then raise exception 'Pagination missed jobs: %',array_length(seen,1); end if;
    if identity_id=owner_id then owner_seen:=seen;
    elsif seen is distinct from owner_seen then raise exception 'Helper and owner job order differs'; end if;
  end loop;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  if (select count(*) from public.workspace_list_jobs_v2('ready',null,100000,'F2F Pagination Fixture',null,null,null,false,null,'UTC'))<>100 then raise exception 'Page limit is not enforced'; end if;
  if not exists(select 1 from public.list_jobs('ready',null,50,'F2F Pagination Fixture',null,null,null,false,null,'UTC') where description='Fixture description') then raise exception 'Legacy descriptions are missing'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  if exists(select 1 from public.workspace_list_jobs_v2('ready',null,50,'F2F Pagination Fixture',null,null,null,false,null,'UTC')) then raise exception 'Outsider can read workspace jobs'; end if;
end $$;
select 'PASS: 120 fixtures page once for owner and helper, matching order, bounded payload/page size, and outsider isolation' as result;
rollback;
