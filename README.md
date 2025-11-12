# First 2 Apply

First 2 Apply (https://first2apply.com/) is an open-source job board aggregator that centralizes listings from platforms like LinkedIn, Indeed, Dice, and more, helping job seekers find opportunities faster.
Watch demo [video](https://www.youtube.com/watch?v=9-OYPBhwYG8).

## Installation

This is a monorepo containing multiple applications and shared libraries. Follow these steps to set up the development environment:

### Prerequisites
- Node.js 18+ 
- pnpm package manager

### Setup Instructions

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Build shared libraries**
   ```bash
   cd libraries/core && pnpm build
   cd ../ui && pnpm build
   ```

3. **Set up environment files**
   Create `.env` files by copying the existing `.env.example` files in relevant directories.

4. **Set up Supabase (for backend development)**
   ```bash
   cd apps/backend
   npx supabase init
   npx supabase start
   ```
   The `supabase start` command will display all service URLs including:
   - **Studio URL (Dashboard)**: http://127.0.0.1:54333
   - **API URL**: http://127.0.0.1:54331
   - **Database URL**: postgresql://postgres:postgres@127.0.0.1:54332/postgres
   
   If Supabase is already running, you can check the status and view URLs with:
   ```bash
   cd apps/backend
   npx supabase status
   ```
   
   Import the [sites_rows.csv](./apps/backend/supabase/sites_rows.csv) file into the `sites` table using the Studio interface.

5. **Run applications**

   **Desktop Application:**
   ```bash
   cd apps/desktopProbe
   npm start
   ```

   **Backend Edge Functions (optional):**
   ```bash
   npx supabase functions serve
   ```

   **Landing Page (optional):**
   ```bash
   cd apps/landingPage
   npm run dev
   ```

## Release

First, update the version in `package.json` and also in the `.appx` manifest.

### MacOS
Forge supports automatically uploading the packaged app to S3, but unfortunately the download link is broken because we have whitespaces in the app name. So make sure to edit the generated `REALEASES.json` file with the actual link from S3 and upload it again

Run `npm run package` to test a production build locally first. Don't forget to uncomment the prov ENV vars in the desktop probe.

If everything is ok, then run `npm run publish` to upload a new prod build

To build the x64 version for Intel macs run `npm run publish -- --arch x64`.

### Windows
Updates are handled via the Microsoft store so just build a new AppX and submit it there. The auto-updater only checks the `RELEASES.json` to display a notification that a new version is available

Run `npm run make` to build a new AppX bundle. Upload it manually to the Windows Store.

Add a new version entry to the releases json file from S3.

### Linux
We have to manually upload the `.deb` file to S3 and also manually update the `RELEASES.json` file with the new version.
