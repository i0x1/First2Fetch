-- Persist scanner results without reopening jobs reviewed by a human.
-- The existing jobs row remains the only stored description copy.
create or replace function public.workspace_apply_job_scan_v1(job_id bigint, updates jsonb)
returns public.jobs language plpgsql security definer set search_path = '' as $$
declare
  current_job public.jobs;
  next_status public."Job Status" := (updates->>'status')::public."Job Status";
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if next_status is null or next_status not in ('new','excluded_by_advanced_matching') then raise exception 'Invalid scanner status'; end if;
  select j.* into current_job from public.jobs j
    where j.id=workspace_apply_job_scan_v1.job_id and j.user_id=(select auth.uid()) for update;
  if current_job.id is null then raise exception 'Job not found in the owner workspace'; end if;
  if current_job.status not in ('processing','new') then return null; end if;
  perform set_config('app.job_event_channel','scanner',true);
  perform set_config('app.job_event_reason_code',case when nullif(updates->>'exclude_reason','') is null then 'unspecified' else 'other' end,true);
  perform set_config('app.job_event_reason_text',coalesce(left(updates->>'exclude_reason',1000),''),true);
  update public.jobs j set
    status=next_status,
    description=coalesce(nullif(btrim(updates->>'description'),''),j.description),
    salary=case when updates ? 'salary' then updates->>'salary' else j.salary end,
    tags=case when jsonb_typeof(updates->'tags')='array' then array(select jsonb_array_elements_text(updates->'tags')) else j.tags end,
    exclude_reason=case when updates ? 'exclude_reason' then updates->>'exclude_reason' else j.exclude_reason end,
    updated_at=now()
    where j.id=current_job.id returning j.* into current_job;
  return current_job;
end $$;
revoke all on function public.workspace_apply_job_scan_v1(bigint,jsonb) from public, anon, authenticated;
grant execute on function public.workspace_apply_job_scan_v1(bigint,jsonb) to authenticated;

create or replace function public.audit_job_workflow_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  actor_mail text;
  event_action text;
  event_channel text := coalesce(nullif(current_setting('app.job_event_channel',true),''),'unknown');
  event_reason_code text := coalesce(nullif(current_setting('app.job_event_reason_code',true),''),'unspecified');
  event_reason_text text := nullif(current_setting('app.job_event_reason_text',true),'');
begin
  if new.status is not distinct from old.status and new.labels is not distinct from old.labels then return new; end if;
  event_action := case when new.status is distinct from old.status then 'status_changed' else 'labels_changed' end;
  if event_channel='scanner' then actor_id := null; end if;
  if actor_id is not null then select u.email into actor_mail from auth.users u where u.id=actor_id; end if;
  insert into public.workspace_job_events
    (workspace_owner_id,job_id,actor_user_id,actor_email,actor_kind,channel,action,from_status,to_status,from_labels,to_labels,reason_code,reason_text)
  values
    (new.user_id,new.id,actor_id,actor_mail,case when actor_id is null then 'system' else 'human' end,
     case when actor_id is null and event_channel='unknown' then 'scanner' else event_channel end,
     event_action,old.status,new.status,old.labels,new.labels,event_reason_code,event_reason_text);
  return new;
end $$;
revoke all on function public.audit_job_workflow_change() from public, anon, authenticated;
