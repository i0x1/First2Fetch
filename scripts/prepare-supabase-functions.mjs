import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep generated deployment sources within the CLI's upload boundary.
// The application and core library remain single sources in the repository.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist/supabase-deploy');
const source = path.join(root, 'apps/backend/supabase');
const functions = ['scan-job-description', 'scan-urls', 'invite-workspace-member'];
mkdirSync(path.join(output, 'supabase/functions'), { recursive: true });
cpSync(path.join(source, 'config.toml'), path.join(output, 'supabase/config.toml'));
cpSync(path.join(source, 'functions/_shared'), path.join(output, 'supabase/functions/_shared'), { recursive: true });
cpSync(path.join(root, 'libraries/core/src'), path.join(output, 'supabase/functions/_core'), { recursive: true });
for (const name of ['', ...functions]) {
  const from = path.join(source, 'functions', name);
  const to = path.join(output, 'supabase/functions', name);
  if (name) cpSync(from, to, { recursive: true });
  const localConfig = path.join(from, 'deno.json');
  const config = existsSync(localConfig) ? localConfig : path.join(source, 'functions/deno.json');
  if (existsSync(config)) {
    const json = JSON.parse(readFileSync(config, 'utf8'));
    json.imports['@first2apply/core'] = name ? '../_core/index.deno.ts' : './_core/index.deno.ts';
    writeFileSync(path.join(to, 'deno.json'), JSON.stringify(json, null, 2) + '\n');
  }
}
console.log(`Prepared function sources: ${output}`);
