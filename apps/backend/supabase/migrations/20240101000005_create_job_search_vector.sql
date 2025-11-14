-- Add full-text search vector to jobs table
-- This migration adds search functionality to the jobs table

-- Add job_search_vector column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'jobs' 
    and column_name = 'job_search_vector'
  ) then
    alter table public.jobs add column job_search_vector tsvector;
  end if;
end $$;

-- Function to update job search vector
create or replace function update_job_search_vector()
returns trigger 
language plpgsql
set search_path = public
as $$
begin
  -- Update the job_search_vector column with weighted tsvector values
  new.job_search_vector := 
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new."companyName", '')), 'B');
  return new;
end;
$$;

-- Create trigger for search vector updates (guarded)
drop trigger if exists trigger_update_job_search_vector on public.jobs;
create trigger trigger_update_job_search_vector
before insert or update of title, "companyName" on jobs
for each row
execute function update_job_search_vector();

-- Backfill existing rows with search vectors (only runs if there are existing rows)
do $$
declare
  batch_size int := 10000;
  min_id int;
  max_id int;
  row_count int;
begin
  -- Check if there are any rows
  select count(*) into row_count from public.jobs;
  
  if row_count > 0 then
    -- Find the range of IDs in the table
    select min(id), max(id) into min_id, max_id from public.jobs;

    -- Process in batches
    while min_id <= max_id loop
      update public.jobs
      set job_search_vector = 
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce("companyName", '')), 'B')
      where id >= min_id and id < min_id + batch_size
        and job_search_vector is null;

      -- Move to the next batch
      min_id := min_id + batch_size;
    end loop;
  end if;
end $$;

