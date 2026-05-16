# First 2 Fetch Architecture

This document is written for LLM agents and developers who need to work in this repository without rediscovering the system from scratch. It describes the runtime architecture, the main code paths, the LLM usage, and the places where frontend, Electron, Supabase, and edge functions meet.

## Repository Shape

This is a pnpm/Nx monorepo.

| Path | Purpose |
| --- | --- |
| `apps/desktopProbe` | Main Electron desktop application. It owns the React UI, Electron main process, local browser scraping, scheduled scans, IPC, tray behavior, auto updates, notifications, and Supabase client wrapper. |
| `apps/backend` | Supabase project: migrations, seed data, config, and Deno edge functions. This is the real backend for auth-aware operations, parsing, subscriptions, Stripe webhooks, email hooks, and LLM-powered matching. |
| `apps/landingPage` | Next.js marketing/download site. It imports shared UI components and has no direct scraping runtime responsibility. |
| `apps/blog` | Next.js/contentlayer blog. Mostly content and SEO. |
| `apps/nodeBackend` | Small Node migration utility for batch job tag updates through Supabase RPCs. Not the main backend. |
| `apps/invoiceDownloader` | Stripe/Keez invoice utility. Operational side tool, separate from the job scanning product. |
| `libraries/core` | Shared TypeScript types, errors, and logging exports used by desktop and backend functions. Important for `DbSchema`, `Job`, `Link`, `JobSite`, status enums, and provider names. |
| `libraries/ui` | Shared React UI primitives and theme utilities built around Radix, Tailwind, shadcn-style components, and local helpers. |
| `other/emailTemplates` | HTML email templates and related assets. |
| `docs` | Human/agent documentation. |

Root scripts call Nx targets. Common commands:

```bash
pnpm install
pnpm nx build <project-name>
pnpm nx lint <project-name>
pnpm nx test <project-name>
pnpm dev:start
pnpm dev:quick
pnpm dev:stop
```

`dev.sh` is the local orchestration script. It can start Supabase, edge functions, and the desktop app together or separately. The local Supabase project lives in `apps/backend`.

## Runtime Architecture

At runtime the product is an Electron desktop app backed by Supabase:

```text
React renderer
  -> preload bridge: window.electron.invoke(...)
  -> Electron main process IPC handlers
  -> F2aSupabaseApi wrapper
  -> Supabase tables, RPCs, and edge functions

Electron main process
  -> JobScanner scheduled tasks
  -> HtmlDownloader hidden BrowserWindow pool
  -> scrape HTML and runtime page data
  -> scan-urls edge function
  -> jobs table rows in processing state
  -> scan-job-description edge function
  -> parser/LLM/advanced matching
  -> jobs become new or excluded_by_advanced_matching
```

The desktop app is not a thin web client. It does real local browser work in Electron so it can load job boards, scroll pages, reuse a persistent scraper session, and collect HTML that is then parsed on the backend.

## Desktop App

### Electron Main Process

Main entry: `apps/desktopProbe/src/index.ts`.

Responsibilities:

- Loads desktop environment variables from `apps/desktopProbe/.env` via `src/env.ts`.
- Registers the `first2fetch://` protocol for reset-password deep links.
- Creates the main Electron `BrowserWindow` with a preload script and persistent scraper partition.
- Initializes Supabase with `SUPABASE_URL` and `SUPABASE_KEY`.
- Creates long-lived services:
  - `AmplitudeAnalyticsClient`
  - `F2aAutoUpdater`
  - two `HtmlDownloader` pools: normal persistent session and incognito session
  - `JobScanner`
  - `OverlayBrowserView`
  - `TrayMenu`
- Saves and restores Supabase auth sessions encrypted with Electron `safeStorage`.
- Starts an initial scan after restoring a saved session.
- Hides to tray instead of closing while the scanner is active.

