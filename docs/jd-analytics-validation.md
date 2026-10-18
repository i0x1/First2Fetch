# Hosted job data and app validation

Date: 2026-10-17 (America/Los_Angeles)
Branch: `codex/jd-analytics`
Scope: current working-copy changes and the existing hosted Supabase project. No Oracle deployment.

## Database and migration checks

- Hosted project: `First2Fetch`, ref `sjxdeuxixacmasfxuaon`, region `us-east-1`.
- Final aggregate query returned 13,078 jobs: New 3,206; Ready 0; Applied 9; Archived 8; Processing 38; system-skipped 9,817. `workspace_job_events` had zero rows before the owner self-invite rejection check.
- All expected migration versions were present, including the previously reconciled workspace migrations and versions through `20261017063000`.
- The rollback-only hosted regression SQL passed. It checked owner/helper updates and attribution, outsider rejection, invalid reasons, scanner retry guards, description preservation, 120 temporary Ready rows with stable bounded paging, old-client full-description compatibility, and no extra analytics copy tables. The transaction rolled back; no fixture jobs or status changes were committed.
- Read-only access audit confirmed RLS is enabled on `jobs`, `workspace_job_events`, `workspace_memberships`, and `workspace_invitations`. The reviewed workspace RPCs deny anonymous execution and allow authenticated calls. The functions use `SECURITY DEFINER`; their owner, membership, scanner, and job-access guards were covered by the transaction tests.
- Current job and event CSVs parse correctly with a CSV parser. The job file has 13,078 rows, 26 columns, unique non-empty `job_id` values, and 11,531 descriptions containing newlines. The event file has 15 columns and zero rows.
- The export files and schema snapshots are private, ignored artifacts. The exports are not a database backup.

## Edge functions

After deployment and a read-only CLI listing, the affected functions are ACTIVE:

| Function | Version | JWT check |
| --- | ---: | --- |
| `scan-job-description` | 14 | disabled, as before |
| `scan-urls` | 18 | disabled, as before |
| `invite-workspace-member` | 4 | enabled |

Deno checks passed for all three functions from the backend Functions workspace. Electron’s scraping setting remains paused. No real scan was started.

## Automated local checks

- Web tests: 2 passed.
- Web TypeScript check: passed after rebuilding the shared `@first2apply/core` declarations.
- Electron TypeScript build: passed.
- Electron tests: 34 passed across 11 files.
- Deno checks for both scanner functions and the invitation function: passed.
- Next.js production build: passed. The standard Next.js ESLint plugin notice appeared during one build; the unused parameter warning found in that run was removed, and the final Docker build passed without it.
- Final Docker image built from the current source. It runs as `node`, reports healthy, and `/api/health` returned HTTP 200.
- The Supabase CLI advisor command still cannot create its temporary `cli_login_postgres` role, and the connector reports `Unknown tool`. The documented Supabase Management API advisor endpoints did run. Before the grant fix, Security Advisor reported 14 warnings, including a `PUBLIC` execute grant on `update_advanced_matching_with_ai_config`. A migration removed `PUBLIC` and `anon` execute while preserving `authenticated` and `service_role`; read-only checks confirmed those grants. The follow-up Security Advisor has 13 warnings: 12 authenticated `SECURITY DEFINER` workspace/config RPCs and the recommendation to enable leaked-password protection. No other function grants were changed.
- Performance Advisor reports 20 findings: 9 multiple-permissive-policy warnings on `jobs`, `links`, and `workspace_memberships`; 3 informational unindexed foreign keys; and 8 informational unused indexes. These need a separate policy/index review. No speculative policy or index changes were made.

## Live authenticated web checks

Used the existing owner session in the in-app browser against `http://localhost:3002`, connected to hosted Supabase:

- New loaded 50 jobs; “Load 50 more” loaded 100.
- The selected job description loaded and displayed.
- A no-match search showed the empty result while keeping the board controls.
- Table, Split, and Detail modes all responded. Returned to Table.
- Applied showed 9 rows; Archived showed 8 rows.
- Empty Ready showed the status/search/view toolbar and empty message.
- Row and detail Delete controls were disabled with the archive guidance. The bulk Delete button was also disabled.
- The Team page displayed the existing helper. An owner self-invite returned the expected “The owner cannot invite itself” message. It did not add a member or send an invitation.
- The owner session remained active after reload. Browser returned to New with 50 jobs loaded.
- Viewport test used 1280 px width; body content width was 1265 px, so there was no horizontal page overflow at that size.
- No job row or status was changed during the live checks.

## Electron status

The Electron app remains running from the working copy, signed into the hosted project, with scraping paused. Previous checks covered New, Ready, Applied, Archived, job descriptions, and Table/Split/Detail without renderer exceptions. The latest changes in this continuation were limited to the web companion, documentation, and deployed scanner functions. Electron was not restarted, and a fresh Electron UI pass after these latest changes is not needed to validate the web-only patch; the earlier Electron read-only checks remain the evidence for its UI state. The app is left open for manual use.

## Open items before Oracle deployment

1. The current confirmed hostname is `apply.pritk.com`. Hosted Auth uses `https://apply.pritk.com` as its site URL, with the exact `/auth/callback` redirect allowed. Existing Electron and local redirects and SMTP settings were preserved. The invitation template passes `token_hash` to the server callback, and the Edge Function `WEBAPP_URL` secret uses this hostname. DNS resolves through Cloudflare. On 17 October, the owner's existing signed-in Chrome session reached `/jobs/new` through Cloudflare Access, loaded hosted jobs, and stayed signed in after a Team-page reload. A fresh OTP and callback flow has not been tested.
2. The user confirmed `pritkx@gmail.com` as the helper address. The existing helper membership is already accepted. No duplicate invitation was sent.
3. The live Cloudflare `First2Fetch helper access` policy is an Allow policy with exact email include entries for the owner and `pritkx@gmail.com`. The owner Team page lists the helper as a member. Test the helper's own Cloudflare Access and Supabase login at `https://apply.pritk.com`, then confirm shared jobs and activity in that session. Policy and membership checks do not prove that the helper can complete login. No fresh invitation is needed for the existing member. Eight-digit OTP delivery and callback acceptance remain unverified in a new login.
4. Review whether to enable Auth leaked-password protection. The advisor recommends it; it was not changed because it can affect password creation and change flows.
5. Arrange a verified full hosted backup and restore path. The checked project reported no managed backup and PITR disabled. CSV exports do not provide database restore coverage.
6. The reviewed work is committed and pushed to `origin/codex/jd-analytics` at `67296da`. GitHub Actions run [39016700609](https://github.com/i0x1/First2Fetch/actions/runs/39016700609) passed the web tests and production build with the new privilege migration. Image publication and Oracle deployment were skipped by their separate gates.
7. Before enabling deployment, add and verify the missing `VPS_KNOWN_HOSTS` repository secret, check runner connectivity to the Oracle host, and confirm the existing remote Compose service and rollback image. The required host, user, SSH key, and app-directory values are already stored as repository secrets; their values were not read or printed.
8. The user must complete a manual test of the local Electron and web apps before Oracle migration.

The Oracle VPS was only inspected earlier in the task. No Oracle files, containers, secrets, Cloudflare settings, or GitHub deployment variables were changed. Deployment is not enabled and this work does not claim Oracle readiness.
