# First 2 Fetch

A modern job board aggregator that centralizes listings from platforms like LinkedIn, Indeed, Dice, and more, helping job seekers find opportunities faster. This is an upgraded and personalized version with significant performance improvements and enhanced features.

## 🚀 Key Improvements & Enhancements

- **Performance Optimizations**: Implemented composite database indexes for faster query execution, reducing job listing load times significantly
- **Date-Based Grouping**: Enhanced UI with efficient two-phase loading - date summaries first, then jobs on-demand for better user experience
- **Timezone-Aware Filtering**: Fixed timezone conversion issues in date filtering, ensuring accurate job listings across different time zones
- **Advanced Job Sorting**: Date-first sorting with favorites prioritized within each date, improving job discovery workflow
- **Query Performance**: Added GIN indexes for array operations and optimized composite indexes for common filter combinations
- **Batch Processing**: Implemented batch migration helpers for efficient data processing operations
- **Enhanced Database Functions**: Improved `list_jobs` and `get_job_dates_summary` functions with better filtering and timezone support

## 📋 Prerequisites

- Node.js 18+ 
- pnpm package manager
- Supabase CLI (for backend development)
- Docker (for local Supabase)

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/i0x1/First2Fetch.git
cd First2Fetch
```

### 2. Install Dependencies

   ```bash
   pnpm install
   ```

### 3. Build Shared Libraries

   ```bash
   cd libraries/core && pnpm build
   cd ../ui && pnpm build
   ```

### 4. Environment Setup

Create `.env` files by copying the existing `.env.example` files in relevant directories:
- `apps/backend/.env`
- `apps/desktopProbe/.env`

### 5. Supabase Setup (Backend Development)

   ```bash
   cd apps/backend
   npx supabase init
   npx supabase start
   ```

   The `supabase start` command will:
   - Apply all database migrations from `supabase/migrations/`
- Load seed data from `supabase/seed.sql`
- Display service URLs:
  - **Studio Dashboard**: http://127.0.0.1:54323
     - **API URL**: http://127.0.0.1:54321
     - **Database URL**: postgresql://postgres:postgres@127.0.0.1:54322/postgres
   
**Check status:**
   ```bash
   cd apps/backend
   npx supabase status
   ```

   **Database Migrations:**
- All schema changes are versioned in `supabase/migrations/`
- Create new migration: `npx supabase migration new your_migration_name`
- Apply to remote: `npx supabase db push`

### 6. Run Applications

   **Desktop Application:**
   ```bash
   cd apps/desktopProbe
   npm start
   ```

**Backend Edge Functions:**
   ```bash
cd apps/backend
   npx supabase functions serve
   ```

**Landing Page (Development):**
   ```bash
   cd apps/landingPage
   npm run dev
   ```

## 🌐 Deploying Landing Page to GitHub Pages

The landing page can be deployed as a static site to GitHub Pages:

### Step 1: Configure Next.js for Static Export

Update `apps/landingPage/next.config.mjs`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  basePath: process.env.NODE_ENV === 'production' ? '/First2Fetch' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/First2Fetch' : '',
};

export default nextConfig;
```

### Step 2: Build Static Site

```bash
cd apps/landingPage
npm run build
```

This creates a `out` directory with static files.

### Step 3: Deploy to GitHub Pages

**Option A: Using GitHub Actions (Recommended)**

1. Create `.github/workflows/deploy-pages.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - master
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'
      - run: pnpm install
      - run: cd libraries/core && pnpm build
      - run: cd libraries/ui && pnpm build
      - run: cd apps/landingPage && npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: apps/landingPage/out

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

2. Enable GitHub Pages in repository settings:
   - Go to Settings → Pages
   - Source: GitHub Actions
   - Save

**Option B: Manual Deployment**

1. Build the static site:
```bash
cd apps/landingPage
npm run build
```

2. Copy the `out` directory contents to a `gh-pages` branch:
```bash
git checkout -b gh-pages
git rm -rf .
cp -r apps/landingPage/out/* .
git add .
git commit -m "Deploy to GitHub Pages"
git push origin gh-pages
```

3. Enable GitHub Pages:
   - Go to Settings → Pages
   - Source: Deploy from a branch
   - Branch: `gh-pages` / `root`
   - Save

Your site will be available at: `https://i0x1.github.io/First2Fetch/`

## 🏗️ Project Structure

This is a monorepo using Nx:

- **apps/**
  - `backend`: Supabase configuration, migrations, and edge functions
  - `desktopProbe`: Electron desktop application
  - `landingPage`: Marketing landing page (Next.js)
  - `blog`: Project blog
  - `invoiceDownloader`: Utility for downloading invoices
  - `nodeBackend`: Additional Node.js backend services
- **libraries/**: Shared code and utilities

## 🧪 Development

This project uses **Nx** for task management:

```bash
# Run dev server
pnpm nx start <project-name>

# Build
pnpm nx build <project-name>

# Test
pnpm nx test <project-name>

# Lint
pnpm nx lint <project-name>
```

## 📦 Release

### Desktop Application

Update version in `apps/desktopProbe/package.json` and `.appx` manifest.

**macOS:**
```bash
cd apps/desktopProbe
npm run package
```

**Windows:**
```bash
cd apps/desktopProbe
npm run make
```

## 🔧 Adding New AI Providers and Models

The application supports multiple AI providers (OpenAI, Google Gemini) with a centralized configuration system.

### Quick Start: Adding a New Model

1. **Update Backend Config** (`apps/backend/supabase/functions/_shared/aiProviderConfig.ts`)
2. **Update Frontend Config** (`apps/desktopProbe/src/lib/aiProviderConfig.ts`)

See the original documentation for detailed steps on adding providers and models.

### Security Notes

- API keys are encrypted using AES encryption with pgcrypto
- Encryption uses a combination of user_id and a database secret
- API keys are never returned to the frontend after saving
- Decryption only happens in backend edge functions with proper permissions

## 📝 License

MIT License

---

**Note**: This project is an upgraded and personalized version inspired by [First 2 Apply](https://first2apply.com/). It includes significant performance improvements, enhanced database functions, and optimized query patterns for better user experience.
