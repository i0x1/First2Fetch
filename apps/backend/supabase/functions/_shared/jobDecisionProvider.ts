import { getModelConfig, Job } from '@first2apply/core';
import { z } from 'zod';

import { truncateJobDescriptionForFilter } from './aiHtmlLimits.ts';

const TypeSafeResponse = z.object({
  model: z.string(),
  answers: z.object({ exclude: z.object({ type: z.literal('noul'), noul: z.number().min(0).max(1) }) }),
  usage: z.object({ input_tokens: z.number().nonnegative(), output_tokens: z.number().nonnegative() }),
});

export const JEV_EXCLUSION_THRESHOLD = 0.9;

/** A decision model shares the user's rules and job facts with chat filters, but uses a typed question. */
export async function decideJobExclusionWithTypeSafe({
  apiKey,
  model,
  prompt,
  job,
  fetchImpl = fetch,
}: {
  apiKey: string;
  model: string;
  prompt: string;
  job: Job;
  fetchImpl?: typeof fetch;
}): Promise<{ excluded: boolean; reason?: string; probability: number; inputTokens: number }> {
  if (!getModelConfig('typesafe', model)) throw new Error(`Unsupported TypeSafe model: ${model}`);
  const description = truncateJobDescriptionForFilter(job.description ?? '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let response: Response;
  try {
    response = await fetchImpl('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        state: {
          user_requirements: prompt,
          job: {
            title: job.title,
            company: job.companyName,
            location: job.location ?? 'Not specified',
            tags: job.tags ?? [],
            description: description.content,
            description_truncated: description.truncated,
          },
        },
        questions: {
          exclude: {
            type: 'noul',
            instructions: 'Does this job clearly conflict with the user requirements and need to be excluded from the feed?',
            criteria: {
              true: 'The job clearly violates a requirement stated by the user. Follow any user rule that excludes missing or unclear details.',
              false: 'The job fits the user requirements, or the evidence is missing or unclear and the user did not ask to exclude such jobs. Do not add requirements.',
            },
          },
        },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`TypeSafe decision request failed: HTTP ${response.status}`);
  const result = TypeSafeResponse.parse(await response.json());
  const probability = result.answers.exclude.noul;
  const excluded = probability >= JEV_EXCLUSION_THRESHOLD;
  return {
    excluded,
    reason: excluded ? `Excluded by TypeSafe ${result.model}` : undefined,
    probability,
    inputTokens: result.usage.input_tokens,
  };
}
