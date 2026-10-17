# Web companion operations

## Service layout

The Electron app runs the job scanner. The web app supports the same hosted Supabase workspace for job review. Both apps use the existing hosted project; do not start local Supabase as part of normal operation.

The Oracle VPS already runs a First2Fetch web service on `127.0.0.1:3002` behind the existing Cloudflare setup. A future release must update that Compose service in place. Do not start a second container on the same port.

## Local web test

The tested web app runs at `http://localhost:3002` in the `first2fetch-pre-oracle` container. It binds to loopback only and uses the existing ignored `apps/webapp/.env.local` file. Keep that file out of Git. Do not put a Supabase service-role or secret key in the web app.

Build from the repository root:

```sh
docker build -f apps/webapp/Dockerfile -t first2fetch-webapp:local .
```

The Dockerfile builds the shared core package before the Next.js app. It creates a non-root runtime image with a health endpoint at `/api/health`.

## Hosted Supabase

The active project is `First2Fetch` (`sjxdeuxixacmasfxuaon`, `us-east-1`). It is the only project to use for this app. Current source code uses `workspace_list_jobs_v2` for bounded pages; the ten-argument legacy `list_jobs` RPC remains compatible with the older Oracle app until that app is updated.

The following workspace migrations are applied and recorded: `20260608010000`, `20261015075012`, `20261015090000`, `20261015100000`, `20261015193900`, `20261015225259`, and `20261017060000` through `20261017063000` (every ten-minute version in that range). Older recorded versions remain unchanged.

Never run an unchecked `supabase db push` against the production project. Before a schema release, inspect the exact pending migration files and hosted history, confirm compatibility with the current Electron and Oracle clients, run rollback tests, then apply only the reviewed migrations. The CLI's hosted SQL/advisor commands currently fail when they try to modify `cli_login_postgres`; do not grant extra database role privileges to bypass that failure.

The `scan-job-description` and `scan-urls` functions were updated and deployed to versions 14 and 18. The invitation function is version 4. Scanner scraping stays paused in Electron during verification. Do not test scraping by starting a real scan unless that is separately requested.

## Authentication and invitations

The user confirmed `first2fetch.pritk.com`. Hosted Auth uses `https://first2fetch.pritk.com`; the exact `/auth/callback` redirect was added while preserving the existing local and Electron redirects. The new-user invite template now passes `token_hash` and `type=invite` to the server callback. The Edge Function `WEBAPP_URL` secret is set to the confirmed hostname. SMTP settings were preserved. DNS currently does not resolve this hostname, so do not send invitations or expect public login to work until DNS and HTTPS are live.

The invitation function verifies the caller's session. Existing accounts receive a server-side callback token; new accounts use the hosted invitation template with the server callback token hash. The user confirmed `pritkx@gmail.com`, which is already an accepted member. No duplicate invitation was sent. Test invitation delivery only after `first2fetch.pritk.com` resolves and serves the app.

The owner self-invite check is verified to return “The owner cannot invite itself.” It did not create a new invitation or membership. Regular OTP remains eight digits with email confirmation enabled. No OTP delivery test was run during the latest local/hosted validation.

## GitHub image and Oracle workflow

`.github/workflows/deploy-webapp.yml` runs tests and a production build for pushes to `main`, `codex/web-companion`, and `codex/jd-analytics`. Image publication requires either a manual workflow run with `publish_image=true`, or repository variable `WEBAPP_PUBLISH_ENABLED=true` on `WEBAPP_DEPLOY_BRANCH` (default `main`). Oracle deployment additionally requires `ORACLE_DEPLOY_ENABLED=true` and the same branch gate. GitHub Actions run [39016455000](https://github.com/i0x1/First2Fetch/actions/runs/39016455000) passed the web test and production-build job for commit `0e985c68`; the image and deploy jobs were skipped.

The deployment job requires GitHub secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, and `VPS_KNOWN_HOSTS`; `VPS_SSH_PORT` and `VPS_APP_DIR` are optional. The first three required values and `VPS_APP_DIR` are already stored as repository secrets. `VPS_KNOWN_HOSTS` is missing. Secret values were not read or printed. Add and verify `VPS_KNOWN_HOSTS`, then check runner network reachability before enabling anything. No Oracle deployment was run for this validation.

The script `apps/webapp/scripts/deploy.sh` requires the existing remote `.env` and `docker-compose.yml`, validates Compose configuration, pulls a commit-pinned image, waits for health, and restores the previous image tag if the new container fails health checks. It was syntax-checked but has not been run on Oracle.

Before a later Oracle release:

1. Confirm the exact public hostname and helper email.
2. Finish the hosted auth URL, redirect, invitation template, and delivery checks.
3. Review and commit the tested source. Confirm GitHub CI and multi-platform image publication.
4. Verify the existing remote Compose directory, `.env`, service name, Cloudflare origin, SSH known-host value, and GitHub runner route. Take and verify the required database and VPS backups.
5. Enable image publication and Oracle deployment only for an approved branch and release.
6. Update the existing First2Fetch Compose service, then verify `/api/health`, login, shared jobs, invitation acceptance, and rollback.

Do not report Oracle deployment readiness until these checks are complete. The CSV analysis exports are not a database backup. Supabase reported no managed backups in the checked project and PITR was disabled; arrange a verified backup and restore path before production schema or deployment changes.
