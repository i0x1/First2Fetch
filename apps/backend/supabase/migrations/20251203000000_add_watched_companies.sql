-- Add watched_companies support to advanced_matching
-- Watched companies are highlighted but don't affect sorting (unlike favorite_companies)
-- Companies can be in either watched_companies OR favorite_companies, but not both

do $$
begin
  -- Only add column if table exists AND column doesn't exist
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'advanced_matching'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'advanced_matching'
      and column_name = 'watched_companies'
  ) then
    alter table public.advanced_matching
      add column watched_companies text[] not null default '{}'::text[];
  end if;

  -- Ensure existing rows have default value (safe to run multiple times)
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'advanced_matching'
      and column_name = 'watched_companies'
  ) then
    update public.advanced_matching
    set watched_companies = coalesce(watched_companies, '{}'::text[])
    where watched_companies is null;
  end if;
end;
$$;

-- Update the update_advanced_matching_with_ai_config function to include watched_companies
create or replace function public.update_advanced_matching_with_ai_config(
  p_chatgpt_prompt text,
  p_blacklisted_companies text[],
  p_favorite_companies text[] default null,
  p_watched_companies text[] default null,
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
    watched_companies = coalesce(excluded.watched_companies, advanced_matching.watched_companies),
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

