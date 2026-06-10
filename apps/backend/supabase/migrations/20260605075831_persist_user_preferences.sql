-- Keep user preference data database-backed and portable across local/hosted Supabase.
-- This migration is intentionally idempotent so older hosted projects can catch up safely.

alter table public.advanced_matching
  add column if not exists watched_companies text[] not null default '{}'::text[],
  add column if not exists ai_jd_filter_provider text,
  add column if not exists ai_jd_filter_model text,
  add column if not exists ai_job_list_provider text,
  add column if not exists ai_job_list_model text,
  add column if not exists ai_jd_parse_provider text,
  add column if not exists ai_jd_parse_model text,
  add column if not exists ai_api_keys_encrypted jsonb not null default '{}'::jsonb,
  add column if not exists ai_configured_providers text[] not null default '{}'::text[];

update public.advanced_matching
set
  watched_companies = coalesce(watched_companies, '{}'::text[]),
  blacklisted_companies = coalesce(blacklisted_companies, '{}'::text[]),
  favorite_companies = coalesce(favorite_companies, '{}'::text[]),
  chatgpt_prompt = coalesce(chatgpt_prompt, ''),
  ai_api_keys_encrypted = coalesce(ai_api_keys_encrypted, '{}'::jsonb),
  ai_configured_providers = coalesce(ai_configured_providers, '{}'::text[]);

alter table public.advanced_matching enable row level security;
alter table public.links enable row level security;

drop policy if exists "enable all for users based on user_id" on public.advanced_matching;
create policy "enable all for users based on user_id"
on public.advanced_matching
as permissive
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "enable all for users based on user_id" on public.links;
create policy "enable all for users based on user_id"
on public.links
as permissive
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists idx_advanced_matching_user_id
on public.advanced_matching (user_id);

create index if not exists idx_links_user_id
on public.links (user_id);

drop function if exists public.update_advanced_matching_with_ai_config(
  text,
  text[],
  text[],
  text,
  text,
  text,
  text
);

drop function if exists public.update_advanced_matching_with_ai_config(
  text,
  text[],
  text[],
  text[],
  text,
  text,
  text
);

