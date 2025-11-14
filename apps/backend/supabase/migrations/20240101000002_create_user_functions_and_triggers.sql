-- Create functions and triggers for user management
-- This migration sets up automatic profile creation and utility functions

-- Function to get user ID by email (security definer for admin operations)
create or replace function get_user_id_by_email(email text)
returns table (id uuid)
security definer
set search_path = public
language plpgsql
as $$
begin
  return query select au.id from auth.users au where au.email = $1;
end;
$$;

-- Function to automatically create profile for new users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer 
set search_path = public
as $$
begin
  insert into public.profiles (user_id, subscription_tier, subscription_end_date, is_trial)
  values (new.id, 'pro', now() + interval '10 years', false)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Create trigger for new user creation (guarded)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

