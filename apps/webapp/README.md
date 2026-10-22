# First2Fetch web companion

This web app lets the owner and an invited helper review jobs in the shared hosted Supabase workspace. The Electron app remains responsible for job-board browser sessions and scanning.

Normal operation uses the existing hosted Supabase project. Do not start the local Supabase stack to run the web companion.

## Local development

Create an ignored `apps/webapp/.env.local` with the hosted project URL, its public publishable key (or legacy anon key), and the local callback base URL:

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<public-publishable-key>
WEBAPP_URL=http://localhost:3002
```

Never use or expose the Supabase service-role/secret key in the web app. Keep `.env.local` out of Git.

Build the shared type package, then run the app:

```sh
pnpm --filter @first2apply/core build
pnpm --filter first2fetch-webapp dev
```

The normal local test environment uses Docker on `http://localhost:3002`; see [deployment and operations](./DEPLOYMENT.md). Sign in with an existing account or use the configured email-code flow. The owner can manage the helper from `/team` after the production auth hostname and invitation email setup are complete.

## Checks

```sh
pnpm --filter first2fetch-webapp test
pnpm --filter first2fetch-webapp typecheck
pnpm --filter first2fetch-webapp build
```

The CI workflow runs the unit tests and production build. Image publication and Oracle deployment are separately gated; see [deployment and operations](./DEPLOYMENT.md).
