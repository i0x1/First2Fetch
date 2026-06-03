-- Add lightweight future-analysis helpers to jobs.
-- The trigger keeps scan code unchanged and avoids a generated-column table rewrite.

alter table public.jobs
add column if not exists description_hash text;

comment on column public.jobs.description_hash is
  'MD5 fingerprint of jobs.description used to skip duplicate or unchanged descriptions during future analysis.';

create or replace function public.update_job_description_hash()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.description_hash :=
    case
      when new.description is null then null
      else md5(new.description)
    end;
  return new;
end;
$$;

drop trigger if exists trigger_update_job_description_hash on public.jobs;
create trigger trigger_update_job_description_hash
before insert or update of description on public.jobs
for each row
execute function public.update_job_description_hash();

create index if not exists idx_jobs_user_id_description_hash
on public.jobs(user_id, description_hash)
where description_hash is not null;

create index if not exists idx_jobs_tags
on public.jobs using gin(tags)
where tags <> '{}'::text[];
