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
- `apps/backend/.env`
- `apps/desktopProbe/.env`

## Supabase Setup

### Option A: Supabase Cloud (Recommended for persistent data)

Using Supabase Cloud avoids data loss from local Docker issues. See **[docs/SUPABASE_CLOUD_MIGRATION.md](docs/SUPABASE_CLOUD_MIGRATION.md)** for full migration steps.

```bash
cd apps/backend
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --include-seed
npx supabase functions deploy
```

Then set `SUPABASE_URL` and `SUPABASE_KEY` in `.env` to your Cloud project values.

### Option B: Local (Docker)

```bash
cd apps/backend
npx supabase init
npx supabase start
```

Service URLs:
- Studio: http://127.0.0.1:54323
- API: http://127.0.0.1:54321
- Database: postgresql://postgres:postgres@127.0.0.1:54322/postgres

Migrations are in `supabase/migrations/`. Create new migration:
```bash
npx supabase migration new your_migration_name
```

## Running Applications

Desktop:
```bash
cd apps/desktopProbe
npm start
```

Backend functions:
```bash
cd apps/backend
npx supabase functions serve
```

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
