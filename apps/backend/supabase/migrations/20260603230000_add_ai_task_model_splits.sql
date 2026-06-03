-- Per-task AI provider/model splits + multi-provider encrypted API keys

alter table public.advanced_matching
  add column if not exists ai_jd_filter_provider text,
  add column if not exists ai_jd_filter_model text,
  add column if not exists ai_job_list_provider text,
  add column if not exists ai_job_list_model text,
  add column if not exists ai_jd_parse_provider text,
  add column if not exists ai_jd_parse_model text,
  add column if not exists ai_api_keys_encrypted jsonb not null default '{}'::jsonb,
  add column if not exists ai_configured_providers text[] not null default '{}'::text[];

comment on column public.advanced_matching.ai_jd_filter_provider is 'AI provider for JD filter / advanced matching';
comment on column public.advanced_matching.ai_jd_filter_model is 'Model for JD filter / advanced matching';
comment on column public.advanced_matching.ai_job_list_provider is 'AI provider for custom job list scraping';
comment on column public.advanced_matching.ai_job_list_model is 'Model for custom job list scraping';
comment on column public.advanced_matching.ai_jd_parse_provider is 'AI provider for custom JD parsing';
comment on column public.advanced_matching.ai_jd_parse_model is 'Model for custom JD parsing';
comment on column public.advanced_matching.ai_api_keys_encrypted is 'Map of provider name -> encrypted API key';

-- Backfill task columns and key map from legacy single provider fields
update public.advanced_matching
set
  ai_jd_filter_provider = coalesce(ai_jd_filter_provider, ai_provider),
  ai_jd_filter_model = coalesce(ai_jd_filter_model, ai_model),
  ai_job_list_provider = coalesce(ai_job_list_provider, ai_provider, 'google_gemini'),
  ai_job_list_model = coalesce(ai_job_list_model, ai_model, 'gemini-2.5-flash'),
  ai_jd_parse_provider = coalesce(ai_jd_parse_provider, ai_provider, 'google_gemini'),
  ai_jd_parse_model = coalesce(ai_jd_parse_model, ai_model, 'gemini-2.5-flash'),
  ai_api_keys_encrypted = case
    when ai_api_key_encrypted is not null
      and ai_provider is not null
      and (ai_api_keys_encrypted is null or ai_api_keys_encrypted = '{}'::jsonb)
    then jsonb_build_object(ai_provider, ai_api_key_encrypted)
    else coalesce(ai_api_keys_encrypted, '{}'::jsonb)
  end,
  ai_configured_providers = case
    when ai_provider is not null and ai_api_key_encrypted is not null
    then array[ai_provider]::text[]
    else coalesce(ai_configured_providers, '{}'::text[])
  end
where ai_provider is not null or ai_model is not null or ai_api_key_encrypted is not null;

alter table public.advanced_matching drop constraint if exists check_ai_provider;

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
    p_blacklisted_companies,
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
