# First 2 Fetch web companion

This package is the lightweight browser dashboard for shared job workspaces.

The desktop app remains responsible for job-board browser sessions and scheduled scanning. The web companion reads the same Supabase workspace and provides safe review actions: open an application link, mark a job applied, archive it, or move it back to new.

## Local setup

Create `apps/webapp/.env.local`:

```dotenv
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=your_local_anon_key
```

Run:

```bash
pnpm --filter first2fetch-webapp dev
```

Create the helper account at `/signup`, then add it from `/team` using the owner account.
