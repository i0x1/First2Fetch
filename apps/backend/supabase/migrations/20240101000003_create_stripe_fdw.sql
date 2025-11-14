-- Create Stripe Foreign Data Wrapper setup
-- This migration sets up the Stripe FDW for accessing Stripe data from Postgres
-- Note: Vault secrets must be configured separately in production

-- Enable wrappers extension
create extension if not exists wrappers with schema extensions;

-- Create foreign data wrapper (guarded)
do $$
begin
  if not exists (
    select 1 from pg_foreign_data_wrapper where fdwname = 'stripe_wrapper'
  ) then
    create foreign data wrapper stripe_wrapper
      handler stripe_fdw_handler
      validator stripe_fdw_validator;
  end if;
end $$;

-- Create Stripe server (guarded)
-- Note: In production, you need to insert the Stripe secret key into vault.secrets first
-- Example (commented out due to permission issues in local dev):
-- insert into vault.secrets (name, secret)
-- values ('stripe_secret_key', 'YOUR_SECRET')
-- returning key_id;

do $$
begin
  if not exists (
    select 1 from pg_foreign_server where srvname = 'stripe_server'
  ) then
    create server stripe_server
      foreign data wrapper stripe_wrapper
      options (
        api_key_id 'stripe_secret_key',
        api_url 'https://api.stripe.com/v1/'
      );
  end if;
end $$;

-- Create stripe schema if it doesn't exist
create schema if not exists stripe;

-- Create foreign table for Stripe customers (guarded)
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

-- Create foreign table for Stripe subscriptions (guarded)
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

