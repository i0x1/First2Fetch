import { AdvancedMatchingConfig, DbSchema, Job, JobStatus, throwError } from '@first2apply/core';
import { SupabaseClient } from '@supabase/supabasefork';
import { z } from 'zod';

import { buildAIProviderFromUserConfig, logAiUsage } from './aiProvider.ts';
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
}): Promise<{ newStatus: JobStatus; excludeReason?: string }> {
  logger.info(`applying advanced matching filters to job ${job.id} ...`);
  // check if the user has advanced matching enabled
  const { hasAdvancedMatching } = await checkUserSubscription({
    supabaseAdminClient,
    userId: job.user_id,
  });
  if (!hasAdvancedMatching) {
    logger.info('user does not have advanced matching enabled');
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
    logger.info(`advanced matching config not found for user ${job.user_id}`);
    return { newStatus: 'new' };
  }

  if (isFavoriteCompany({ companyName: job.companyName, advancedMatching })) {
    logger.info(`job marked as favorite due to company name: ${job.companyName}`);
  }

  // exclude jobs from specific companies if it fully matches the entire company name
  if (isExcludedCompany({ companyName: job.companyName, advancedMatching })) {
    logger.info(`job excluded due to company name: ${job.companyName}`);
    return {
      newStatus: 'excluded_by_advanced_matching',
      excludeReason: `${job.companyName} is blacklisted.`,
    };
  }

  // prompt AI to determine if the job should be excluded
  if (job.description && advancedMatching.chatgpt_prompt) {
    logger.info('prompting AI to determine if the job should be excluded ...');

    const { exclusionDecision } = await promptAI({
      prompt: advancedMatching.chatgpt_prompt,
      job,
      logger,
      supabaseAdminClient,
    });

    if (exclusionDecision.excluded) {
      logger.info(`job excluded by AI: ${exclusionDecision.reason}`);
      return {
        newStatus: 'excluded_by_advanced_matching',
        excludeReason: exclusionDecision.reason ?? undefined,
      };
    }
  }

  logger.info('job passed all advanced matching filters');
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
}) {
  // Try to use user's configured AI provider
  const userProvider = await buildAIProviderFromUserConfig({
    supabaseAdminClient,
    userId: job.user_id,
    logger,
  });

  // User must provide their own API key - no fallback to Azure
  if (!userProvider) {
    throw new Error(
      'No AI provider configured. Please configure your AI API key in Settings to use advanced job matching.',
    );
  }

  // Use user's configured provider
  const provider = userProvider.provider;
  const llmConfig = userProvider.config;

  const aiResponse = await provider.createChatCompletion({
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: generateUserPrompt({
          prompt,
          job,
        }),
      },
    ],
    maxCompletionTokens: 300,
    responseFormat: { type: 'json_object' },
  });

  const response = {
    usage: aiResponse.usage,
    content: aiResponse.content,
  };

  // Parse the response
  const exclusionDecision = JobExclusionFormat.parse(JSON.parse(response.content));

  // Persist the cost of the AI API call
  await logAiUsage({
    logger,
    supabaseAdminClient,
    forUserId: job.user_id,
    llmConfig,
    response,
  });

  return {
    exclusionDecision,
  };
}

/**
 * Generate the user prompt for the AI API.
 */
function generateUserPrompt({ prompt, job }: { prompt: string; job: Job }) {
  return `Here are my requirements for job filtering:
${prompt}

Job Title: ${job.title}
Company: ${job.companyName}
Location: ${job.location ?? 'Not specified'}
Tags: ${job?.tags?.join(', ') ?? 'None'}
Job Description:
${job.description}

Should this job be excluded from my feed? Return JSON only.`;
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
