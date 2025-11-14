-- Enable Row Level Security and create policies for all tables
-- This migration sets up RLS policies to ensure users can only access their own data

-- Enable RLS on all tables
alter table if exists public.sites enable row level security;
alter table if exists public.jobs enable row level security;
alter table if exists public.links enable row level security;
alter table if exists public.reviews enable row level security;
alter table if exists public.html_dumps enable row level security;
alter table if exists public.notes enable row level security;
alter table if exists public.profiles enable row level security;

-- Drop existing policies if they exist (for idempotency)
drop policy if exists "enable select for authenticated users only" on public.sites;
drop policy if exists "enable all for users based on user_id" on public.links;
drop policy if exists "enable all for users based on user_id" on public.jobs;
drop policy if exists "enable insert reviews for authenticated users only" on public.reviews;
drop policy if exists "enable update reviews for authenticated users only" on public.reviews;
drop policy if exists "enable select reviews for authenticated users only" on public.reviews;
drop policy if exists "enable all for users based on user_id" on public.html_dumps;
drop policy if exists "enable all for users based on user_id" on public.notes;
drop policy if exists "enable select profiles for authenticated users only" on public.profiles;

-- Sites: Allow all authenticated users to read
create policy "enable select for authenticated users only" 
on public.sites 
as permissive 
for select 
to authenticated 
using (true);

-- Links: Users can only access their own links
create policy "enable all for users based on user_id" 
on public.links 
as permissive 
for all 
to authenticated 
using ((select auth.uid()) = user_id) 
with check ((select auth.uid()) = user_id);

-- Jobs: Users can only access their own jobs
create policy "enable all for users based on user_id" 
on public.jobs 
as permissive 
for all 
to authenticated 
using ((select auth.uid()) = user_id) 
with check ((select auth.uid()) = user_id);

-- Reviews: Users can insert, update, and select their own reviews
create policy "enable insert reviews for authenticated users only" 
on public.reviews 
as permissive 
for insert 
to authenticated 
with check ((select auth.uid()) = user_id);

create policy "enable update reviews for authenticated users only"
on public.reviews
as permissive
for update
to authenticated
using ((select auth.uid()) = user_id);

create policy "enable select reviews for authenticated users only" 
on public.reviews 
as permissive 
for select 
to authenticated 
using ((select auth.uid()) = user_id);

-- HTML Dumps: Users can only access their own dumps
create policy "enable all for users based on user_id" 
on public.html_dumps 
as permissive 
for all 
to authenticated 
using ((select auth.uid()) = user_id) 
with check ((select auth.uid()) = user_id);

-- Notes: Users can only access their own notes
create policy "enable all for users based on user_id" 
on public.notes 
as permissive 
for all 
to authenticated 
using ((select auth.uid()) = user_id) 
with check ((select auth.uid()) = user_id);

-- Profiles: Users can only select their own profile
create policy "enable select profiles for authenticated users only" 
on public.profiles 
as permissive 
for select 
to authenticated 
using ((select auth.uid()) = user_id);

