# Job analysis data and export

## Data model

- `public.jobs` is the source of truth for each job. It stores the current status (`new`, `ready`, `applied`, `archived`, or system-skipped), reason, source, search, dates, URL, and job description.
- `public.workspace_job_events` stores compact workflow history: actor, action, app channel, and reason. It does not copy the job description.
- Do not add description copies, versions, extracted-skill tables, decision snapshots, or queues. The source job and small event rows are sufficient for occasional analysis.
- Historical actors and action dates are available only for changes made after the audit trigger was installed. Current status does not reconstruct older actions.

## Export for analysis

For infrequent analysis, use the SQL queries in `docs/jd-analytics-export.sql` in the hosted Supabase SQL Editor. Export the first result to CSV for one row per job. Export the event result separately if attribution is needed. Join the files by `job_id` after export; joining before export can duplicate job rows.

The 2026-10-16 hosted export contained 13,078 unique job IDs in a 65,295,968-byte CSV. The event export had a header and zero rows at that time. These are private analysis exports, not a full database backup. Re-export when current data is needed.

Keep separate real job rows even when two descriptions match. The records can represent different openings.

## Current hosted state

The application uses one hosted Supabase project: `First2Fetch` (`sjxdeuxixacmasfxuaon`). No duplicate analytics tables or description backfills were added. The production schema migrations and function versions are recorded in `apps/webapp/DEPLOYMENT.md` and `docs/jd-analytics-validation.md`.

The hosted job count was 13,078 at the last check: 3,206 New, 0 Ready, 9 Applied, 8 Archived, 38 Processing, and 9,817 system-skipped. The latest verification used rollback-only fixture tests. It did not change real job statuses or add persistent fixture rows.

## Backup and restore limits

No complete hosted database backup or restore test is verified. The analysis CSVs do not include all database state, auth users, or configuration. The Supabase backup-status check returned no managed backups and PITR disabled. Arrange and verify a full backup and restore path before production deployment or schema changes.

A local custom-format dump and isolated restore were tested earlier against the local self-hosted Supabase database. That local database is not the hosted production backup and must not be treated as one. Do not run `supabase db reset` against a persistent database.
