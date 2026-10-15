# Web companion deployment

The web companion is designed to run on the Oracle VPS. It does not run the job scanner. The desktop app remains the scanner and the web companion reads the shared Supabase workspace.

## Required environment

Set these values in the container or system service. Do not commit them.

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-public-anon-key
WEBAPP_URL=https://jobs.example.com
HOSTNAME=0.0.0.0
PORT=3002
```

The anon key is safe for browser use when Row Level Security is enabled. Never use the Supabase service-role key in this app.

## Docker

Build from the repository root:

```bash
docker build -f apps/webapp/Dockerfile -t first2fetch-webapp .
docker run --rm -p 3002:3002 \
  -e SUPABASE_URL="https://your-project.supabase.co" \
  -e SUPABASE_ANON_KEY="your-public-anon-key" \
  first2fetch-webapp
```

For the VPS, copy `apps/webapp/docker-compose.yml` to `/opt/first2fetch-webapp/docker-compose.yml` and set `WEBAPP_IMAGE=ghcr.io/YOUR_GITHUB_OWNER/first2fetch-webapp:latest` in its `.env` file. Put Caddy, Cloudflare Tunnel, or another HTTPS proxy in front of port 3002. Only expose HTTPS to the public network. Keep SSH restricted to keys and keep the Oracle security list limited to SSH and the proxy path.

## Automatic updates from Git

`.github/workflows/deploy-webapp.yml` builds and publishes the Docker image after changes reach `main`, then connects to the VPS and runs `docker compose pull` and `docker compose up -d`. A manual workflow run is also available for recovery.

Add these GitHub Actions secrets before enabling the workflow:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_SSH_PORT` (optional)
- `VPS_APP_DIR` (optional; defaults to `/opt/first2fetch-webapp`)
- `GHCR_USERNAME` (optional; defaults to the GitHub repository owner)
- `GHCR_READ_TOKEN` (a GitHub token with read-only package access)

The workflow deploys the Git commit that triggered it. Merge reviewed changes into `main` to update the hosted companion. Keep production Supabase values in the VPS `.env`; do not put them in GitHub Actions logs or repository files.

## First-use flow

1. The owner sends an invitation from `/team`.
2. The helper opens the invitation email and signs in.
3. Both users can open a job and see the activity history.

The helper can open job links, mark jobs applied, archive jobs, and move jobs back to new. The helper cannot control scanning or API keys.

## Supabase setup before Oracle deployment

Apply the database migrations to the hosted Supabase project, then deploy the invitation function:

```bash
supabase db push
supabase functions deploy invite-workspace-member
supabase secrets set WEBAPP_URL=https://jobs.example.com
```

In Supabase Authentication settings:

1. Add `https://jobs.example.com/auth/callback` to the allowed redirect URLs.
2. Configure custom SMTP before using helper invitations or regular OTP login.
3. Update the passwordless email template to include `{{ .Token }}`.
4. Keep the Supabase service key only in the Edge Function environment.

For local development, the Supabase config includes the local web URLs and Inbucket captures test emails without sending them to real addresses.
