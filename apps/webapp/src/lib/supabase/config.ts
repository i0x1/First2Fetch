export function supabaseConfig(env: NodeJS.ProcessEnv = process.env) {
  const url = env.SUPABASE_URL?.trim();
  const key = (env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY)?.trim();
  if (!url || !key) throw new Error('Set SUPABASE_URL and a public SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY.');
  if (!['https:', 'http:'].includes(new URL(url).protocol)) throw new Error('SUPABASE_URL must use HTTPS or HTTP.');
  if (key.startsWith('sb_secret_')) throw new Error('The web companion requires a public Supabase key.');
  if (key.split('.').length === 3) {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    if (payload.role === 'service_role') throw new Error('The web companion must not use a service-role key.');
  }
  return { url, key };
}
