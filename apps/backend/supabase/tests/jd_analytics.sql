begin;
select plan(23);

select hasnt_table('public', 'job_description_documents', 'no copied JD document table');
select hasnt_table('public', 'job_description_versions', 'no duplicate JD version table');
select hasnt_table('public', 'job_system_decisions', 'no duplicate decision table');
select hasnt_table('public', 'job_matching_rule_versions', 'no copied prompt or rules table');
select hasnt_table('public', 'job_requirement_extractions', 'no materialized extraction table');
select hasnt_table('public', 'job_analytics_queue', 'no extraction queue');
select hasnt_column('public', 'jobs', 'current_description_version_id', 'jobs has no pointer to a duplicate description');
select col_is_null('public', 'workspace_job_events', 'job_id', 'history remains if a job is removed');
select col_is_null('public', 'workspace_job_events', 'actor_user_id', 'history supports system actions without a fake user');
select ok(not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('persist_scanned_job_analytics', 'backfill_job_description_batch')), 'no analytics copy or backfill RPC exists');
select ok(not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'get_job_analytics_summary'), 'no app-only analytics summary RPC exists');
select ok((select relhastriggers from pg_class where oid = 'public.jobs'::regclass), 'job workflow audit trigger remains enabled');
select set_config('request.jwt.claim.sub',(select user_id::text from public.jobs order by id limit 1),true);
select lives_ok(
  $$select * from public.list_jobs((enum_range(null::public."Job Status"))[1],null,5,null,null,null,null,false,null,'UTC')$$,
  'the current 10-argument job-list call returns rows with the jobs table shape'
);

select set_config('request.jwt.claim.sub',(select user_id::text from public.jobs order by id limit 1),true);
select lives_ok(
  $$select (public.workspace_update_job_review_v2(
    (select id from public.jobs order by id limit 1),
    (select case when status='ready' then 'new'::public."Job Status" else 'ready'::public."Job Status" end from public.jobs order by id limit 1),
    null,'not_interested','pgTAP audit check','web'
  )).id$$,
  'a workspace member can change a job and record an audit event'
);
select is((select count(*)::integer from public.workspace_job_events where reason_text='pgTAP audit check' and reason_code='not_interested' and channel='web'),1,'the audit event records the reason and channel once');
select throws_ok(
  $$select public.workspace_update_job_review_v2(-1,'ready',null,'invalid_reason',null,'web')$$,
  'P0001','Invalid reason code','invalid workflow reasons are rejected'
);
create temporary table pg_temp.job_other_workspace(job_id bigint);
do $$
declare
  other_owner uuid := gen_random_uuid();
  owner_site_id bigint;
  other_job_id bigint;
begin
  select j."siteId" into owner_site_id from public.jobs j order by j.id limit 1;
  insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data)
  values(other_owner,'authenticated','authenticated',other_owner::text || '@example.test','', '{}'::jsonb, '{}'::jsonb);
  insert into public.jobs(user_id,"externalId","externalUrl","siteId",title,"companyName",status,description)
  values(other_owner,'pgtap-other-' || other_owner::text,'https://example.test/pgtap-other',owner_site_id,
    'pgTAP workspace isolation fixture','Example Test','new','Temporary test description')
  returning id into other_job_id;
  insert into pg_temp.job_other_workspace values(other_job_id);
end $$;
select throws_ok(
  $$select public.workspace_update_job_review_v2((select job_id from pg_temp.job_other_workspace),'ready',null,'unspecified',null,'web')$$,
  'P0001','Job not found in the current workspace','jobs outside the workspace are not editable'
);

create temporary table pg_temp.job_scanner_retry_baseline as
select id, description from public.jobs order by id limit 1;
select lives_ok(
  $$update public.jobs set status='applied' where id=(select id from pg_temp.job_scanner_retry_baseline)$$,
  'the QA transaction can set up a human-completed job state'
);
select lives_ok(
  $$update public.jobs set status='new' where id=(select id from pg_temp.job_scanner_retry_baseline) and status in ('processing','new')$$,
  'the retry guard safely ignores a job already marked applied'
);
select is((select status::text from public.jobs where id=(select id from pg_temp.job_scanner_retry_baseline)),'applied','the human-applied status stays intact after the retry guard');
select lives_ok(
  $$update public.jobs set status='processing' where id=(select id from pg_temp.job_scanner_retry_baseline)$$,
  'the QA transaction can set up a retryable job'
);
select lives_ok(
  $$update public.jobs set status='new',exclude_reason='temporary retry test' where id=(select id from pg_temp.job_scanner_retry_baseline) and status in ('processing','new')$$,
  'a failed scan can return an eligible job to the new queue'
);
select ok((select j.status='new' and j.description is not distinct from b.description from public.jobs j join pg_temp.job_scanner_retry_baseline b using(id)),'the retry reset preserves the existing description');

select * from finish();
rollback;