The app window is renderer-only. All privileged work goes through IPC registered in `apps/desktopProbe/src/server/rendererIpcApi.ts`.

### Preload Boundary

`apps/desktopProbe/src/preload.ts` exposes:

- `window.electron.invoke(channel, params)`
- `window.electron.on(channel, callback)`
- `window.electron.theme`

The renderer calls a typed wrapper in `apps/desktopProbe/src/lib/electronMainSdk.tsx`, which maps UI actions to IPC channel names and unwraps `{ data, error }` responses.

### Renderer Frontend

Renderer entry points:

- `apps/desktopProbe/src/renderer.ts`
- `apps/desktopProbe/src/app.tsx`

The UI is React 18 with `createMemoryRouter`, not browser history. Important routes:

- `/` home/job feed
- `/links` saved searches
- `/filters` advanced matching and company lists
- `/settings` scanner, email, browser, and AI-provider settings
- `/status` scanner status
- `/login`, `/signup`, `/forgot-password`, `/reset-password`
- `/subscription`, `/feedback`, `/help`

Global providers are nested in `app.tsx`:

- `AppStateProvider`
- `SessionProvider`
- `ThemeProvider`
- `SettingsProvider`
- `SitesProvider`
- `LinksProvider`

The UI talks to Electron through `electronMainSdk.tsx`; it does not create a browser Supabase client directly.

### Browser Overlay and Saving Searches

The "Add Search" flow is in `apps/desktopProbe/src/components/createLink.tsx` and `components/browserWindow.tsx`.

Flow:

1. User picks a supported job board from `sites`.
2. Renderer asks main process to open `OverlayBrowserView`.
3. Main process creates an Electron `WebContentsView` in partition `persist:scraper`.
4. User navigates and configures search filters on the real site.
5. User clicks Save.
6. Main process returns URL, title, page HTML, and provider runtime data.
7. Renderer confirms title/URL and calls `create-link`.
8. Main process invokes Supabase edge function `create-link`.
9. If initial HTML contains jobs, backend inserts new `jobs` rows with status `processing`.
10. Main process starts description scanning for returned jobs without blocking the UI.

LinkedIn has special runtime handling. `apps/desktopProbe/src/server/browserHelpers.ts` installs an HTTPS protocol decorator on the persistent scraper session. For LinkedIn job pages it captures the `rehydrate-data` script and stores it keyed by URL hash. `consumeRuntimeData()` attaches this payload to later parsing calls so backend LinkedIn parsers can use data that is not easily available from static DOM alone.

### Scheduled Scanning

`apps/desktopProbe/src/server/jobScanner.ts` owns scheduled scanning.

Scanner settings are saved locally in Electron `userData/settings.json`. Defaults:

- `cronRule`: every hour
- `preventSleep`: true
- `useSound`: true
- `areEmailAlertsEnabled`: true
- `inAppBrowserEnabled`: true
- `isPaused`: false

Important behavior:

- Uses `node-cron` for the general scan schedule.
- Can run a LinkedIn-only schedule through `linkedinScanIntervalMinutes`.
- Uses Electron `powerSaveBlocker` when prevent-sleep is enabled.
- Skips a scheduled scan if another scan is already running.
- Tracks logs and active job status for `/status`.
- Shows OS notifications when new jobs are found.

Scanning saved links:

1. Load saved `links` from Supabase.
2. For each link, use `HtmlDownloader` to load and scroll the page.
3. Send HTML to edge function `scan-urls`.
4. Backend parses list pages and upserts jobs as `processing`.
5. Desktop lists up to 300 `processing` jobs.
6. `scanJobs()` fetches each job detail URL.
7. Detail HTML is sent to `scan-job-description`.
8. Backend extracts description, applies advanced matching, and updates job status.

### HTML Downloader

`apps/desktopProbe/src/server/htmlDownloader.ts` wraps a pool of hidden Electron `BrowserWindow` instances.

Key details:

