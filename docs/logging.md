# Logging

First2Fetch logs to the **terminal by default**. Optional remote logging sends copies to [Axiom](https://axiom.co) over plain HTTP (works in Electron and Supabase Edge Functions).

No API keys = no remote logging, **no warnings, no errors** — terminal logging only.

Both `AXIOM_TOKEN` and `AXIOM_DATASET` must be set together; omit both (or leave them empty) for local dev.

## Why Axiom (not Mezmo)

We evaluated free-tier log platforms for this project’s shape: verbose Electron desktop logs + optional Supabase Edge logs, small team, early stage.

| Service | Free ingest | Retention | Fit for us |
|--------|-------------|-----------|------------|
| **Axiom** | **500 GB/mo** | 30 days | **Best** — huge headroom while logs are still verbose |
| Grafana Cloud (Loki) | 50 GB/mo | 14 days | Good full-stack option, more setup |
| Better Stack (Logtail) | 1 GB/mo | 3 days | Too small for detailed scanner logs |
| Mezmo (LogDNA) | ~1 GB/mo | limited | We hit the free cap; persistent SDK connections caused noise/errors |
| Datadog | ~1 day | 1 day | Overkill and expensive |
| Logflare | Supabase-native | varies | Fine for DB logs; less ideal as unified desktop + edge sink |

**Chosen: Axiom**

- Generous free tier while we still log heavily during development
- Simple REST ingest (`fetch`) — no background socket like `@logdna/logger`
- Same transport for desktop and edge (edge is opt-in)
- Failures are silent — logging never breaks auth, scans, or UI

## Activate Axiom (one-time)

### 1. Create account and dataset

1. Sign up at [axiom.co](https://axiom.co) (free tier, no card required).
2. Create a dataset named **`first2fetch`** (or any name — use the same value in env).

### 2. Create an API token

1. Axiom → **Settings → API tokens → New API token**
2. Name: `first2fetch-ingest`
3. Permissions: **Ingest** on your `first2fetch` dataset only
4. Copy the token (shown once)

Use an **API token**, not a personal access token, for ingest.

### 3. Desktop app

Add to `apps/desktopProbe/.env`:

```env
AXIOM_TOKEN=your_api_token_here
AXIOM_DATASET=first2fetch
# Optional:
# REMOTE_LOG_LEVEL=info
```

Restart `npm start`. Logs still print locally; `info`/`warn`/`error` also ship to Axiom (`debug` stays local unless you set `REMOTE_LOG_LEVEL=debug`).

### 4. Supabase Edge Functions (optional)

Hosted functions already log to **Supabase Dashboard → Edge Functions → Logs**. To mirror into Axiom:

1. Supabase Dashboard → **Edge Functions → Secrets** (or local `apps/backend/supabase/functions/.env`):

```env
AXIOM_TOKEN=your_api_token_here
AXIOM_DATASET=first2fetch
AXIOM_ENABLE_EDGE=true
REMOTE_LOG_LEVEL=info
```

2. Redeploy functions if using cloud secrets.

Keep `AXIOM_ENABLE_EDGE` off unless you want edge logs in Axiom — saves ingest volume.

### 5. Production builds (GitHub Actions)

Add repository secrets:

- `AXIOM_TOKEN`
- `AXIOM_DATASET` (e.g. `first2fetch`)

Release workflows pass these into packaged desktop builds.

## Query logs in Axiom

Example APL queries in the Axiom dataset explorer:

```apl
['first2fetch']
| where source == "desktop"
| where level == "error"
| sort by _time desc
```

```apl
['first2fetch']
| where source == "edge-functions"
| where message contains "scan"
| sort by _time desc
```

Fields we send: `_time`, `level`, `message`, `source` (`desktop` | `edge-functions`), `meta` (app version, user id when set), `data` (structured payload, secrets redacted).

## Log levels

| Variable | Where | Default | Meaning |
|----------|-------|---------|---------|
| `LOG_LEVEL` / `DESKTOP_LOG_LEVEL` | Desktop terminal | `debug` in dev | What you see locally |
| `EDGE_LOG_LEVEL` | Edge terminal / Supabase logs | `info` | Edge console verbosity |
| `REMOTE_LOG_LEVEL` | Axiom ingest | `info` | Minimum level shipped remotely |

Tip: keep `REMOTE_LOG_LEVEL=info` while logs are verbose; use `warn` later to cut volume.

## Making logs shorter (planned)

Remote logging is in place first; tightening log messages in scanners/auth is a separate pass. Prefer:

- `info` for lifecycle events (started scan, finished, count)
- `debug` for per-page/parser detail
- `error` only for failures users or ops need to act on
