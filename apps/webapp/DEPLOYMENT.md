# Web companion operations

## Service layout

The Electron app runs the job scanner. The web app supports the same hosted Supabase workspace for job review. Both apps use the existing hosted project; do not start local Supabase as part of normal operation.

The Oracle VPS runs the First2Fetch web service on `127.0.0.1:3002` behind Cloudflare. Update its existing Compose `web` service in place. Do not start a second container on the same port.

## Local web test

The tested web app runs at `http://localhost:3002` in the `first2fetch-pre-oracle` container. It binds to loopback only and uses the existing ignored `apps/webapp/.env.local` file. Keep that file out of Git. Do not put a Supabase service-role or secret key in the web app.

Build from the repository root:

```sh
docker build -f apps/webapp/Dockerfile -t first2fetch-webapp:local .
```

The Dockerfile builds the shared core package before the Next.js app. It creates a non-root runtime image with a health endpoint at `/api/health`.

## Hosted Supabase

The active project is `First2Fetch` (`sjxdeuxixacmasfxuaon`, `us-east-1`). It is the only project to use for this app. Current source code uses `workspace_list_jobs_v2` for bounded pages; the ten-argument legacy `list_jobs` RPC remains compatible with the older Oracle app until that app is updated.

The following workspace migrations are applied and recorded: `20260608010000`, `20261015075012`, `20261015090000`, `20261015100000`, `20261015193900`, `20261015225259`, `20261017060000` through `20261017063000` (every ten-minute version in that range), and `20261017081442_revoke_public_ai_config_execute`. The latest migration removes the default `PUBLIC`/`anon` execute grant on the AI-config `SECURITY DEFINER` function while retaining authenticated and service-role access. Older recorded versions remain unchanged.

Never run an unchecked `supabase db push` against the production project. Before a schema release, inspect the exact pending migration files and hosted history, confirm compatibility with the current Electron and Oracle clients, run rollback tests, then apply only the reviewed migrations. The CLI's hosted SQL/advisor commands currently fail when they try to modify `cli_login_postgres`; do not grant extra database role privileges to bypass that failure. The read-only advisor review used the documented Supabase Management API route instead.

The `scan-job-description` and `scan-urls` functions were updated and deployed to versions 14 and 18. The invitation function is version 4. Scanner scraping stays paused in Electron during verification. Do not test scraping by starting a real scan unless that is separately requested.

## Authentication and invitations

The current hostname is `apply.pritk.com`. Hosted Auth uses `https://apply.pritk.com`; the exact `/auth/callback` redirect was added while preserving the existing local and Electron redirects. The new-user invite template passes `token_hash` and `type=invite` to the server callback. The Edge Function `WEBAPP_URL` secret uses this hostname. SMTP settings were preserved. DNS resolves through Cloudflare. The owner's signed-in Chrome session reached hosted jobs and remained signed in after reload on 17 October 2026. The user reported that the helper signed in from another browser and could view and change shared jobs. A fresh OTP/callback flow was not independently tested in this release.

The invitation function verifies the caller's session. Existing accounts receive a server-side callback token; new accounts use the hosted invitation template with the server callback token hash. The user confirmed `pritkx@gmail.com`, which is already a member and appears on the live Team page. The live Cloudflare `First2Fetch helper access` Allow policy includes the owner and helper email addresses. No duplicate invitation was sent. Verify the helper's own Cloudflare Access and Supabase login before relying on shared browser access. Test invitation delivery only if a new invitation is needed later.

The owner self-invite check is verified to return “The owner cannot invite itself.” It did not create a new invitation or membership. Regular OTP remains eight digits with email confirmation enabled. No OTP delivery test was run during the latest local/hosted validation.

## GitHub image and Oracle workflow

`.github/workflows/deploy-webapp.yml` runs tests and a production build for pushes to `main`, `codex/web-companion`, and `codex/jd-analytics`. Image publication requires either a manual workflow run with `publish_image=true`, or repository variable `WEBAPP_PUBLISH_ENABLED=true` on `WEBAPP_DEPLOY_BRANCH` (default `main`). Oracle deployment additionally requires `ORACLE_DEPLOY_ENABLED=true` and the same branch gate. GitHub Actions run [39016455000](https://github.com/i0x1/First2Fetch/actions/runs/39016455000) passed the web test and production-build job for commit `0e985c68`; the image and deploy jobs were skipped.

The automated deployment job requires GitHub secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, and `VPS_KNOWN_HOSTS`; `VPS_SSH_PORT` and `VPS_APP_DIR` are optional. `VPS_KNOWN_HOSTS` is still missing, and GitHub runner access to the Tailscale host has not been verified. Do not enable automated deployment until both are resolved.

### Production web release on 17 October 2026

- GitHub Actions run [39093617205](https://github.com/i0x1/First2Fetch/actions/runs/39093617205) passed tests, build, and multi-architecture image publication for `acfc369`. Its gated deploy job was skipped.
- The same web source was built locally as ARM64 `first2fetch-webapp:release-acfc369`, transferred to the Oracle host, and installed in the existing Compose `web` service. No database migration or scanner change was part of this web release.
- The prior image `first2fetch-webapp:codex-web-companion` remains on the host. The prior `.env` and Compose file are in the private `rollback-20261018T032635Z` directory. The deployment script now updates both `.env` and `.deployed-image` after health passes, so a later Compose restart retains the released image.
- Docker reported the new container healthy; the origin `/api/health` returned HTTP 200. The owner's authenticated Chrome session at `https://apply.pritk.com/jobs/new` showed the new sidebar, Ready/Skipped tabs, filters, Table/Split/Detail views, job rows, and Team membership. No browser console errors were observed. No real job state was changed during release verification.
- The published GHCR package denied both anonymous and temporary user-token pulls from the host. The host currently uses the transferred local image. Resolve registry access before relying on GHCR-based automated redeployment.

The script `apps/webapp/scripts/deploy.sh` requires the existing remote `.env` and `docker-compose.yml`, validates Compose configuration, pulls a commit-pinned image, waits for health, and restores the previous image tag if the new container fails health checks. It was syntax-checked but has not been run on Oracle.

Before the next automated Oracle release:

1. Resolve the GHCR package read access, add the SSH known-host secret, and verify GitHub runner access to the Tailscale host.
2. Confirm a restorable hosted database and VPS backup path before any schema or infrastructure migration.
3. Use an approved branch and release gate, then verify `/api/health`, login, shared jobs, invitation acceptance, and rollback.

The CSV analysis exports are not a database backup. Supabase reported no managed backups in the checked project and PITR was disabled; arrange a verified backup and restore path before production schema or infrastructure changes.
