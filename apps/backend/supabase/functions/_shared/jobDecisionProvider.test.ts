import { Job } from '@first2apply/core';

import { decideJobExclusionWithTypeSafe } from './jobDecisionProvider.ts';

const job = {
  title: 'Senior Engineer',
  companyName: 'Example',
  location: 'Remote',
  tags: ['Full time'],
  description: 'Requires Python and five years of experience.',
} as Job;

Deno.test('Jev receives saved rules and job facts, then returns a compatible exclusion', async () => {
  let request: Record<string, unknown> | undefined;
  const fetchImpl: typeof fetch = async (_url, init) => {
    request = JSON.parse((init as { body: string }).body);
    return new Response(JSON.stringify({
      model: 'jev-1.13.0',
      answers: { exclude: { type: 'noul', noul: 0.96 } },
      usage: { input_tokens: 321, output_tokens: 12 },
    }), { status: 200 });
  };
  const result = await decideJobExclusionWithTypeSafe({
    apiKey: 'test-key', model: 'jev-1.13.0', prompt: 'Exclude jobs that require Python.', job, fetchImpl,
  });
  if (!result.excluded || result.reason !== 'Excluded by TypeSafe jev-1.13.0' || result.inputTokens !== 321) {
    throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
  }
  const state = request?.state as Record<string, unknown>;
  if (state.user_requirements !== 'Exclude jobs that require Python.' || (state.job as Record<string, unknown>).description !== job.description) {
    throw new Error('The request lost the saved rules or job description');
  }
  if ((request?.questions as Record<string, Record<string, unknown>>).exclude.type !== 'noul') {
    throw new Error('Expected a typed decision question');
  }
});

Deno.test('Jev keeps uncertain jobs to avoid unsupported exclusions', async () => {
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
    model: 'jev-1.13.0',
    answers: { exclude: { type: 'noul', noul: 0.55 } },
    usage: { input_tokens: 321, output_tokens: 12 },
  }), { status: 200 });
  const result = await decideJobExclusionWithTypeSafe({
    apiKey: 'test-key', model: 'jev-1.13.0', prompt: 'Exclude Python jobs.', job, fetchImpl,
  });
  if (result.excluded || result.reason) throw new Error('An uncertain job was excluded');
});
