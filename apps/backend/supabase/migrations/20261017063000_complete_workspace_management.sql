-- Restore the missing owner-only member management RPCs used by the UI.
create or replace function public.invite_workspace_member(member_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  member_id uuid;
  owner_id uuid := (select auth.uid());
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if not public.is_workspace_owner() then raise exception 'Only the workspace owner can manage members'; end if;
  select u.id into member_id from auth.users u where lower(u.email)=lower(trim(member_email)) limit 1;
  if member_id is null then raise exception 'No account exists for that email. Ask the helper to sign up first.'; end if;
  if member_id=owner_id then raise exception 'The owner account cannot be added as its own helper.'; end if;
  insert into public.workspace_memberships(workspace_owner_id,member_user_id,member_email)
    values(owner_id,member_id,lower(trim(member_email)))
    on conflict(workspace_owner_id,member_user_id) do update set role='helper',member_email=excluded.member_email;
  return member_id;
end $$;
create or replace function public.remove_workspace_member(member_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.is_workspace_owner() then raise exception 'Only the workspace owner can manage members'; end if;
  delete from public.workspace_memberships where workspace_owner_id=(select auth.uid()) and member_user_id=remove_workspace_member.member_id;
end $$;
revoke all on function public.invite_workspace_member(text) from public,anon,authenticated;
revoke all on function public.remove_workspace_member(uuid) from public,anon,authenticated;
grant execute on function public.invite_workspace_member(text) to authenticated;
grant execute on function public.remove_workspace_member(uuid) to authenticated;
revoke all on function public.current_workspace_owner_id() from public,anon;
revoke all on function public.is_workspace_member(uuid) from public,anon;
grant execute on function public.current_workspace_owner_id() to authenticated,service_role;
grant execute on function public.is_workspace_member(uuid) to authenticated,service_role;
