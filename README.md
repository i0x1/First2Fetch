# First 2 Fetch

Job board aggregator that centralizes listings from LinkedIn, Indeed, Dice, and other platforms. Upgraded version of [First 2 Apply](https://github.com/beastx-ro/first2apply) with performance optimizations and database improvements.

## Improvements Over First 2 Apply

- Composite database indexes: Added `idx_jobs_status_created_at`, `idx_jobs_status_created_at_id`, `idx_jobs_status_siteid_created_at`, `idx_jobs_status_link_id_created_at`, and `idx_jobs_user_id_status_created_at` for faster query execution
- GIN index on labels array: `idx_jobs_labels` using gin(labels) for efficient array containment operations
- Date-based grouping: Enhanced `get_job_dates_summary()` function with two-phase loading (date summaries first, jobs on-demand)
- Timezone-aware filtering: Fixed timezone conversion in `list_jobs()` function with `timezone_name` parameter support
- Date-first sorting: Modified `list_jobs()` to sort by date (day) descending, then favorites within each date, then timestamp
- Batch migration helper: Added `apps/nodeBackend/src/index.js` for efficient batch job tag migrations

## Prerequisites

- Node.js 18+
- pnpm
- Supabase CLI
- Docker

## Installation

```bash
git clone https://github.com/i0x1/First2Fetch.git
cd First2Fetch
pnpm install
cd libraries/core && pnpm build
cd ../ui && pnpm build
```

## Environment Setup

Create `.env` files from `.env.example` in:
- `apps/desktopProbe/.env` (required for the desktop app)
- `apps/backend/supabase/functions/.env` (edge function secrets for local `functions serve` / deploy)

Optional keys (`AXIOM_TOKEN`, `AMPLITUDE_API_KEY`) can be left empty — the app logs to the terminal and runs without them. See **[docs/logging.md](docs/logging.md)** for remote log setup (Axiom).

## Supabase Setup

If your Wi‑Fi blocks Supabase Cloud, use **local Supabase** below every day until cloud works again. All `supabase` commands must run from **`apps/backend`** — not `apps/desktopProbe` (running start in the wrong folder causes “port already allocated” errors).

### Daily workflow (local Supabase)

**Before you begin:** Open **Docker Desktop** and wait until it says Docker is running.

**1. Start the database** (leave this terminal open or come back to it later)

```bash
cd apps/backend
npx supabase start
```

Wait until you see `API URL: http://127.0.0.1:54321`. First run downloads images and can take a few minutes.

**2. Run the desktop app** (second terminal)

```bash
cd apps/desktopProbe
npm start
```

**Window vanished but the app is still running?** On macOS, closing the window hides it to the **menu bar** (paper plane icon, top right) — not the Dock. Click that icon, or click the Dock icon again, or run `npm start` once more to focus the existing window. Fully quit with **Cmd+Q** or tray menu → Quit.

**3. When you are done for the day** (stops Docker containers; **keeps your local data**)

```bash
cd apps/backend
npx supabase stop
```

| What | URL / command |
|------|----------------|
| App API (use in `.env`) | `http://127.0.0.1:54321` |
| Studio (browse tables) | http://127.0.0.1:54323 |
| Test emails (Mailpit) | http://127.0.0.1:54324 |

**One-time:** point the desktop app at local Supabase. Copy `apps/desktopProbe/.env.example` → `apps/desktopProbe/.env`, then set:

```bash
cd apps/backend
npx supabase status -o env
```

Paste into `apps/desktopProbe/.env`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<ANON_KEY from the command above>
```

The local `ANON_KEY` is the same every time on your machine (demo JWT from the CLI). You only need to copy it once unless you delete Docker volumes.

**Optional:** edge functions (job scanning, webhooks) in a third terminal:

```bash
cd apps/backend
npx supabase functions serve
```

#### If `supabase start` fails

- **`Bind for 0.0.0.0:54322 failed: port is already allocated`** — Supabase is already running, or you started it from the wrong folder.
  ```bash
  cd apps/backend
  npx supabase stop
  npx supabase start
  ```
  If you ever ran `supabase start` inside `apps/desktopProbe`, stop that project too:
  ```bash
  cd apps/desktopProbe
  npx supabase stop
  ```
- **`Cannot connect to the Docker daemon`** — start Docker Desktop, wait ~30s, try again.
- **Storage / migration errors on start** — clear stale CLI pins, then use a recent CLI:
  ```bash
  cd apps/backend
  rm -f supabase/.temp/storage-migration supabase/.temp/storage-version
  npx supabase@latest start
  ```

**Never run** `npx supabase db reset` on local data you care about (workspace rule: no database reset).

### Option A: Supabase Cloud (when your network can reach it)

```bash
cd apps/backend
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --include-seed
npx supabase functions deploy
```

Set `SUPABASE_URL` and `SUPABASE_KEY` in `apps/desktopProbe/.env` from Dashboard → Settings → API (hosted URL + anon key).

**Auth email checklist (password reset, signup confirm):** Supabase’s built-in mailer only sends to org team emails. For real users you must configure custom SMTP in the Dashboard:

1. [Authentication → SMTP](https://supabase.com/dashboard/project/_/auth/smtp) — enable custom SMTP (e.g. [Resend](https://resend.com/docs/send-with-supabase-smtp): host `smtp.resend.com`, port `465`, user `resend`, password = Resend API key, sender = a verified domain like `noreply@yourdomain.com`).
2. [Authentication → URL Configuration](https://supabase.com/dashboard/project/_/auth/url-configuration) — add redirect allow-list entry `first2fetch://reset-password` (desktop deep link for reset flow).

`RESEND_*` in `apps/backend/supabase/functions/.env` is for **job alert** emails from edge functions only; it does not power auth emails.

**Connectivity:** If the desktop app shows `ECONNREFUSED` or `fetch failed` for cloud, your router may block `*.supabase.co` — use the **daily local workflow** above. Hitting `https://YOUR_PROJECT_REF.supabase.co/auth/v1/health` in a browser (no API key) and seeing `No API key found` means cloud is reachable.

### Database migrations (developers)

Migrations live in `apps/backend/supabase/migrations/`. New migration:

```bash
cd apps/backend
npx supabase migration new your_migration_name
```

## Running Applications

See **Daily workflow** above for `npm start` in `apps/desktopProbe`.

## Project Structure

Monorepo using Nx:

- `apps/backend`: Supabase migrations and edge functions
- `apps/desktopProbe`: Electron desktop application
- `apps/landingPage`: Next.js marketing site
- `apps/blog`: Project blog
- `apps/invoiceDownloader`: Invoice utility
- `apps/nodeBackend`: Node.js backend services
- `libraries/core`: Shared core library
- `libraries/ui`: Shared UI components

## Architecture

For a deeper agent-oriented walkthrough of the application structure, runtime flows, LLM usage, backend, frontend, data model, and development notes, see [docs/architecture.md](docs/architecture.md).

## Development

```bash
pnpm nx start <project-name>
pnpm nx build <project-name>
pnpm nx test <project-name>
pnpm nx lint <project-name>
```

## License

MIT License

---

Based on [First 2 Apply](https://github.com/beastx-ro/first2apply) by [BeastX Industries](https://first2apply.com/). This version includes database performance optimizations, enhanced query functions, and improved timezone handling.