- Normal pool has two windows. Incognito pool has one.
- Uses a `WorkerQueue` to limit concurrent browser use.
- Uses realistic Chrome user agents instead of Electron default UA.
- Adds small stealth patches such as `navigator.webdriver` hiding.
- Blocks a LinkedIn passkey request route that causes popups.
- Scrolls pages in steps and sends mouse movement events to trigger lazy loading.
- Retries rate-limited pages and authwall redirects.
- Calls the caller's callback while the window is still reserved, allowing backend parsing retries to read fresh page state.

Sites in `sites.incognito_support` determine whether job detail pages should be scanned in incognito or persistent session.

## Supabase Backend

Main backend path: `apps/backend/supabase`.

It contains:

- `config.toml`: local Supabase service ports and function settings.
- `migrations`: schema, RLS, RPCs, indexes, subscription/Stripe helpers, advanced matching, date grouping, search vectors, and security fixes.
- `seed.sql` and `sites_rows.csv`: supported job sites and seed data.
- `functions`: Deno edge functions.

Local default ports:

- API: `http://127.0.0.1:54321`
- Studio: `http://127.0.0.1:54323`
- DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

### Database Model

Core tables:

- `sites`: supported job boards, providers, domains, parser metadata, logo URLs, query params to remove, deprecated flag, incognito support.
- `links`: user-saved job search URLs tied to a site.
- `jobs`: parsed job records. Unique on `(user_id, externalId)`.
- `profiles`: subscription and Stripe metadata.
- `advanced_matching`: user matching prompt, company lists, AI provider/model, encrypted AI key, and AI usage counters.
- `reviews`: app feedback.
- `notes`: per-job notes and files.
- `html_dumps`: failed parser payloads for debugging.
- `ai_usage_daily`: daily AI usage tracking from later migrations.

Important statuses:

- `processing`: list parser found a job, but detail parser has not completed.
- `new`: visible job that passed parsing and matching.
- `excluded_by_advanced_matching`: hidden/filtered by advanced matching.
- `applied`, `archived`, `deleted`: user lifecycle states. Some older DB enum migrations may not include every TypeScript status, so check migrations before relying on a status in SQL.

Important RPCs:

- `list_jobs`: paginated feed, search filters, site/link/label filters, repost hiding, local-time date filtering, favorite-company ordering.
- `count_jobs`: status counters for the feed.
- `get_job_dates_summary`: date buckets for efficient date-first loading.
- `update_advanced_matching_with_ai_config`: upserts matching settings and encrypts raw AI keys.
- `encrypt_api_key` / `decrypt_api_key`: DB-side API key obfuscation/integrity functions.
- `log_ai_usage`: records provider token usage and cost.

The desktop wrapper `F2aSupabaseApi` is the best place to inspect how RPCs are called from the app.

### Auth and Edge Function Context

Shared context helper: `apps/backend/supabase/functions/_shared/edgeFunctions.ts`.

Most functions call `getEdgeFunctionContext({ checkAuthorization: true })`.

The Supabase config currently has `verify_jwt = false` for several functions, but the functions still manually require and validate the `Authorization` header. This is intentional in the current code path: the desktop app sends the user JWT and anon key explicitly when invoking functions. The context helper creates:

- `authClient`: user-scoped Supabase client with the request JWT, so `auth.uid()` and RLS work.
- `supabaseAdminClient`: service-role client for operations that require elevated privileges, such as subscription checks and encrypted key reads.

The desktop side builds function headers in `F2aSupabaseApi._getAuthHeaders()`, validates token project ref against the configured Supabase URL, and retries once after refreshing the session on 401.

## Edge Functions

### `create-link`

Path: `apps/backend/supabase/functions/create-link/index.ts`.

Responsibilities:

