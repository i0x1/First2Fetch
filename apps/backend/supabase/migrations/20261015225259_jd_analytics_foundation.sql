-- Keep job descriptions and current job details in public.jobs only.
-- This migration adds workflow attribution, not analytics copies or backfills.

alter table public.workspace_job_events add column if not exists actor_kind text not null default 'human'
  check (actor_kind in ('human', 'system', 'import'));
alter table public.workspace_job_events add column if not exists channel text not null default 'unknown'
  check (channel in ('electron', 'web', 'scanner', 'import', 'unknown'));
alter table public.workspace_job_events add column if not exists reason_code text not null default 'unspecified'
  check (reason_code in ('unspecified', 'seniority_mismatch', 'location_mismatch', 'sponsorship_unavailable', 'clearance_required', 'skills_mismatch', 'employment_type_mismatch', 'company_blacklisted', 'duplicate', 'expired', 'not_interested', 'other'));
alter table public.workspace_job_events add column if not exists reason_text text;
alter table public.workspace_job_events alter column actor_user_id drop not null;
alter table public.workspace_job_events alter column actor_email drop not null;
alter table public.workspace_job_events alter column job_id drop not null;

do $$ begin
  if exists (select 1 from pg_constraint where conname = 'workspace_job_events_job_id_fkey') then
    alter table public.workspace_job_events drop constraint workspace_job_events_job_id_fkey;
  end if;
  alter table public.workspace_job_events add constraint workspace_job_events_job_id_fkey
    foreign key (job_id) references public.jobs(id) on delete set null;
  if exists (select 1 from pg_constraint where conname = 'workspace_job_events_actor_user_id_fkey') then
    alter table public.workspace_job_events drop constraint workspace_job_events_actor_user_id_fkey;
  end if;
  alter table public.workspace_job_events add constraint workspace_job_events_actor_user_id_fkey
    foreign key (actor_user_id) references auth.users(id) on delete set null;
end $$;

create or replace function public.audit_job_workflow_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  actor_mail text;
  event_action text;
  event_channel text := coalesce(nullif(current_setting('app.job_event_channel', true), ''), 'unknown');
  event_reason_code text := coalesce(nullif(current_setting('app.job_event_reason_code', true), ''), 'unspecified');
  event_reason_text text := nullif(current_setting('app.job_event_reason_text', true), '');
begin
  if new.status is not distinct from old.status and new.labels is not distinct from old.labels then return new; end if;
  event_action := case when new.status is distinct from old.status then 'status_changed' else 'labels_changed' end;
  if actor_id is not null then select u.email into actor_mail from auth.users u where u.id = actor_id; end if;
  insert into public.workspace_job_events
    (workspace_owner_id, job_id, actor_user_id, actor_email, actor_kind, channel,
     action, from_status, to_status, from_labels, to_labels, reason_code, reason_text)
  values
    (new.user_id, new.id, actor_id, actor_mail,
     case when actor_id is null then 'system' else 'human' end,
     case when actor_id is null and event_channel = 'unknown' then 'scanner' else event_channel end,
     event_action, old.status, new.status,
     old.labels, new.labels, event_reason_code, event_reason_text);
  return new;
end $$;

drop trigger if exists trigger_audit_job_workflow_change on public.jobs;
create trigger trigger_audit_job_workflow_change after update of status, labels on public.jobs
  for each row execute function public.audit_job_workflow_change();
revoke all on function public.audit_job_workflow_change() from public, anon, authenticated;

create or replace function public.workspace_update_job_review_v2(
  job_id bigint,
  new_status public."Job Status" default null,
  new_labels text[] default null,
  reason_code text default 'unspecified',
  reason_text text default null,
  channel text default 'web'
)
returns public.jobs language plpgsql security definer set search_path = '' as $$
declare
  current_job public.jobs;
  allowed_reasons constant text[] := array['unspecified','seniority_mismatch','location_mismatch','sponsorship_unavailable','clearance_required','skills_mismatch','employment_type_mismatch','company_blacklisted','duplicate','expired','not_interested','other'];
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if new_status is null and new_labels is null then raise exception 'A status or labels update is required'; end if;
  if reason_code is null or not (reason_code = any(allowed_reasons)) then raise exception 'Invalid reason code'; end if;
  if channel is null or channel not in ('electron','web','unknown') then raise exception 'Invalid action channel'; end if;
  select j.* into current_job from public.jobs j
    where j.id = workspace_update_job_review_v2.job_id and public.is_workspace_member(j.user_id) for update;
  if current_job.id is null then raise exception 'Job not found in the current workspace'; end if;
  perform set_config('app.job_event_reason_code', reason_code, true);
  perform set_config('app.job_event_reason_text', coalesce(left(reason_text, 1000), ''), true);
  perform set_config('app.job_event_channel', channel, true);
  update public.jobs j set status = coalesce(new_status, j.status), labels = coalesce(new_labels, j.labels), updated_at = now()
    where j.id = current_job.id;
  select j.* into current_job from public.jobs j where j.id = current_job.id;
  return current_job;
end $$;
revoke all on function public.workspace_update_job_review_v2(bigint, public."Job Status", text[], text, text, text) from public, anon, authenticated;
grant execute on function public.workspace_update_job_review_v2(bigint, public."Job Status", text[], text, text, text) to authenticated;

create or replace function public.workspace_update_job_review(
  job_id bigint,
  new_status public."Job Status" default null,
  new_labels text[] default null
)
returns public.jobs language plpgsql security definer set search_path = '' as $$
begin
  return public.workspace_update_job_review_v2(job_id, new_status, new_labels, 'unspecified', null, 'web');
end $$;
revoke all on function public.workspace_update_job_review(bigint, public."Job Status", text[]) from public, anon, authenticated;
grant execute on function public.workspace_update_job_review(bigint, public."Job Status", text[]) to authenticated;

create or replace function public.workspace_bulk_update_job_status_v2(
  from_status public."Job Status", to_status public."Job Status", channel text default 'electron'
)
returns integer language plpgsql security definer set search_path = '' as $$
declare changed_count integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if channel is null or channel not in ('electron','web','unknown') then raise exception 'Invalid action channel'; end if;
  perform set_config('app.job_event_reason_code', 'unspecified', true);
  perform set_config('app.job_event_reason_text', '', true);
  perform set_config('app.job_event_channel', channel, true);
  update public.jobs j set status = to_status, updated_at = now()
    where j.status = from_status and public.is_workspace_member(j.user_id);
  get diagnostics changed_count = row_count;
  return changed_count;
end $$;
revoke all on function public.workspace_bulk_update_job_status_v2(public."Job Status", public."Job Status", text) from public, anon, authenticated;
grant execute on function public.workspace_bulk_update_job_status_v2(public."Job Status", public."Job Status", text) to authenticated;
