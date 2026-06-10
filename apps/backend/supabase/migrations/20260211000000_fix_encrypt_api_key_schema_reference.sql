-- Fix schema reference for encrypt_api_key function call
-- The update_advanced_matching_with_ai_config function has set search_path = ''
-- so it needs to explicitly reference public.encrypt_api_key

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
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_encrypted_key text;
  v_result public.advanced_matching;
begin
  -- Get current user ID
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'User must be authenticated';
  end if;

  -- Encrypt API key if provided (with schema qualification)
  if p_ai_api_key is not null and p_ai_api_key != '' then
    v_encrypted_key := public.encrypt_api_key(p_ai_api_key, v_user_id);
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
    watched_companies = coalesce(excluded.watched_companies, public.advanced_matching.watched_companies),
    ai_provider = excluded.ai_provider,
    ai_model = excluded.ai_model,
    ai_api_key_encrypted = coalesce(excluded.ai_api_key_encrypted, public.advanced_matching.ai_api_key_encrypted);

  -- Return the updated config (without the encrypted key for security)
  select * into v_result
  from public.advanced_matching
  where user_id = v_user_id;

  -- Clear the encrypted key from the result for security
  v_result.ai_api_key_encrypted := null;

  return v_result;
end;
$$;
