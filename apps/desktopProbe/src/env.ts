import { config as loadDotenv } from 'dotenv';
import fs from 'fs';
import path from 'path';

// Main bundle runs from `.webpack/main`; `.env` lives next to `forge.config.ts`.
function loadLocalEnvOnce() {
  const candidates = [
    path.join(__dirname, '..', '..', '.env'),
    path.join(process.cwd(), '.env'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      loadDotenv({ path: p });
      return;
    }
  }
}

loadLocalEnvOnce();

export const ENV = {
  nodeEnv: process.env.NODE_ENV,
  appBundleId: process.env.APP_BUNDLE_ID,
  logLevel: process.env.DESKTOP_LOG_LEVEL ?? process.env.LOG_LEVEL,
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
  },
  mezmoApiKey: process.env.MEZMO_API_KEY,
  amplitudeApiKey: process.env.AMPLITUDE_API_KEY,
};
