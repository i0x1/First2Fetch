# First 2 Fetch Website

Static Next.js website for the First 2 Fetch project.

## Development

```bash
pnpm --filter @first2fetch/landing-page dev
```

Open `http://localhost:3000/First2Fetch/`.

## Production Build

```bash
pnpm --filter @first2fetch/landing-page build
```

The static export is written to `apps/landingPage/out` and deployed by `.github/workflows/deploy-pages.yml`.

All product previews use fictional demonstration data. Do not add real user details, search history, credentials, or resumes to website assets.
