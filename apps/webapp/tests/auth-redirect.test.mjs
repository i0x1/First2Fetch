import assert from 'node:assert/strict';
import { test as nodeTest } from 'node:test';
import { authRedirectUrl } from '../src/lib/authRedirect.ts';
import { supabaseConfig } from '../src/lib/supabase/config.ts';

nodeTest('login redirects stay on the configured app and preserve internal paths', () => {
  assert.equal(authRedirectUrl('http://localhost:3002/auth/callback', '/team', 'https://apply.pritk.com').href, 'https://apply.pritk.com/team');
  for (const path of [null, 'https://example.com', '//example.com', '/\\example.com']) {
    assert.equal(authRedirectUrl('http://localhost:3002/auth/callback', path).href, 'http://localhost:3002/jobs/new');
  }
});

nodeTest('web config accepts public keys and rejects privileged keys', () => {
  assert.equal(supabaseConfig({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example' }).key, 'sb_publishable_example');
  assert.throws(() => supabaseConfig({}), /Set SUPABASE_URL/);
  assert.throws(() => supabaseConfig({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'sb_secret_test' }), /public Supabase key/);
  const payload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
  assert.throws(() => supabaseConfig({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: `header.${payload}.signature` }), /service-role key/);
});
