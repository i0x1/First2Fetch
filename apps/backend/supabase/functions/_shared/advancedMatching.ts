import { AdvancedMatchingConfig, DbSchema, getModelConfig, Job, JobStatus, throwError } from '@first2apply/core';
import { SupabaseClient } from '@supabase/supabasefork';
import { z } from 'zod';

import { buildAIProvider, logAiUsage, resolveUserAiConfigForTask } from './aiProvider.ts';
import { truncateJobDescriptionForFilter } from './aiHtmlLimits.ts';
import { decideJobExclusionWithTypeSafe } from './jobDecisionProvider.ts';
import { ILogger } from './logger.ts';
import { checkUserSubscription } from './subscription.ts';

/**
 * Apply all the advanced matching rules to the given job and
 * determine if it should be excluded from the user's feed.
 */
export async function applyAdvancedMatchingFilters({
  logger,
  supabaseClient,
  supabaseAdminClient,
  job,
}: {
  logger: ILogger;
  supabaseClient: SupabaseClient<DbSchema, 'public'>;
  supabaseAdminClient: SupabaseClient<DbSchema, 'public'>;
  job: Job;
}): Promise<{
  newStatus: JobStatus;
  excludeReason?: string;
}> {
  logger.debug('advanced matching started', { jobId: job.id });
  // check if the user has advanced matching enabled
  const { hasAdvancedMatching } = await checkUserSubscription({
    supabaseAdminClient,
    userId: job.user_id,
  });
  if (!hasAdvancedMatching) {
    logger.debug('advanced matching skipped', { jobId: job.id, reason: 'subscription_disabled' });
    return { newStatus: 'new' };
  }

  // load the advanced matching config for this user
  const { data: advancedMatchingArr, error: getAdvancedMatchingErr } = await supabaseClient
    .from('advanced_matching')
    .select('*')
    .eq('user_id', job.user_id);
  if (getAdvancedMatchingErr) {
    throw getAdvancedMatchingErr;
  }
  const advancedMatching: AdvancedMatchingConfig = advancedMatchingArr?.[0];
  if (!advancedMatching) {
    logger.debug('advanced matching skipped', { jobId: job.id, reason: 'missing_config' });
    return { newStatus: 'new' };
  }

  if (isFavoriteCompany({ companyName: job.companyName, advancedMatching })) {
    logger.debug('advanced matching favorite company', { jobId: job.id, companyName: job.companyName });
  }

  // exclude jobs from specific companies if it fully matches the entire company name
  if (isExcludedCompany({ companyName: job.companyName, advancedMatching })) {
    logger.info('job excluded by company blacklist', { jobId: job.id, companyName: job.companyName });
    return {
      newStatus: 'excluded_by_advanced_matching',
      excludeReason: `${job.companyName} is blacklisted.`,
    };
  }

  // prompt AI to determine if the job should be excluded
  if (job.description && advancedMatching.chatgpt_prompt) {
    logger.debug('advanced matching ai check started', { jobId: job.id });

    const { exclusionDecision } = await promptAI({
      prompt: advancedMatching.chatgpt_prompt,
      job,
      logger,
      supabaseAdminClient,
    });

    if (exclusionDecision.excluded) {
      logger.info('job excluded by AI filter', { jobId: job.id, reason: exclusionDecision.reason });
      return {
        newStatus: 'excluded_by_advanced_matching',
        excludeReason: exclusionDecision.reason ?? undefined,
      };
    }
    return { newStatus: 'new' };
  }

  logger.debug('advanced matching passed', { jobId: job.id });
  return { newStatus: 'new' };
}

/**
 * Check if the company name is excluded by the advanced matching filters.
 */
export function isExcludedCompany({
  companyName,
  advancedMatching,
}: {
  companyName: string;
  advancedMatching: AdvancedMatchingConfig;
}): boolean {
  const excludedCompanies = advancedMatching.blacklisted_companies.map((c) => c.toLowerCase());
  const lowerCaseCompanyName = companyName.toLowerCase();
  return excludedCompanies.some((c) => lowerCaseCompanyName === c);
}

export function isFavoriteCompany({
  companyName,
  advancedMatching,
}: {
  companyName: string;
  advancedMatching: AdvancedMatchingConfig;
}): boolean {
  const favoriteCompanies = advancedMatching.favorite_companies.map((c) => c.toLowerCase());
  const lowerCaseCompanyName = companyName.toLowerCase();
  return favoriteCompanies.some((c) => lowerCaseCompanyName === c);
}