- Authenticates the user.
- Loads supported `sites`.
- Checks subscription permissions.
- Enforces max saved links and custom parser link limits.
- Normalizes/cleans the submitted URL.
- Inserts a `links` row.
- Optionally parses submitted HTML immediately to validate the page and insert initial `processing` jobs.
- Deletes the in-flight link if validation/parsing fails before completion.

This function uses parser logic in `_shared/jobListParser.ts`.

### `scan-urls`

Path: `apps/backend/supabase/functions/scan-urls/index.ts`.

Responsibilities:

- Authenticates the user.
- Checks subscription expiration.
- Loads target links and sites.
- Parses each list-page HTML payload.
- Upserts parsed jobs into `jobs` with status `processing`.
- Tracks parse failures and saves `html_dumps` on last retry for supported cases.
- Resets link scrape failure counters on successful parses.

Known parser failures increment `links.scrape_failure_count`.

### `scan-job-description`

Path: `apps/backend/supabase/functions/scan-job-description/index.ts`.

Responsibilities:

- Authenticates the user.
- Loads the job and its site.
- Extracts job description/salary/tags from detail HTML.
- Applies advanced matching.
- Updates `jobs.description`, `salary`, `tags`, `status`, `exclude_reason`, and `updated_at`.
- Prevents jobs from staying stuck in `processing` after parser errors by moving them back to `new`.

It races description parsing against a 30 second timeout. The timeout returns quickly to the client while parsing may still finish in the background.

### `post-scan-hook`

Path: `apps/backend/supabase/functions/post-scan-hook/index.ts`.

Responsibilities:

- Checks for repeatedly broken links and emails users.
- Sends new-job email alerts.

The desktop scanner currently has the call to `runPostScanHook()` commented out, so in-app notifications are active but the post-scan email hook is not called from the main scan flow unless re-enabled.

### Webhooks

- `handle-stripe-webhook`: Stripe subscription/customer events.
- `handle-profile-change-webhook`: profile/mail-system side effects.

These are unauthenticated by JWT at the Supabase gateway and authenticate by webhook-specific secrets/signatures in function code.

## Parsing Architecture

List parsing entry: `apps/backend/supabase/functions/_shared/jobListParser.ts`.

Description parsing entry: `apps/backend/supabase/functions/_shared/jobDescriptionParser.ts`.

Supported first-class providers are defined in `libraries/core/src/types.ts` as `SiteProvider`:

- LinkedIn
- Glassdoor
- Indeed
- Remote OK
- We Work Remotely
- Dice
- FlexJobs
- BestJobs
- EchoJobs
- Remotive
- Remote.io
- Built In
- Naukri
- Robert Half
- ZipRecruiter
- USAJobs
- Talent
- Custom

For known sites, parsers are mostly deterministic DOM parsers using Deno DOM, provider-specific selectors, script payload extraction, and Turndown conversion to Markdown. Some providers have separate parser files under `_shared/parsers`.

For `custom`, parsing is LLM-powered and requires the user to configure an AI provider/API key.

When adding or modifying a supported provider, check all of these places:

- `libraries/core/src/types.ts` for `SiteProvider` and shared types.
- `apps/backend/supabase/seed.sql` or `sites_rows.csv` for site metadata.
- `_shared/jobListParser.ts` for list parser dispatch.
- `_shared/jobDescriptionParser.ts` for description parser dispatch/selectors.
- `_shared/parsers/*` if a separate parser module is more appropriate.
- Desktop UI that lists and validates sites: `apps/desktopProbe/src/components/createLink.tsx`, `src/lib/linkValidation.ts`, `src/hooks/sites.tsx`.

## LLM and AI Provider Layer

There are two AI helper layers in the repo.

### Current User-Configured Provider Layer

Main files:

- `apps/backend/supabase/functions/_shared/aiProvider.ts`
- `apps/backend/supabase/functions/_shared/aiProviderConfig.ts`
- `apps/desktopProbe/src/lib/aiProviderConfig.ts`
- `apps/desktopProbe/src/server/supabaseApi.ts`

