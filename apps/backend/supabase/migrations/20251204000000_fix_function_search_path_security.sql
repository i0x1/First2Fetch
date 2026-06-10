-- Fix function search_path security warnings
-- Set search_path to empty string to prevent search path injection attacks
-- All functions must explicitly qualify schema names when search_path is empty

-- Fix get_user_id_by_email
create or replace function get_user_id_by_email(email text)
returns table (id uuid)
security definer
set search_path = ''
language plpgsql
as $$
begin
  return query select au.id from auth.users au where au.email = $1;
end;
$$;

-- Fix handle_new_user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer 
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, subscription_tier, subscription_end_date, is_trial)
  values (new.id, 'pro', now() + interval '10 years', false)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Fix encrypt_api_key
create or replace function encrypt_api_key(api_key text, user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  encryption_secret text;
  salt text;
  key_hash text;
  api_key_encoded text;
begin
  -- Get encryption secret from database setting or use a default (for development)
  encryption_secret := coalesce(
    current_setting('app.encryption_secret', true),
    'default-dev-secret-change-in-production-2024'
  );
  
  -- Create a deterministic salt from user_id (first 22 chars for bcrypt compatibility)
  salt := substring(replace(user_id::text, '-', ''), 1, 22);
  
  -- Create a hash of the encryption key material
  key_hash := md5(user_id::text || encryption_secret);
  
  -- Simple but effective encoding: base64(api_key + verification_hash)
  -- This provides obfuscation and integrity checking without relying on pgcrypto encrypt
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

-- Fix decrypt_api_key
create or replace function decrypt_api_key(encrypted_key text, user_id uuid)
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
  -- Get encryption secret from database setting
  encryption_secret := coalesce(
    current_setting('app.encryption_secret', true),
    'default-dev-secret-change-in-production-2024'
  );
  
  -- Create the same hash as during encryption
  key_hash := md5(user_id::text || encryption_secret);
  expected_suffix := '::' || substring(key_hash, 1, 16);
  
  -- Parse version and data
  version_prefix := split_part(encrypted_key, ':', 1);
  encoded_data := substring(encrypted_key from length(version_prefix) + 2);
  
  if version_prefix != 'enc_v1' then
    raise exception 'Unsupported encryption version: %', version_prefix;
  end if;
  
  -- Decode the base64 data
  decoded_data := convert_from(decode(encoded_data, 'base64'), 'UTF8');
  
  -- Verify the suffix matches (integrity check)
  if decoded_data like '%' || expected_suffix then
    -- Extract the original API key
    return substring(decoded_data from 1 for length(decoded_data) - length(expected_suffix));
  else
    raise exception 'Invalid encrypted key format or corrupted data';
  end if;
exception
  when others then
    raise exception 'Failed to decrypt API key: %', sqlerrm;
end;
$$;

-- Fix count_chatgpt_usage
create or replace function count_chatgpt_usage(
  for_user_id uuid, 
  cost_increment numeric, 
  input_tokens_increment integer, 
  output_tokens_increment integer
) 
returns void 
language plpgsql 
security definer
set search_path = ''
as $$
begin
  update public.advanced_matching
  set 
    ai_api_cost = ai_api_cost + cost_increment, 
    ai_api_input_tokens_used = ai_api_input_tokens_used + input_tokens_increment, 
    ai_api_output_tokens_used = ai_api_output_tokens_used + output_tokens_increment
  where user_id = for_user_id;
end;
$$;

-- Fix update_job_search_vector
create or replace function update_job_search_vector()
returns trigger 
language plpgsql
set search_path = ''
as $$
begin
  -- Update the job_search_vector column with weighted tsvector values
  new.job_search_vector := 
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new."companyName", '')), 'B');
  return new;
end;
$$;

