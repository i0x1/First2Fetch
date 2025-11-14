-- Create AI usage daily tracking table and view
-- This migration adds daily usage tracking for AI API calls

-- Create ai_usage_daily table
create table if not exists public.ai_usage_daily (
  user_id uuid not null,
  usage_date date not null default CURRENT_DATE,
  cost numeric not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  updated_at timestamp with time zone not null default now(),
  constraint ai_usage_daily_pkey primary key (user_id, usage_date),
  constraint ai_usage_daily_user_id_fkey foreign key (user_id) references auth.users (id) on delete RESTRICT
) tablespace pg_default;

-- Enable RLS on ai_usage_daily
alter table if exists public.ai_usage_daily enable row level security;

-- Drop existing policy if it exists
drop policy if exists "enable all for users based on user_id" on public.ai_usage_daily;

-- Create RLS policy for ai_usage_daily
create policy "enable all for users based on user_id" 
on public.ai_usage_daily 
as permissive 
for all 
to authenticated 
using ((select auth.uid()) = user_id) 
with check ((select auth.uid()) = user_id);

-- Create view for last 30 days usage (guarded)
-- Note: View is created with security_invoker to respect RLS policies from underlying table
-- This ensures the view runs with the querying user's permissions, not the view creator's
drop view if exists public.v_ai_usage_last_30d;
create view public.v_ai_usage_last_30d
with (security_invoker = on)
as
select
  d.user_id,
  COALESCE(sum(d.cost), 0::numeric) as cost_last_30d,
  COALESCE(sum(d.input_tokens), 0::numeric)::bigint as input_tokens_last_30d,
  COALESCE(sum(d.output_tokens), 0::numeric)::bigint as output_tokens_last_30d
from
  ai_usage_daily d
where
  d.usage_date >= (CURRENT_DATE - '30 days'::interval)
group by
  d.user_id;

-- Note: The security_invoker setting ensures:
-- 1. The view respects RLS policies from the underlying ai_usage_daily table
-- 2. Users can only see their own data (enforced by the table's RLS policy)
-- 3. The view runs with the querying user's permissions, not the postgres superuser's

-- Function to log AI usage
create or replace function log_ai_usage(
  for_user_id uuid, 
  cost_increment numeric, 
  input_tokens_increment bigint, 
  output_tokens_increment bigint
) 
returns void 
language plpgsql
set search_path = public
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

