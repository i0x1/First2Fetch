-- Tighten RPC exposure for SECURITY DEFINER functions and align job summaries with RLS.
-- Fixes Supabase security advisor warnings (anon/authenticated executing definer RPCs).

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to postgres, service_role;

-- Internal crypto helpers (not exposed via PostgREST; private schema is omitted from API schemas).
create or replace function private.encrypt_api_key(api_key text, user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  encryption_secret text;
  key_hash text;
  api_key_encoded text;
begin
  encryption_secret := coalesce(
    current_setting('app.encryption_secret', true),
    'default-dev-secret-change-in-production-2024'
  );

  key_hash := md5(user_id::text || encryption_secret);

  api_key_encoded := encode(
    convert_to(api_key || '::' || substring(key_hash, 1, 16), 'UTF8'),
    'base64'
  );

  return 'enc_v1:' || api_key_encoded;
exception
  when others then
    raise exception 'Failed to encrypt API key: %', sqlerrm;
end;
$$;

create or replace function private.decrypt_api_key(encrypted_key text, user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  encryption_secret text;
  key_hash text;
  decoded_data text;
  expected_suffix text;
  version_prefix text;
  encoded_data text;
begin
  encryption_secret := coalesce(
    current_setting('app.encryption_secret', true),
    'default-dev-secret-change-in-production-2024'
  );

  key_hash := md5(user_id::text || encryption_secret);
  expected_suffix := '::' || substring(key_hash, 1, 16);

  version_prefix := split_part(encrypted_key, ':', 1);
  encoded_data := substring(encrypted_key from length(version_prefix) + 2);

  if version_prefix != 'enc_v1' then
    raise exception 'Unsupported encryption version: %', version_prefix;
  end if;

  decoded_data := convert_from(decode(encoded_data, 'base64'), 'UTF8');

  if decoded_data like '%' || expected_suffix then
    return substring(decoded_data from 1 for length(decoded_data) - length(expected_suffix));
  else
    raise exception 'Invalid encrypted key format or corrupted data';
  end if;
exception
  when others then
    raise exception 'Failed to decrypt API key: %', sqlerrm;
end;
$$;

revoke all on function private.encrypt_api_key(text, uuid) from public;
revoke all on function private.decrypt_api_key(text, uuid) from public;
grant execute on function private.encrypt_api_key(text, uuid) to authenticated, service_role;
grant execute on function private.decrypt_api_key(text, uuid) to service_role;

-- Public decrypt wrapper for edge functions (service role only).
create or replace function public.decrypt_api_key(encrypted_key text, user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.decrypt_api_key(encrypted_key, user_id);
end;
$$;

-- Job date summaries: SECURITY INVOKER + RLS (same filters as phase1 migration).
create or replace function public.get_job_dates_summary(
    jobs_status "Job Status",
    jobs_search text default null,
    jobs_site_ids integer[] default null,
    jobs_link_ids integer[] default null,
    jobs_labels text[] default null,
    hide_reposted boolean default false
)
returns table(
    date_key date,
    total_count bigint,
    favorite_count bigint
)
language plpgsql
set search_path = ''
as $$
declare
  favorite_companies_lower text[] := array[]::text[];
begin
  select coalesce(array_agg(lower(fc)), array[]::text[]) into favorite_companies_lower
  from (
    select unnest(am.favorite_companies) as fc
    from public.advanced_matching am
    where am.user_id = auth.uid()
  ) favorite_values;

  return query
  select
    j.created_at::date as date_key,
    count(*) as total_count,
    count(*) filter (
      where array_length(favorite_companies_lower, 1) > 0
        and lower(j."companyName") = any(favorite_companies_lower)
    ) as favorite_count
  from public.jobs j
  where j.user_id = auth.uid()
    and j.status = jobs_status
    and (array_length(jobs_site_ids, 1) is null or j."siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or j.link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or j.labels && jobs_labels)
    and (jobs_search is null or j.job_search_vector @@ plainto_tsquery('english', jobs_search))
    and (not hide_reposted or j.is_repost = false or j.is_repost is null)
  group by j.created_at::date
  order by j.created_at::date desc;
end;
$$;

create or replace function public.get_job_dates_summary(
    jobs_status "Job Status",
    jobs_search text default null,
    jobs_site_ids integer[] default null,
    jobs_link_ids integer[] default null,
    jobs_labels text[] default null,
    hide_reposted boolean default false,
    timezone_name text default 'UTC'
)
returns table(
    date_key date,
    total_count bigint,
    favorite_count bigint
)
language plpgsql
set search_path = ''
as $$
declare
  favorite_companies_lower text[] := array[]::text[];
begin
  if timezone_name is null or timezone_name = '' then
    timezone_name := 'UTC';
  end if;

  select coalesce(array_agg(lower(fc)), array[]::text[]) into favorite_companies_lower
  from (
    select unnest(am.favorite_companies) as fc
    from public.advanced_matching am
    where am.user_id = auth.uid()
  ) favorite_values;

  return query
  select
    (timezone(timezone_name, j.created_at))::date as date_key,
    count(*) as total_count,
    count(*) filter (
      where array_length(favorite_companies_lower, 1) > 0
        and lower(j."companyName") = any(favorite_companies_lower)
    ) as favorite_count
  from public.jobs j
  where j.user_id = auth.uid()
    and j.status = jobs_status
    and (array_length(jobs_site_ids, 1) is null or j."siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or j.link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or j.labels && jobs_labels)
    and (jobs_search is null or j.job_search_vector @@ plainto_tsquery('english', jobs_search))
    and (not hide_reposted or j.is_repost = false or j.is_repost is null)
  group by (timezone(timezone_name, j.created_at))::date
  order by (timezone(timezone_name, j.created_at))::date desc;
end;
$$;

drop function if exists public.update_advanced_matching_with_ai_config(
  text,
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
  p_ai_api_key text default null
)
returns public.advanced_matching
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_encrypted_key text;
  v_result public.advanced_matching;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'User must be authenticated';
  end if;

  if p_ai_api_key is not null and p_ai_api_key != '' then
    v_encrypted_key := private.encrypt_api_key(p_ai_api_key, v_user_id);
  end if;

  insert into public.advanced_matching (
    user_id,
    chatgpt_prompt,
    blacklisted_companies,
    favorite_companies,
    watched_companies,
    ai_provider,
    ai_model,
    ai_api_key_encrypted
  )
  values (
    v_user_id,
    p_chatgpt_prompt,
    p_blacklisted_companies,
    coalesce(p_favorite_companies, '{}'::text[]),
    coalesce(p_watched_companies, '{}'::text[]),
    p_ai_provider,
    p_ai_model,
    v_encrypted_key
  )
  on conflict (user_id) do update set
    chatgpt_prompt = excluded.chatgpt_prompt,
    blacklisted_companies = excluded.blacklisted_companies,
    favorite_companies = excluded.favorite_companies,
    watched_companies = coalesce(excluded.watched_companies, public.advanced_matching.watched_companies),
    ai_provider = excluded.ai_provider,
    ai_model = excluded.ai_model,
    ai_api_key_encrypted = coalesce(excluded.ai_api_key_encrypted, public.advanced_matching.ai_api_key_encrypted);

  select * into v_result
  from public.advanced_matching
  where user_id = v_user_id;

  v_result.ai_api_key_encrypted := null;

  return v_result;
end;
$$;

-- Revoke anonymous access to user-facing RPCs (authenticated JWT required).
revoke execute on function public.get_job_dates_summary("Job Status", text, integer[], integer[], text[], boolean) from anon;
revoke execute on function public.get_job_dates_summary("Job Status", text, integer[], integer[], text[], boolean, text) from anon;
revoke execute on function public.update_advanced_matching_with_ai_config(text, text[], text[], text[], text, text, text) from anon;

revoke execute on function public.list_jobs("Job Status", text, integer, text, integer[], integer[], text[]) from anon;
revoke execute on function public.list_jobs("Job Status", text, integer, text, integer[], integer[], text[], boolean) from anon;
revoke execute on function public.list_jobs("Job Status", text, integer, text, integer[], integer[], text[], boolean, date) from anon;
revoke execute on function public.list_jobs("Job Status", text, integer, text, integer[], integer[], text[], boolean, date, text) from anon;

revoke execute on function public.count_jobs("Job Status", text, integer[], integer[], text[]) from anon;
revoke execute on function public.count_jobs(text, integer[], integer[], text[], boolean) from anon;

revoke execute on function public.log_ai_usage(uuid, numeric, bigint, bigint) from anon;

-- Backend-only SECURITY DEFINER RPCs (revoke PUBLIC default grants first).
revoke all on function public.decrypt_api_key(text, uuid) from public;
revoke all on function public.decrypt_api_key(text, uuid) from anon, authenticated;
grant execute on function public.decrypt_api_key(text, uuid) to service_role;

revoke all on function public.encrypt_api_key(text, uuid) from public, anon, authenticated;
grant execute on function public.encrypt_api_key(text, uuid) to service_role;

revoke all on function public.count_chatgpt_usage(uuid, numeric, integer, integer) from public, anon, authenticated;
grant execute on function public.count_chatgpt_usage(uuid, numeric, integer, integer) to service_role;

revoke all on function public.get_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.get_user_id_by_email(text) to service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated;
