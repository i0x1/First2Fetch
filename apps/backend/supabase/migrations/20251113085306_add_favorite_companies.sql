-- Add favorite companies support to advanced matching (guarded for fresh resets)

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'advanced_matching'
  ) then
    alter table public.advanced_matching
      add column if not exists favorite_companies text[] not null default '{}'::text[];

    update public.advanced_matching
    set favorite_companies = coalesce(favorite_companies, '{}'::text[])
    where favorite_companies is null;
  end if;
end;
$$;

-- Keep favorite companies prioritized in job listings

create or replace function public.list_jobs(
    jobs_status "Job Status",
    jobs_after text,
    jobs_page_size integer,
    jobs_search text default null,
    jobs_site_ids integer[] default null,
    jobs_link_ids integer[] default null,
    jobs_labels text[] default null
)
returns setof jobs
language plpgsql
set search_path = public
as $$
declare
  after_id integer;
  after_updated_at timestamp;
  favorite_companies_lower text[] := ARRAY[]::text[];
begin
  if jobs_after is not null then
    after_id := split_part(jobs_after, '!', 1)::integer;
    after_updated_at := split_part(jobs_after, '!', 2)::timestamp;
  end if;

  select coalesce(array_agg(lower(fc)), ARRAY[]::text[]) into favorite_companies_lower
  from (
    select unnest(am.favorite_companies) as fc
    from public.advanced_matching am
    where am.user_id = auth.uid()
  ) favorite_values;

  return query
  select *
  from jobs
  where status = jobs_status
    and (jobs_after is null or (updated_at, id) < (after_updated_at, after_id))
    and (array_length(jobs_site_ids, 1) is null or "siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or labels && jobs_labels)
    and (jobs_search is null or job_search_vector @@ plainto_tsquery('english', jobs_search))
  order by (case
              when array_length(favorite_companies_lower, 1) > 0
                then coalesce(lower("companyName") = any(favorite_companies_lower), false)
              else false
            end) desc,
           updated_at desc,
           id desc
  limit jobs_page_size;
end;
$$;

-- Allow storing favorite companies through the advanced matching RPC

create or replace function public.update_advanced_matching_with_ai_config(
  p_chatgpt_prompt text,
  p_blacklisted_companies text[],
  p_favorite_companies text[] default null,
  p_ai_provider text default null,
  p_ai_model text default null,
  p_ai_api_key text default null
)
returns advanced_matching
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_encrypted_key text;
  v_result advanced_matching;
begin
  -- Get current user ID
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'User must be authenticated';
  end if;

  -- Encrypt API key if provided
  if p_ai_api_key is not null and p_ai_api_key != '' then
    v_encrypted_key := encrypt_api_key(p_ai_api_key, v_user_id);
  end if;

  -- Upsert the configuration
  insert into public.advanced_matching (
    user_id,
    chatgpt_prompt,
    blacklisted_companies,
    favorite_companies,
    ai_provider,
    ai_model,
    ai_api_key_encrypted
  )
  values (
    v_user_id,
    p_chatgpt_prompt,
    p_blacklisted_companies,
    coalesce(p_favorite_companies, '{}'::text[]),
    p_ai_provider,
    p_ai_model,
    v_encrypted_key
  )
  on conflict (user_id) do update set
    chatgpt_prompt = excluded.chatgpt_prompt,
    blacklisted_companies = excluded.blacklisted_companies,
    favorite_companies = excluded.favorite_companies,
    ai_provider = excluded.ai_provider,
    ai_model = excluded.ai_model,
    ai_api_key_encrypted = coalesce(excluded.ai_api_key_encrypted, advanced_matching.ai_api_key_encrypted);

  -- Return the updated config (without the encrypted key for security)
  select * into v_result
  from public.advanced_matching
  where user_id = v_user_id;

  -- Clear the encrypted key from the result for security
  v_result.ai_api_key_encrypted := null;

  return v_result;
end;
$$;

