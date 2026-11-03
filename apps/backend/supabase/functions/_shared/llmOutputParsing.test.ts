import { Job } from '@first2apply/core';
import { applyAdvancedMatchingFilters } from './advancedMatching.ts';
import { parseCustomJobs, parseCustomJobDescription } from './customJobsParser.ts';

const logger = { debug() {}, info() {}, warn() {}, error(m: string) { console.error(m); }, addMeta() {}, flush() {} };

function fakeSupabase(provider: string, model: string) {
  const rows: Record<string, unknown> = {
    profiles: { user_id: 'u1', subscription_tier: 'pro', subscription_end_date: '2099-01-01' },
    advanced_matching: {
      user_id: 'u1', chatgpt_prompt: 'Exclude jobs requiring Python.', blacklisted_companies: [], favorite_companies: [],
      ai_provider: provider, ai_model: model, ai_api_key_encrypted: 'enc', ai_api_keys_encrypted: null,
    },
  };
  const chain = (table: string) => {
    const q: any = {
      select: () => q, eq: () => q,
      single: async () => ({ data: rows[table], error: null }),
      maybeSingle: async () => ({ data: rows[table], error: null }),
      then: (res: any) => res({ data: [rows[table]], error: null }),
    };
    return q;
  };
  return {
    from: chain,
    rpc: async (name: string) => ({ data: name === 'decrypt_api_key' ? 'fake-key' : null, error: null }),
  } as any;
}

let llmContent = '';
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('generativelanguage.googleapis.com')) {
    return new Response(JSON.stringify({
      candidates: [{ content: { role: 'model', parts: [{ text: llmContent }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.includes('/chat/completions')) {
    return new Response(JSON.stringify({
      id: 'x', object: 'chat.completion', created: 0, model: 'gpt-4o-mini',
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: llmContent } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(input, init);
}) as typeof fetch;

const job = { id: 1, user_id: 'u1', title: 'Engineer', companyName: 'Acme', description: 'Needs Python.', tags: [] } as unknown as Job;

for (const [provider, model] of [['openai', 'gpt-4o-mini'], ['google_gemini', 'gemini-2.5-flash']]) {
  Deno.test(`advanced matching parses ${provider} exclusion`, async () => {
    llmContent = JSON.stringify({ excluded: true, reason: 'Requires Python' });
    const r = await applyAdvancedMatchingFilters({ logger, supabaseClient: fakeSupabase(provider, model), supabaseAdminClient: fakeSupabase(provider, model), job });
    if (r.newStatus !== 'excluded_by_advanced_matching' || r.excludeReason !== 'Requires Python') throw new Error(JSON.stringify(r));
  });
  Deno.test(`advanced matching keeps job with null reason (${provider})`, async () => {
    llmContent = JSON.stringify({ excluded: false, reason: null });
    const r = await applyAdvancedMatchingFilters({ logger, supabaseClient: fakeSupabase(provider, model), supabaseAdminClient: fakeSupabase(provider, model), job });
    if (r.newStatus !== 'new') throw new Error(JSON.stringify(r));
  });
  Deno.test(`advanced matching rejects malformed output (${provider})`, async () => {
    llmContent = JSON.stringify({ excluded: 'yes' });
    let threw = false;
    try { await applyAdvancedMatchingFilters({ logger, supabaseClient: fakeSupabase(provider, model), supabaseAdminClient: fakeSupabase(provider, model), job }); } catch { threw = true; }
    if (!threw) throw new Error('expected zod parse failure');
  });
}

Deno.test('custom jobs parser: preprocess, url refine, enum, nullable', async () => {
  llmContent = JSON.stringify({
    jobs: [
      { externalUrl: 'http://example.com/jobs/1', title: 'Backend Engineer', companyName: 'Acme', jobType: 'Fully Remote', location: null, tags: ['go'], description: null },
    ],
    errorMessage: null,
  });
  const sb = fakeSupabase('openai', 'gpt-4o-mini');
  const r: any = await parseCustomJobs({ siteId: 1, html: '<html><body><div>Backend Engineer at Acme</div></body></html>', url: 'https://example.com/jobs', user: { id: 'u1' } as any, logger, supabaseAdminClient: sb });
  const j = r.jobs[0];
  if (!j || !j.externalUrl.startsWith('https://example.com/jobs/1') || j.jobType !== 'remote') throw new Error(JSON.stringify(r));
});

Deno.test('custom job description parser', async () => {
  llmContent = JSON.stringify({ description: 'A long enough job description text here.', summary: null, salary: '$100k', tags: ['go'], errorMessage: null });
  const sb = fakeSupabase('openai', 'gpt-4o-mini');
  const r: any = await parseCustomJobDescription({ html: '<html><body>desc</body></html>', user: { id: 'u1' } as any, logger, supabaseAdminClient: sb } as any);
  if (r.description !== 'A long enough job description text here.' || r.salary !== '$100k') throw new Error(JSON.stringify(r));
});