Supported providers:

- `openai`
- `google_gemini`

Supported model lists live in backend and frontend config files. Keep both in sync. The backend config is authoritative for cost accounting and provider validation.

The user config is stored in `advanced_matching`:

- `ai_provider`
- `ai_model`
- `ai_api_key_encrypted`

The raw API key is passed from the desktop UI to `update_advanced_matching_with_ai_config`, encrypted by Postgres RPC, and not returned to the UI. Edge functions decrypt through `decrypt_api_key` with `supabaseAdminClient`.

LLM calls are used for:

- Custom job list extraction: `_shared/customJobsParser.ts::parseCustomJobs`.
- Custom job description extraction/summarization: `_shared/customJobsParser.ts::parseCustomJobDescription`.
- Advanced matching exclusion decisions: `_shared/advancedMatching.ts::promptAI`.

All current LLM call sites require user-configured provider credentials. There is no fallback to Azure in those paths. If missing, the function throws a user-facing error asking the user to configure an AI key in Settings.

LLM responses are requested as JSON and validated with Zod schemas before DB writes. Usage/cost is recorded through `logAiUsage`.

### Legacy Azure OpenAI Helper

File: `apps/backend/supabase/functions/_shared/openAI.ts`.

This builds an Azure OpenAI client from:

- `AZURE_AI_FOUNDRY_ENDPOINT`
- `AZURE_AI_FOUNDRY_API_KEY`

It supports model/cost metadata for models such as `gpt-5.2`, `gpt-5-mini`, `gpt-5-nano`, `gpt-4o`, `gpt-4o-mini`, `o4-mini`, `o3-mini`, and `DeepSeek-R1-0528`.

This helper remains in the codebase for backward compatibility/legacy usage, but the custom parser and advanced matching paths described above use the newer provider abstraction.

## Advanced Matching

Main file: `apps/backend/supabase/functions/_shared/advancedMatching.ts`.

Advanced matching runs after a job description is parsed.

Order of checks:

1. Verify subscription allows advanced matching.
2. Load the user's `advanced_matching` config.
3. Recognize favorite companies. This affects sorting in job RPCs; it does not automatically change status.
4. Exclude exact-name blacklisted companies without calling the LLM.
5. If `chatgpt_prompt` and `job.description` exist, call the configured AI provider to decide whether the job should be excluded.
6. Return either `new` or `excluded_by_advanced_matching` plus a short exclude reason.

The subscription helper currently hardcodes Pro behavior for all users for 10 years. That means advanced matching and custom parser checks currently return enabled in local/current code. Treat this as a temporary product flag, not final subscription logic.

Company lists:

- `blacklisted_companies`: exact-name exclusion.
- `favorite_companies`: exact-name boost in `list_jobs` and `get_job_dates_summary`.
- `watched_companies`: desktop-side list management exists; check UI behavior before assuming backend matching semantics.

## Data Flow Examples

### Save a New Search

```text
CreateLink component
  -> BrowserWindow component
  -> open-overlay-browser-view IPC
  -> OverlayBrowserView.open()
  -> user browses real job board
  -> finish-overlay-browser-view IPC
  -> OverlayBrowserView.finish()
  -> create-link IPC
  -> F2aSupabaseApi.createLink()
  -> create-link edge function
  -> links insert
  -> optional initial list parse
  -> jobs upsert as processing
  -> JobScanner.scanJobs(newJobs)
  -> scan-job-description edge function
  -> jobs become new/excluded_by_advanced_matching
```

### Scheduled Scan

```text
node-cron schedule in JobScanner
  -> scanAllLinks()
  -> listLinks()
  -> HtmlDownloader.loadUrl() for each saved search
  -> scan-urls edge function
  -> parseJobsListUrl()
  -> jobs upsert as processing
  -> listJobs({ status: "processing" })
  -> HtmlDownloader.loadUrl() for each job detail
  -> scan-job-description edge function
  -> parseJobDescriptionUpdates()
  -> applyAdvancedMatchingFilters()
  -> jobs update
  -> desktop notification for new jobs
```

