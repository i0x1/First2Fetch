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
   The `supabase start` command will:
   - Apply all database migrations from `supabase/migrations/`
   - Load seed data from `supabase/seed.sql` (includes initial sites data)
   - Display all service URLs including:
     - **Studio URL (Dashboard)**: http://127.0.0.1:54333
     - **API URL**: http://127.0.0.1:54331
     - **Database URL**: postgresql://postgres:postgres@127.0.0.1:54332/postgres
   
   If Supabase is already running, you can check the status and view URLs with:
   ```bash
   cd apps/backend
   npx supabase status
   ```
   
   To reset the database and reapply all migrations and seed data:
   ```bash
   cd apps/backend
   npx supabase db reset
   ```

   **Database Migrations:**
   
   This project follows Supabase best practices for database schema management:
   - **Migrations** (`supabase/migrations/`): All schema changes (tables, functions, triggers, etc.) are versioned in migration files
   - **Seed Data** (`supabase/seed.sql`): Contains only data insertions (e.g., initial sites data)
   
   To create a new migration:
   ```bash
   cd apps/backend
   npx supabase migration new your_migration_name
   ```
   
   To apply migrations to a remote project:
   ```bash
   cd apps/backend
   npx supabase db push
   ```
   
   To see differences between local and remote schema:
   ```bash
   cd apps/backend
   npx supabase db diff
   ```

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

## Adding New AI Providers and Models

The application supports multiple AI providers (OpenAI, Google Gemini) with a centralized configuration system that makes adding new providers or models straightforward.

### Quick Start: Adding a New Model (Easiest)

**Just 2 steps:**

1. **Update Backend Config** (`apps/backend/supabase/functions/_shared/aiProviderConfig.ts`):
   ```typescript
   export const AI_PROVIDER_CONFIG: Record<ProviderName, ProviderConfig> = {
     openai: {
       // ... existing config
       models: {
         // ... existing models
         'new-model-name': { 
           input: 0.5,      // Cost per million input tokens
           output: 1.5,     // Cost per million output tokens
           label: 'New Model Name',
           isBudget: true,  // Optional: mark budget models
         },
       },
     },
   };
   ```

2. **Update Frontend Config** (`apps/desktopProbe/src/lib/aiProviderConfig.ts`):
   ```typescript
   export const AI_PROVIDER_CONFIG: Record<ProviderName, ProviderOption> = {
     openai: {
       // ... existing config
       models: [
         // ... existing models
         { value: 'new-model-name', label: 'New Model Name', isBudget: true },
       ],
     },
   };
   ```

That's it! The model will automatically appear in the UI.

### Adding a New Provider

**4 Simple Steps:**

1. **Update Configuration Files** (2 files to update):
   
   **Backend** (`apps/backend/supabase/functions/_shared/aiProviderConfig.ts`):
   ```typescript
   // Add to ProviderName type
   export type ProviderName = 'openai' | 'google_gemini' | 'your_new_provider';
   
   // Add provider config
   export const AI_PROVIDER_CONFIG: Record<ProviderName, ProviderConfig> = {
     // ... existing providers
     your_new_provider: {
       name: 'your_new_provider',
       displayName: 'Your Provider Name',
       models: {
         'model-1': { input: 1.0, output: 2.0, label: 'Model 1' },
       },
     },
   };
   ```
   
   **Frontend** (`apps/desktopProbe/src/lib/aiProviderConfig.ts`):
   ```typescript
   // Add to ProviderName type (same as backend)
   export type ProviderName = 'openai' | 'google_gemini' | 'your_new_provider';
   
   // Add provider config
   export const AI_PROVIDER_CONFIG: Record<ProviderName, ProviderOption> = {
     // ... existing providers
     your_new_provider: {
       value: 'your_new_provider',
       label: 'Your Provider Name',
       models: [
         { value: 'model-1', label: 'Model 1' },
       ],
     },
   };
   ```

2. **Update Database Constraint** (`apps/backend/supabase/seed.sql`):
   ```sql
   -- Find the check_ai_provider constraint and add your provider
   constraint check_ai_provider check (
     ai_provider is null or ai_provider in ('openai', 'google_gemini', 'your_new_provider')
   )
   ```

3. **Implement Provider Class** (`apps/backend/supabase/functions/_shared/aiProvider.ts`):
   ```typescript
   class YourNewProvider implements AIProvider {
     private client: YourProviderClient;
     private config: LLMConfig;
     
     constructor(config: AIProviderConfig) {
       if (config.provider !== 'your_new_provider') {
         throw new Error('Invalid provider');
       }
       
       const modelConfig = getModelConfig('your_new_provider', config.model);
       if (!modelConfig) {
         throw new Error(`Unsupported model: ${config.model}`);
       }
       
       this.client = new YourProviderClient({ apiKey: config.apiKey });
       this.config = {
         model: config.model,
         costPerMillionInputTokens: modelConfig.input,
         costPerMillionOutputTokens: modelConfig.output,
       };
     }
     
     async createChatCompletion(params: {
       messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
       maxCompletionTokens?: number;
       responseFormat?: { type: 'json_object' };
     }): Promise<AIResponse> {
       // Implement API call to your provider
       // Return format: { usage: {...}, content: string }
     }
     
     getConfig(): LLMConfig {
       return this.config;
     }
   }
   
   // Add to buildAIProvider function:
   case 'your_new_provider':
     return new YourNewProvider(config);
   ```

4. **Add Package Dependency** (`apps/backend/supabase/functions/_shared/deno.json`):
   ```json
   {
     "imports": {
       "your-provider-sdk": "npm:your-provider-sdk@version"
     }
   }
   ```

### Configuration File Locations

All provider and model configurations are centralized in two files:
- **Backend**: `apps/backend/supabase/functions/_shared/aiProviderConfig.ts`
- **Frontend**: `apps/desktopProbe/src/lib/aiProviderConfig.ts`

**Important**: Keep both files in sync when adding providers or models. The structure should match, but backend includes cost information while frontend includes display labels.

### Security Notes

- API keys are encrypted using AES encryption with pgcrypto
- Encryption uses a combination of user_id and a database secret
- Set the encryption secret in production: `ALTER DATABASE postgres SET app.encryption_secret = 'your-secret-key';`
- API keys are never returned to the frontend after saving
- Decryption only happens in backend edge functions with proper permissions

### Cost Tracking

Each model should have cost per million tokens configured for accurate usage tracking. Update the `PROVIDER_MODELS` object with current pricing from the provider's documentation.
