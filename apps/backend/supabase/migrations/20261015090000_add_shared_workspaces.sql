-- Allow a second authenticated user to work on the owner's job workspace.
-- The scanner remains owner-only. Helpers can read jobs and use the narrow
-- review RPC to update status and labels.

create table if not exists public.workspace_memberships (
  workspace_owner_id uuid not null references auth.users (id) on delete cascade,
  member_user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'helper' check (role in ('helper')),
  created_at timestamptz not null default now(),
  constraint workspace_memberships_pkey primary key (workspace_owner_id, member_user_id),
  constraint workspace_memberships_not_self check (workspace_owner_id <> member_user_id),
  constraint workspace_memberships_one_workspace unique (member_user_id)
);

alter table public.workspace_memberships enable row level security;

create or replace function public.current_workspace_owner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select wm.workspace_owner_id
      from public.workspace_memberships wm
      where wm.member_user_id = (select auth.uid())
      limit 1
    ),
    (select auth.uid())
  );
$$;

create or replace function public.is_workspace_member(workspace_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select workspace_owner = public.current_workspace_owner_id();
$$;

drop policy if exists "workspace members can view their membership" on public.workspace_memberships;
drop policy if exists "workspace owners manage memberships" on public.workspace_memberships;

create policy "workspace members can view their membership"
on public.workspace_memberships
for select
to authenticated
using (
  workspace_owner_id = public.current_workspace_owner_id()
  or member_user_id = (select auth.uid())
);

create policy "workspace owners manage memberships"
on public.workspace_memberships
for all
to authenticated
using (workspace_owner_id = (select auth.uid()))
with check (workspace_owner_id = (select auth.uid()));

create or replace function public.invite_workspace_member(member_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_id uuid;
  owner_id uuid := (select auth.uid());
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;

  select u.id into member_id
  from auth.users u
  where lower(u.email) = lower(trim(member_email))
  limit 1;

  if member_id is null then
    raise exception 'No account exists for that email. Ask the helper to sign up first.';
  end if;

  if member_id = owner_id then
    raise exception 'The owner account cannot be added as its own helper.';
  end if;

  insert into public.workspace_memberships (workspace_owner_id, member_user_id)
  values (owner_id, member_id)
  on conflict (workspace_owner_id, member_user_id) do update
    set role = excluded.role;

  return member_id;
end;
$$;

create or replace function public.remove_workspace_member(member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  delete from public.workspace_memberships
  where workspace_owner_id = (select auth.uid())
    and workspace_memberships.member_user_id = remove_workspace_member.member_id;
end;
$$;

revoke all on function public.invite_workspace_member(text) from public, anon, authenticated;
grant execute on function public.invite_workspace_member(text) to authenticated;
revoke all on function public.remove_workspace_member(uuid) from public, anon, authenticated;
grant execute on function public.remove_workspace_member(uuid) to authenticated;

-- Helpers can read jobs. The existing owner policy remains the only direct
-- write policy. Helper writes use workspace_update_job_review below.
drop policy if exists "enable all for users based on user_id" on public.jobs;
drop policy if exists "workspace members can read jobs" on public.jobs;
drop policy if exists "workspace owners manage jobs" on public.jobs;

create policy "workspace members can read jobs"
on public.jobs
for select
to authenticated
using (public.is_workspace_member(user_id));

create policy "workspace owners manage jobs"
on public.jobs
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "enable all for users based on user_id" on public.links;
drop policy if exists "workspace members can read links" on public.links;
drop policy if exists "workspace owners manage links" on public.links;

create policy "workspace members can read links"
on public.links
for select
to authenticated
using (public.is_workspace_member(user_id));

create policy "workspace owners manage links"
on public.links
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Keep profiles and AI settings private to the owner account.
drop policy if exists "enable select profiles for authenticated users only" on public.profiles;
create policy "enable select profiles for authenticated users only"
on public.profiles
for select
to authenticated
using (user_id = (select auth.uid()));

-- This is the only helper write surface. It cannot change ownership,
-- descriptions, URLs, scanner fields, or any other job column.
create or replace function public.workspace_update_job_review(
  job_id bigint,
  new_status public."Job Status" default null,
  new_labels text[] default null
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_job public.jobs;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select j.* into workspace_job
  from public.jobs j
  where j.id = workspace_update_job_review.job_id
    and public.is_workspace_member(j.user_id);

  if workspace_job.id is null then
    raise exception 'Job not found in the current workspace';
  end if;

  if new_status is null and new_labels is null then
    raise exception 'A status or labels update is required';
  end if;

  update public.jobs j
  set status = coalesce(new_status, j.status),
      labels = coalesce(new_labels, j.labels),
      updated_at = now()
  where j.id = workspace_update_job_review.job_id;

  select j.* into workspace_job
  from public.jobs j
  where j.id = workspace_update_job_review.job_id;

  return workspace_job;
end;
$$;

revoke all on function public.workspace_update_job_review(bigint, public."Job Status", text[]) from public, anon, authenticated;
grant execute on function public.workspace_update_job_review(bigint, public."Job Status", text[]) to authenticated;

comment on table public.workspace_memberships is
  'Allows one helper account to access an owner job workspace without sharing credentials.';
