import { AdvancedMatchingConfig, DbSchema, Job, JobStatus, throwError } from '@first2apply/core';
import { SupabaseClient } from '@supabase/supabasefork';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import { buildAIProviderFromUserConfig, logAiUsage } from './aiProvider.ts';
import { ILogger } from './logger.ts';
import { buildOpenAiClient } from './openAI.ts';
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

  let provider: any;
  let llmConfig: any;
  let response: any;

  if (userProvider) {
    // Use user's configured provider
    provider = userProvider.provider;
    llmConfig = userProvider.config;

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
      maxCompletionTokens: 3000,
      responseFormat: { type: 'json_object' },
    });

    response = {
      usage: aiResponse.usage,
      content: aiResponse.content,
    };
  } else {
    // Fall back to default OpenAI client
    const { llmConfig: defaultConfig, openAi } = buildOpenAiClient({
      modelName: 'o3-mini',
    });
    llmConfig = defaultConfig;

    const openAiResponse = await openAi.chat.completions.create({
      model: llmConfig.model,
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
      max_tokens: 3000,
      response_format: zodResponseFormat(JobExclusionFormat, 'JobExclusion'),
    });

    const choice = openAiResponse.choices[0];
    if (choice.finish_reason !== 'stop') {
      throw new Error(`AI response did not finish: ${choice.finish_reason}`);
    }

    response = {
      usage: openAiResponse.usage,
      content: choice.message.content ?? throwError('missing content'),
    };
  }

  // Parse the response
  const exclusionDecision = JobExclusionFormat.parse(JSON.parse(response.content));

  // Persist the cost of the AI API call
  await logAiUsage({
    logger,
    supabaseAdminClient,
    forUserId: job.user_id,
    llmConfig,
    response: {
      usage: response.usage,
    },
  });

  return {
    exclusionDecision,
  };
}

/**
 * Generate the user prompt for the AI API.
 */
function generateUserPrompt({ prompt, job }: { prompt: string; job: Job }) {
  // - Exclude jobs with the title "Senior" or "Lead".
  // - I'm from the UK, so only want jobs that allow working remotely from the UK.
  // - Do not include jobs that require working with Python or Java.
  // - Do not want to work with Style Components.
  // - Salary should be at least $80,000 per year.
  // - I'm from the UK, so only want jobs that allow working remotely from the UK.
  // - Exclude jobs with the title "Senior" or "Lead".
  return `Here are my requirements for job filtering:
${prompt}

Job Title: ${job.title}
Location: ${job.location ?? 'Not specified'}
Tags: ${job?.tags?.join(', ') ?? 'None'}
Job Description:
${job.description}

Based on my requirements, should this job be excluded from my feed?`;
}

const SYSTEM_PROMPT = `You are an assistant which helps users with their job search. You will have to analyze a job and decide if it should be discarded based on the user's requirements.
Following are the rules for filtering jobs: 
- if the user wants to avoid certain technologies or skills, the job should only be excluded if it explicitly mentions any of them.
- if the user is requesting a minimum salary, it should be fine if the job just says: "Up to x amount" or "Depending on experience". Also the currency can be ignored.
- if the job does not mention a salary range, ignore salary requirements by the user (this rule can be overridden by the user if they want to exclude jobs without a salary range).
- only consider a job description unsuitable based on remoteness if the user explicitly restricts their interest to certain locations (e.g., "fully remote jobs in the UK") and the description specifies otherwise (e.g., "remote only in Belgium")
- treat the absence of specific details (such as PTO days or remote work specifics) neutrally unless the user specifies that such details are a deciding factor.
- job level/title: only disqualify based on job level if the description clearly conflicts with the user's specified job level.
- contract type: do not disqualify if contract type is unspecified, unless explicitly required by the user.
- location/relocation: treat location neutrally unless the user specifies no willingness to relocate or a specific geographic preference.
- benefits/company culture: absence of benefits or cultural descriptors should not disqualify a job unless specifically stated by the user as a requirement.
- technological tools: only jobs mandating undesired technologies should be disqualified, absence of mention should be neutral.
- working hours: absence of detailed working hours should not disqualify a job unless specific hours are a user requirement.
- for experience, interpret any specified maximum or minimum years of experience in relation to what is stated in the job description. If the job specifies an experience range, the job should be considered a match if the user's requirement fits within this range or if the user's requirement aligns with the maximum experience mentioned. Absence of experience details in the job description should not disqualify the job unless the user explicitly requires experience details to be mentioned.

Really important, if there are any ambiguities between the user's requirements and the job, never exclude it.

Reply with a JSON object containing the following fields:
- excluded: boolean (true if the job should be excluded, false otherwise)
- reason: string (the reason why the job should be excluded; leave this field empty if the job should not be excluded)
- keep the reason as short as possible, maximum 20 words.
`;

const JobExclusionFormat = z.object({
  excluded: z.boolean(),
  reason: z.string().optional().nullable().nullable(),
});
