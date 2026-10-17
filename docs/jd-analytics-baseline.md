# JD analytics baseline

Captured from the logged-in Supabase SQL Editor for production project `sjxdeuxixacmasfxuaon` on 2026-10-15. Queries returned aggregate statistics and schema metadata only. No job description text, user emails, API keys, or auth tokens were copied here.

## Data volume

| Metric | Observed value |
|---|---:|
| Jobs | 13,078 |
| Current statuses | New 3,206; Applied 9; Archived 8; Processing 38; System skipped 9,817 |
| Nonempty descriptions | 11,576 |
| Empty descriptions | 1,502 |
| Description bytes (logical) | 53,052,898 (50.6 MiB) |
| Description size, p50 / p95 / max | 4,361 / 8,718 / 20,081 bytes |
| Repeated description hash groups / extra rows | 8 / 10 |
| Raw HTML dumps | 81 rows; 19,642,408 bytes of HTML |
| Oldest / newest HTML dump | 2026-02-12 / 2026-10-15 UTC |
| `jobs` total relation size | 71,057,408 bytes |
| `html_dumps` total relation size | 5,586,944 bytes |
| Whole database size | 90,549,395 bytes |

These measurements are a snapshot, not a growth rate or quota forecast. Postgres may compress large text values; the logical byte count is not the physical storage increment. Only 10 extra rows share existing hashes, so text deduplication has low immediate value. Avoid a second persistent full-text copy.

## Live schema facts

- `public.jobs` includes `description`, `exclude_reason`, `description_hash`, status, labels, and source fields. It has 24 columns in the inspected schema.
- `public.html_dumps` stores full `html` text and `webpage_runtime_data` JSONB.
- `public.workspace_job_events` has `id`, owner/job/actor IDs, actor email, action, old/new status and labels, and timestamp. Actor fields are non-null in the inspected schema. No reason, channel, actor kind, description version, decision reference, or actor snapshot fields exist.
- No user event rows were present at capture time.
- The only inspected `jobs` triggers update the description hash and search vector. There is no status/label history trigger.
- Jobs have owner-only write RLS and member read RLS. Workspace event rows have a workspace-member read policy. There is no event write policy; writes occur through privileged functions.
- Existing job status events are inserted manually in `workspace_update_job_review`. The desktop client also has direct status and bulk-update paths. These can bypass the event function and must be unified before relying on history.
- Existing raw HTML retention spans about eight months. No retention policy was found in the inspected migrations.
- The dashboard migration history lists versions through `20260608000000`; the dashboard also has workspace tables and the `ready` status behavior from later manually applied SQL. Therefore migration history alone does not represent the full live schema. Reconcile schema by object inspection, not version number alone.
- `pgcrypto` is installed in schema `extensions`, so SQL SHA-256 may use `extensions.digest`.

## Known gaps and limits

- `updated_at` cannot identify when a job was applied or archived.
- Current status and `exclude_reason` cannot reconstruct past transitions or the prompt/config that made an old decision.
- Historical versions of a changed description are unavailable unless an existing external backup contains them.
- This baseline was collected while evaluating a larger versioned-analytics design. That design was not retained. The final approach uses existing job rows plus workflow events and does not backfill or copy descriptions; see `jd-analytics-operations.md`.
- The hosted MCP connection returned no projects during this work. Read-only verification used the signed-in dashboard SQL Editor for the project shown above.
