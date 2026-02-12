-- Create Stripe Foreign Data Wrapper setup
-- This migration sets up the Stripe FDW for accessing Stripe data from Postgres
-- Note: Vault secrets must be configured separately in production

-- Enable wrappers extension
create extension if not exists wrappers with schema extensions;

-- Create foreign data wrapper (guarded)
-- Note: Stripe FDW handlers are provided by the wrappers extension
-- If handlers don't exist, this migration will skip FDW creation
-- You can enable Stripe wrapper via Supabase Dashboard → Integrations → Stripe
do $$
declare
  handler_exists boolean;
  validator_exists boolean;
begin
  -- Check if handlers exist (they should be in extensions schema or public)
  select exists (
    select 1 from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname in ('extensions', 'public') 
    and p.proname = 'stripe_fdw_handler'
  ) into handler_exists;
  
  select exists (
    select 1 from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname in ('extensions', 'public') 
    and p.proname = 'stripe_fdw_validator'
  ) into validator_exists;
  
  -- Only create FDW if handlers exist and FDW doesn't already exist
  if handler_exists and validator_exists and not exists (
    select 1 from pg_foreign_data_wrapper where fdwname = 'stripe_wrapper'
  ) then
    -- Create FDW (handlers should be accessible via search_path)
    create foreign data wrapper stripe_wrapper
      handler stripe_fdw_handler
      validator stripe_fdw_validator;
  elsif not (handler_exists and validator_exists) then
    -- Handlers don't exist - skip FDW creation
    -- This is safe - Stripe FDW is optional and can be enabled later via Dashboard
    raise notice 'Stripe FDW handlers not found. Skipping FDW creation. Enable Stripe wrapper via Supabase Dashboard → Integrations → Stripe if needed.';
  end if;
exception when others then
  -- If creation fails for any reason, log and continue
  raise notice 'Could not create Stripe FDW: %. Skipping.', SQLERRM;
end $$;

-- Create Stripe server (guarded)
-- Note: In production, you need to insert the Stripe secret key into vault.secrets first
-- Example (commented out due to permission issues in local dev):
-- insert into vault.secrets (name, secret)
-- values ('stripe_secret_key', 'YOUR_SECRET')
-- returning key_id;

-- Only create server if FDW exists
do $$
begin
  if exists (
    select 1 from pg_foreign_data_wrapper where fdwname = 'stripe_wrapper'
  ) and not exists (
    select 1 from pg_foreign_server where srvname = 'stripe_server'
  ) then
    create server stripe_server
      foreign data wrapper stripe_wrapper
      options (
        api_key_id 'stripe_secret_key',
        api_url 'https://api.stripe.com/v1/'
      );
  end if;
exception when others then
  raise notice 'Could not create Stripe server: %. Skipping.', SQLERRM;
end $$;

-- Create stripe schema if it doesn't exist
create schema if not exists stripe;

-- Create foreign table for Stripe customers (guarded)
-- Only create if server exists
do $$
begin
  if exists (
    select 1 from pg_foreign_server where srvname = 'stripe_server'
  ) then
    drop foreign table if exists stripe.customers;
    create foreign table stripe.customers (
      id text,
      email text,
      name text,
      description text,
      created timestamp,
      attrs jsonb
    )
      server stripe_server
      options (
        object 'customers',
        rowid_column 'id'
      );
  end if;
exception when others then
  raise notice 'Could not create Stripe customers table: %. Skipping.', SQLERRM;
end $$;

-- Create foreign table for Stripe subscriptions (guarded)
-- Only create if server exists
do $$
begin
  if exists (
    select 1 from pg_foreign_server where srvname = 'stripe_server'
  ) then
    drop foreign table if exists stripe.subscriptions;
    create foreign table stripe.subscriptions (
      id text,
      customer text,
      currency text,
      current_period_start timestamp,
      current_period_end timestamp,
      attrs jsonb
    )
      server stripe_server
      options (
        object 'subscriptions',
        rowid_column 'id'
      );
  end if;
exception when others then
  raise notice 'Could not create Stripe subscriptions table: %. Skipping.', SQLERRM;
end $$;

