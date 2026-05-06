# Phase 1.0.0 — Diff with upstream (`beastx-ro/first2apply`)

**Status:** **Completed** (implementation landed in repo, 2026-04-20)  
**Upstream reference used for ports:** `upstream/master` @ `7e97a9008e1fc32f29a0eaa9444d0ccac23b2c44`  
**Merge-base (historical):** `5531b76` — diverged fork; we did **not** merge upstream wholesale.

---

## What was implemented (summary)

| Area | Change |
|------|--------|
| **SQL / RPC (S1–S2)** | New migration `20260420120000_phase1_rpc_user_scoping_and_html_dumps.sql`: `list_jobs`, both `count_jobs` overloads, both `get_job_dates_summary` overloads now filter **`jobs.user_id = auth.uid()`**; `html_dumps` gains optional **`webpage_runtime_data jsonb`**. |
| **Parsers (P1–P4)** | Replaced monolithic parsers with upstream-aligned layout: `jobListParser.ts` + `parsers/{linkedin,dice,remoteio,parserTypes}.ts`; refreshed `jobDescriptionParser.ts` from upstream; Deno imports use **`https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts`**. |
| **Custom parser** | Kept user–API-key flow in `customJobsParser.ts`; added **HTTPS-only** external URLs and **`tags ?? []`**; imports `ParsedJob` from `parserTypes`. |
| **create-link / scan (C1–C2)** | **`force`**, **`webPageRuntimeData`**, clearer parse-failure copy; **50 / 5 limits unchanged**; skip **empty upsert** when `jobs.length === 0`. |
| **WebPageRuntimeData (W1)** | **`libraries/core`**: `WebPageRuntimeData`, `LinkedinRuntimeData`, `HtmlDump.webpage_runtime_data`; **`browserHelpers.ts`**: LinkedIn protocol capture + `consumeRuntimeData`; **overlay** + **HtmlDownloader** pass runtime data; **JobScanner** installs decorator via **`normalHtmlDownloader.getSession()`**. |
| **AI (A1)** | `openAI.ts`: **`gpt-5.2`** in supported models + costs; `aiProviderConfig.ts` (edge + desktop) lists **gpt-5.2 / gpt-5-mini / gpt-5-nano**; `buildAIProviderFromUserConfig` uses **`.maybeSingle()`** for `advanced_matching`. |
| **Desktop UX (U1)** | Save dialog: **Cancel** is `type="button"`; optional **“Save anyway…”** checkbox sets **`force`**. |
| **Skipped (X1)** | No webapp, Azure CI, Linux packaging. |

---

## Builds / verification run locally

- `libraries/core`: `pnpm run build` — OK  
- `libraries/ui`: `pnpm run build` — OK  
- `apps/desktopProbe`: `pnpm run build` (`tsc --noEmit`) — OK  
- Root `pnpm test` — fails on **pre-existing** `@first2apply/node-backend` / invoice placeholder tests (not introduced by this phase).

**Your follow-up:** apply migration to hosted Supabase (`supabase db push` or equivalent) and **redeploy edge functions** so `create-link` / `scan-urls` match the new types.

---

## 1. Goals of this phase (archived)

| Goal | Success looks like |
|------|---------------------|
| **Maximize job usability** | Fewer missed listings, fewer parser false negatives, fewer brittle failures when LinkedIn/Dice/Indeed change DOM. |
| **Minimize breakage** | No mass merge of upstream `master`; no webapp; no wholesale UI library swap; preserve custom fields and flows. |
| **Security correctness** | SQL/RPC paths that use `SECURITY DEFINER` do not accidentally expose other users’ rows. |

---

## 2. Checklist (master table) — all done

| ID | Task | Done |
|----|------|------|
| S1 | Audit / fix `list_jobs` / `get_job_dates_summary` / `count_jobs` for `user_id` under definer | ☑ |
| S2 | Ship SQL migration (+ `html_dumps` column) | ☑ |
| P1–P4 | Parser parity with upstream (list + description modules, LinkedIn/Dice/remoteio split) | ☑ |
| C1 | `create-link`: `force` + messages; limits **unchanged** (50 / 5) | ☑ |
| C2 | `scan-urls`: `webPageRuntimeData` on payloads + dumps | ☑ |
| A1 | Model list sync + `maybeSingle` on advanced_matching | ☑ |
| W1 | `WebPageRuntimeData` end-to-end (core, edge, Electron) | ☑ |
| U1 | Create-link dialog: cancel button type + force checkbox | ☑ |
| X1 | Skip webapp, Azure CI, Linux | ☑ |

---

## 3. References

- Upstream: [beastx-ro/first2apply](https://github.com/beastx-ro/first2apply) @ `7e97a9008e1fc32f29a0eaa9444d0ccac23b2c44`  
- Migration: `apps/backend/supabase/migrations/20260420120000_phase1_rpc_user_scoping_and_html_dumps.sql`  
- Parsers: `apps/backend/supabase/functions/_shared/jobListParser.ts`, `parsers/*.ts`, `jobDescriptionParser.ts`, `customJobsParser.ts`  
- Desktop: `apps/desktopProbe/src/server/browserHelpers.ts`, `htmlDownloader.ts`, `overlayBrowserView.ts`, `jobScanner.ts`, `createLink.tsx`

---

*Phase 1.0.0 implementation complete; see §“What was implemented” and §“Your follow-up” for deploy steps.*