-- Fix count_jobs (older version with jobs_status parameter)
create or replace function public.count_jobs(
    jobs_status "Job Status" default null, 
    jobs_search text default null,
    jobs_site_ids integer[] default null,
    jobs_link_ids integer[] default null,
    jobs_labels text[] default null
)
returns table(status "Job Status", job_count bigint) 
language plpgsql
set search_path = ''
as $$
begin
  return query
  select j.status, count(*) as job_count
  from public.jobs j
  where (jobs_status is null or j.status = jobs_status)
    and (array_length(jobs_site_ids, 1) is null or j."siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or j.link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or j.labels && jobs_labels)
    and (jobs_search is null or j.job_search_vector @@ plainto_tsquery('english', jobs_search))
  group by j.status
  order by j.status;
end;
$$;

-- Fix count_jobs (latest version with hide_reposted)
create or replace function public.count_jobs(
    jobs_search text default null,
    jobs_site_ids integer[] default null,
    jobs_link_ids integer[] default null,
    jobs_labels text[] default null,
    hide_reposted boolean default false
)
returns table(status "Job Status", job_count bigint) 
language plpgsql
set search_path = ''
as $$
begin
  return query
  select j.status, count(*) as job_count
  from public.jobs j
  where (array_length(jobs_site_ids, 1) is null or j."siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or j.link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or j.labels && jobs_labels)
    and (jobs_search is null or j.job_search_vector @@ plainto_tsquery('english', jobs_search))
    and (not hide_reposted or j.is_repost = false or j.is_repost is null)
  group by j.status
  order by j.status;
end;
$$;

-- Fix log_ai_usage
create or replace function log_ai_usage(
  for_user_id uuid, 
  cost_increment numeric, 
  input_tokens_increment bigint, 
  output_tokens_increment bigint
) 
returns void 
language plpgsql
set search_path = ''
as $$
begin
  insert into public.ai_usage_daily (user_id, usage_date, cost, input_tokens, output_tokens)
  values (for_user_id, current_date, cost_increment, input_tokens_increment, output_tokens_increment)
  on conflict (user_id, usage_date)
  do update set
    cost = public.ai_usage_daily.cost + excluded.cost,
    input_tokens = public.ai_usage_daily.input_tokens + excluded.input_tokens,
    output_tokens = public.ai_usage_daily.output_tokens + excluded.output_tokens,
    updated_at = now();
end;
$$;

-- Fix get_job_dates_summary (older version without timezone)
create or replace function get_job_dates_summary(
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
security definer
as $$
declare
  favorite_companies_lower text[] := ARRAY[]::text[];
begin
  -- Get favorite companies for the current user
  select coalesce(array_agg(lower(fc)), ARRAY[]::text[]) into favorite_companies_lower
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
  where j.status = jobs_status
    and (array_length(jobs_site_ids, 1) is null or j."siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or j.link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or j.labels && jobs_labels)
    and (jobs_search is null or j.job_search_vector @@ plainto_tsquery('english', jobs_search))
    and (not hide_reposted or j.is_repost = false or j.is_repost is null)
  group by j.created_at::date
  order by j.created_at::date desc;
end;
$$;

-- Fix get_job_dates_summary (latest version with timezone support)
create or replace function get_job_dates_summary(
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
security definer
as $$
declare
  favorite_companies_lower text[] := ARRAY[]::text[];
begin
  -- Validate and set default timezone
  if timezone_name is null or timezone_name = '' then
    timezone_name := 'UTC';
  end if;

  -- Get favorite companies for the current user
  select coalesce(array_agg(lower(fc)), ARRAY[]::text[]) into favorite_companies_lower
  from (
    select unnest(am.favorite_companies) as fc
    from public.advanced_matching am
    where am.user_id = auth.uid()
  ) favorite_values;

  return query
  select 
    -- Convert timestamp to local timezone, then extract date
    -- Use timezone() function which correctly converts timestamp with time zone to specified timezone
    (timezone(timezone_name, j.created_at))::date as date_key,
    count(*) as total_count,
    count(*) filter (
      where array_length(favorite_companies_lower, 1) > 0
        and lower(j."companyName") = any(favorite_companies_lower)
    ) as favorite_count
  from public.jobs j
  where j.status = jobs_status
    and (array_length(jobs_site_ids, 1) is null or j."siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or j.link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or j.labels && jobs_labels)
    and (jobs_search is null or j.job_search_vector @@ plainto_tsquery('english', jobs_search))
    and (not hide_reposted or j.is_repost = false or j.is_repost is null)
  group by (timezone(timezone_name, j.created_at))::date
  order by (timezone(timezone_name, j.created_at))::date desc;
end;
$$;

-- Fix update_advanced_matching_with_ai_config (latest version with watched_companies)
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

  -- Encrypt API key if provided
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

-- Fix list_jobs (latest version with timezone support)
create or replace function public.list_jobs(
    jobs_status "Job Status",
    jobs_after text,
    jobs_page_size integer,
    jobs_search text default null,
    jobs_site_ids integer[] default null,
    jobs_link_ids integer[] default null,
    jobs_labels text[] default null,
    hide_reposted boolean default false,
    date_filter date default null,
    timezone_name text default 'UTC'
)
returns setof public.jobs
language plpgsql
set search_path = ''
as $$
declare
  after_id integer;
  after_created_at timestamp;
  favorite_companies_lower text[] := ARRAY[]::text[];
  date_filter_start timestamp with time zone;
  date_filter_end timestamp with time zone;
begin
  -- Validate timezone
  if timezone_name is null or timezone_name = '' then
    timezone_name := 'UTC';
  end if;

  if jobs_after is not null then
    after_id := split_part(jobs_after, '!', 1)::integer;
    after_created_at := split_part(jobs_after, '!', 2)::timestamp;
  end if;

  -- Convert local date filter to UTC timestamp range
  if date_filter is not null then
    -- Create timestamp at midnight in the local timezone, then convert to UTC
    -- make_timestamp creates timestamp without timezone, AT TIME ZONE treats it as local timezone and converts to UTC
    date_filter_start := make_timestamp(
      extract(year from date_filter)::int,
      extract(month from date_filter)::int,
      extract(day from date_filter)::int,
      0, 0, 0
    ) AT TIME ZONE timezone_name;
    
    -- End of day (start of next day) in local timezone, converted to UTC
    date_filter_end := make_timestamp(
      extract(year from date_filter + interval '1 day')::int,
      extract(month from date_filter + interval '1 day')::int,
      extract(day from date_filter + interval '1 day')::int,
      0, 0, 0
    ) AT TIME ZONE timezone_name;
  end if;

  -- Get favorite companies for the current user
  select coalesce(array_agg(lower(fc)), ARRAY[]::text[]) into favorite_companies_lower
  from (
    select unnest(am.favorite_companies) as fc
    from public.advanced_matching am
    where am.user_id = auth.uid()
  ) favorite_values;

  return query
  select *
  from public.jobs
  where status = jobs_status
    and (date_filter is null or (created_at >= date_filter_start and created_at < date_filter_end))
    and (jobs_after is null or (created_at, id) < (after_created_at, after_id))
    and (array_length(jobs_site_ids, 1) is null or "siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or labels && jobs_labels)
    and (jobs_search is null or job_search_vector @@ plainto_tsquery('english', jobs_search))
    and (not hide_reposted or is_repost = false or is_repost is null)
  order by 
    -- 1. Sort by LOCAL date (day) descending - newest dates first
    -- Use timezone() function for correct conversion
    (timezone(timezone_name, created_at))::date desc,
    -- 2. Within each date, favorites come first
    (case
      when array_length(favorite_companies_lower, 1) > 0
        then coalesce(lower("companyName") = any(favorite_companies_lower), false)
      else false
    end) desc,
    -- 3. Within each category, sort by exact time descending (newest first)
    created_at desc,
    id desc
  limit jobs_page_size;
end;
$$;