create or replace function public.update_advanced_matching_with_ai_config(
  p_chatgpt_prompt text,
  p_blacklisted_companies text[],
  p_favorite_companies text[] default null,
  p_watched_companies text[] default null,
  p_ai_provider text default null,
  p_ai_model text default null,
  p_ai_api_key text default null,
  p_ai_jd_filter_provider text default null,
  p_ai_jd_filter_model text default null,
  p_ai_job_list_provider text default null,
  p_ai_job_list_model text default null,
  p_ai_jd_parse_provider text default null,
  p_ai_jd_parse_model text default null,
  p_ai_api_keys jsonb default null
)
returns public.advanced_matching
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_encrypted_key text;
  v_result public.advanced_matching;
  v_merged_keys jsonb;
  v_provider text;
  v_raw_key text;
  v_configured_providers text[];
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'User must be authenticated';
  end if;

  if p_ai_api_key is not null and p_ai_api_key != '' and p_ai_provider is not null then
    v_encrypted_key := private.encrypt_api_key(p_ai_api_key, v_user_id);
  end if;

  select coalesce(ai_api_keys_encrypted, '{}'::jsonb)
  into v_merged_keys
  from public.advanced_matching
  where user_id = v_user_id;

  if v_merged_keys is null then
    v_merged_keys := '{}'::jsonb;
  end if;

  if p_ai_api_keys is not null then
    for v_provider, v_raw_key in
      select * from jsonb_each_text(p_ai_api_keys)
    loop
      if v_raw_key is not null and v_raw_key != '' then
        v_merged_keys := v_merged_keys || jsonb_build_object(
          v_provider,
          private.encrypt_api_key(v_raw_key, v_user_id)
        );
      end if;
    end loop;
  end if;

  if v_encrypted_key is not null and p_ai_provider is not null then
    v_merged_keys := v_merged_keys || jsonb_build_object(p_ai_provider, v_encrypted_key);
  end if;

  select coalesce(array_agg(k order by k), '{}'::text[])
  into v_configured_providers
  from jsonb_object_keys(v_merged_keys) as k;

  insert into public.advanced_matching (
    user_id,
    chatgpt_prompt,
    blacklisted_companies,
    favorite_companies,
    watched_companies,
    ai_provider,
    ai_model,
    ai_api_key_encrypted,
    ai_jd_filter_provider,
    ai_jd_filter_model,
    ai_job_list_provider,
    ai_job_list_model,
    ai_jd_parse_provider,
    ai_jd_parse_model,
    ai_api_keys_encrypted,
    ai_configured_providers
  )
  values (
    v_user_id,
    p_chatgpt_prompt,
    coalesce(p_blacklisted_companies, '{}'::text[]),
    coalesce(p_favorite_companies, '{}'::text[]),
    coalesce(p_watched_companies, '{}'::text[]),
    p_ai_provider,
    p_ai_model,
    v_encrypted_key,
    p_ai_jd_filter_provider,
    p_ai_jd_filter_model,
    p_ai_job_list_provider,
    p_ai_job_list_model,
    p_ai_jd_parse_provider,
    p_ai_jd_parse_model,
    v_merged_keys,
    v_configured_providers
  )
  on conflict (user_id) do update set
    chatgpt_prompt = excluded.chatgpt_prompt,
    blacklisted_companies = excluded.blacklisted_companies,
    favorite_companies = excluded.favorite_companies,
    watched_companies = coalesce(excluded.watched_companies, public.advanced_matching.watched_companies),
    ai_provider = coalesce(excluded.ai_provider, public.advanced_matching.ai_provider),
    ai_model = coalesce(excluded.ai_model, public.advanced_matching.ai_model),
    ai_api_key_encrypted = coalesce(excluded.ai_api_key_encrypted, public.advanced_matching.ai_api_key_encrypted),
    ai_jd_filter_provider = coalesce(excluded.ai_jd_filter_provider, public.advanced_matching.ai_jd_filter_provider),
    ai_jd_filter_model = coalesce(excluded.ai_jd_filter_model, public.advanced_matching.ai_jd_filter_model),
    ai_job_list_provider = coalesce(excluded.ai_job_list_provider, public.advanced_matching.ai_job_list_provider),
    ai_job_list_model = coalesce(excluded.ai_job_list_model, public.advanced_matching.ai_job_list_model),
    ai_jd_parse_provider = coalesce(excluded.ai_jd_parse_provider, public.advanced_matching.ai_jd_parse_provider),
    ai_jd_parse_model = coalesce(excluded.ai_jd_parse_model, public.advanced_matching.ai_jd_parse_model),
    ai_api_keys_encrypted = case
      when excluded.ai_api_keys_encrypted = '{}'::jsonb
      then public.advanced_matching.ai_api_keys_encrypted
      else excluded.ai_api_keys_encrypted
    end,
    ai_configured_providers = excluded.ai_configured_providers;

  select * into v_result
  from public.advanced_matching
  where user_id = v_user_id;

  v_result.ai_api_key_encrypted := null;
  v_result.ai_api_keys_encrypted := '{}'::jsonb;

  return v_result;
end;
$$;

grant select, insert, update, delete on table public.advanced_matching to authenticated;
grant select, insert, update, delete on table public.links to authenticated;
grant usage, select on sequence public.advanced_matching_id_seq to authenticated;
grant usage, select on sequence public.links_id_seq to authenticated;
grant execute on function private.encrypt_api_key(text, uuid) to authenticated;

revoke execute on function public.update_advanced_matching_with_ai_config(
  text,
  text[],
  text[],
  text[],
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) from anon;

grant execute on function public.update_advanced_matching_with_ai_config(
  text,
  text[],
  text[],
  text[],
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;
