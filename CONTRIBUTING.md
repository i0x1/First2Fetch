# Contributing to First 2 Fetch

Thanks for helping improve the project. Keep changes focused, tested, and easy to review.

## Setup

1. Install Node.js 22, pnpm 10, Docker Desktop, and the Supabase CLI.
2. Run `pnpm install`.
3. Copy `apps/desktopProbe/.env.example` to `apps/desktopProbe/.env`.
4. Start local Supabase from `apps/backend`.
5. Build `@first2apply/core` and `@first2apply/ui` before starting the desktop app.

The full commands are in the [README](README.md#quick-start).

## Before Opening a Pull Request

```bash
pnpm build
pnpm lint
pnpm test
```

For desktop UI work, also run:

```bash
pnpm --filter first2fetch-desktop test
pnpm --filter first2fetch-desktop test:e2e
```

## Project Rules

- Never commit `.env` files, API keys, private keys, signing certificates, resumes, exported user settings, or real user data.
- Keep renderer code behind the typed Electron IPC bridge instead of adding privileged browser or filesystem access.
- Add a migration for database changes. Do not edit an already-applied migration.
- Keep shared TypeScript types aligned with SQL functions and edge-function payloads.
- Add parser fixtures or tests when changing job-board extraction behavior.
- Use fictional data in screenshots, tests, documentation, and bug reports.
- Preserve upstream attribution when reusing or adapting upstream code.

## Commit and Pull Request Scope

Use a clear title and explain:

- What changed
- Why it changed
- How it was tested
- Any database, environment, privacy, or release impact

Large unrelated refactors should be split into separate pull requests.

## Reporting Security Problems

Do not open a public issue for a suspected vulnerability or exposed credential. Follow [SECURITY.md](SECURITY.md).