### Job Feed Loading

```text
Home/feed components
  -> electronMainSdk.listJobs() and getJobDatesSummary()
  -> renderer IPC
  -> F2aSupabaseApi.listJobs()
  -> Supabase RPC list_jobs/count_jobs
  -> timezone-aware date buckets and pagination
```

Pagination token format is `${lastJob.id}!${lastJob.created_at}`. The SQL parses both values and orders by local date, favorite-company match, timestamp, and id.

## Environment Variables

Desktop `.env` is loaded from `apps/desktopProbe/.env`:

- `APP_BUNDLE_ID`
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `DESKTOP_LOG_LEVEL` or `LOG_LEVEL`
- `MEZMO_API_KEY`
- `AMPLITUDE_API_KEY`
- Release/notarization variables used by Electron Forge when packaging.

Backend edge functions use Deno env through `_shared/env.ts`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` in current auth helper fallback path
- `AZURE_AI_FOUNDRY_ENDPOINT`
- `AZURE_AI_FOUNDRY_API_KEY`
- `MEZMO_API_KEY`
- `MAILERLITE_API_KEY`
- `MAILERSEND_API_KEY`
- `F2A_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SIGNING_SECRET`

AI-provider API keys for OpenAI/Gemini are user settings stored encrypted in the database, not process env vars.

## Build, Packaging, and Deployment Notes

Desktop:

- `apps/desktopProbe/package.json` uses Electron Forge.
- Main bundle path is `.webpack/main`.
- Renderer dev server port is `3049`.
- Packagers include Squirrel, DMG, AppX, Deb, and Zip.
- Publisher uploads release artifacts to S3 bucket `first2apply.com`.
- Custom protocol in packaging is `first2fetch`.

Backend:

- `apps/backend/package.json` build runs `deno check` under `supabase/functions` when Deno is installed.
- `npx supabase functions serve` runs edge functions locally.
- `npx supabase db push --include-seed` applies migrations and seed to linked cloud projects.

Marketing/blog:

- `apps/landingPage` and `apps/blog` are independent Next.js apps.
- `libraries/ui` is shared by desktop and landing page.

## Agent Working Notes

- Prefer tracing UI action -> `electronMainSdk.tsx` -> `rendererIpcApi.ts` -> `F2aSupabaseApi` -> edge function/RPC.
- Do not bypass IPC by adding direct Supabase calls in renderer unless there is a deliberate architecture change.
- The current source of truth for app types is `libraries/core/src/types.ts`, but some DB migrations have evolved beyond older type definitions. Check migrations and actual RPC signatures when touching SQL-sensitive code.
- Be careful with user auth in edge functions. `verify_jwt = false` in `config.toml` does not mean anonymous access; most functions manually validate `Authorization`.
- Keep frontend and backend AI provider config in sync.
- LLM output must stay schema-validated before writing to the database.
- For parser changes, add enough logging and preserve `html_dumps` behavior because production parser failures depend on saved HTML for diagnosis.
- Existing local/session files are stored under Electron `app.getPath("userData")`, not inside the repo.
- `post-scan-hook` exists, but the scanner currently comments out the call. Re-enable deliberately if email alerts are required.
- Before changing scanning concurrency or delays, inspect rate-limit/authwall handling in `HtmlDownloader`.
- Deep-link naming is mixed in historical config. The active desktop protocol in `index.ts`, `forge.config.ts`, and password reset code is `first2fetch://`; `apps/backend/supabase/config.toml` still contains an older `first2apply://**` redirect entry, so verify redirect allow-lists when changing auth links.
- There are existing modified files in backend function areas in some worktrees. Check `git status` before editing and avoid reverting unrelated user changes.