/**
 * Prompt the AI API to interogate if a job matches the user prompt.
 * Returns true if the job should be excluded, false otherwise.
 * Uses user's configured AI provider if available, otherwise falls back to default.
 */
async function promptAI({
  prompt,
  job,
  logger,
  supabaseAdminClient,
}: {
  job: Job;
  prompt: string;
  logger: ILogger;
  supabaseAdminClient: SupabaseClient<DbSchema, 'public'>;
}): Promise<{ exclusionDecision: z.infer<typeof JobExclusionFormat> }> {
  // Try to use user's configured AI provider
  const userProvider = await resolveUserAiConfigForTask({
    supabaseAdminClient,
    userId: job.user_id,
    task: 'jd_filter',
    logger,
  });

  // User must provide their own API key - no fallback to Azure
  if (!userProvider) {
    throw new Error(
      'No AI provider configured. Please configure your AI API key in Settings to use advanced job matching.',
    );
  }

  // Use user's configured provider
  if (userProvider.provider === 'typesafe') {
    const decision = await decideJobExclusionWithTypeSafe({
      apiKey: userProvider.apiKey,
      model: userProvider.model,
      prompt,
      job,
    });
    const modelConfig = getModelConfig('typesafe', userProvider.model)!;
    await logAiUsage({
      logger,
      supabaseAdminClient,
      forUserId: job.user_id,
      llmConfig: {
        model: userProvider.model,
        costPerMillionInputTokens: modelConfig.input,
        costPerMillionOutputTokens: 0,
      },
      response: { content: '', usage: { prompt_tokens: decision.inputTokens, completion_tokens: 0 } },
    });
    logger.info('TypeSafe job decision', { jobId: job.id, model: userProvider.model, probability: decision.probability });
    return { exclusionDecision: { excluded: decision.excluded, reason: decision.reason } };
  }

  const provider = buildAIProvider(userProvider);
  const llmConfig = provider.getConfig();

  const generatedUserPrompt = generateUserPrompt({ prompt, job });
  const aiResponse = await provider.createChatCompletion({
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: generatedUserPrompt.content,
      },
    ],
    maxCompletionTokens: 300,
    responseFormat: { type: 'json_object' },
  });

  const response = {
    usage: aiResponse.usage,
    content: aiResponse.content,
  };

  // Persist usage even if the response cannot be parsed.
  await logAiUsage({
    logger,
    supabaseAdminClient,
    forUserId: job.user_id,
    llmConfig,
    response,
  });

  const exclusionDecision = JobExclusionFormat.parse(JSON.parse(response.content));

  return { exclusionDecision };
}

/**
 * Generate the user prompt for the AI API.
 */
function generateUserPrompt({ prompt, job }: { prompt: string; job: Job }) {
  const description = job.description ?? '';
  const { content: trimmedDescription, truncated } = truncateJobDescriptionForFilter(description);
  const truncationNote = truncated
    ? '\n(Note: job description was truncated for length; use the visible portion.)'
    : '';

  return { content: `Here are my requirements for job filtering:
${prompt}

Job Title: ${job.title}
Company: ${job.companyName}
Location: ${job.location ?? 'Not specified'}
Tags: ${job?.tags?.join(', ') ?? 'None'}
Job Description:
${trimmedDescription}${truncationNote}

Should this job be excluded from my feed? Return JSON only.`, truncated };
}

const SYSTEM_PROMPT = `You decide whether a job should be removed from a user's feed.

The user's requirements are the source of truth. They may change over time, so do not add extra requirements of your own.

Use these as default interpretation rules only when the user's requirements do not say otherwise:
- Avoided skills, technologies, seniority, citizenship, clearance, sponsorship, contract type, or employment type should be judged from the job title, tags, and description.
- Experience, salary, location, remote work, benefits, company culture, and working hours should be judged from the details the job actually provides.
- Missing details are neutral by default, but if the user says missing or unclear information should exclude a job, follow the user's rule.
- If a job has a range such as salary or years of experience, compare the user's requirement against that range.
- If the job clearly conflicts with the user's requirements, exclude it. If it clearly fits, keep it.

Reply with JSON only:
- excluded: boolean (true if the job should be excluded, false otherwise)
- reason: string (the reason why the job should be excluded; leave this field empty if the job should not be excluded)
- keep the reason as short as possible, maximum 20 words
`;

const JobExclusionFormat = z.object({
  excluded: z.boolean(),
  reason: z.string().optional().nullable().nullable(),
});
