import {
  AdvancedMatchingAiFields,
  AiTaskId,
  getApiModelId,
  getModelConfig,
  isProviderName,
  resolveTaskAiConfig,
} from '@first2apply/core';
import { getExceptionMessage } from '@first2apply/core';
import { SupabaseClient } from '@supabase/supabasefork';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';
import { OpenAI as OpenAIClient } from 'openai';

import {
  AI_PROVIDER_CONFIG,
  PROVIDER_NAMES,
  ProviderName,
} from './aiProviderConfig.ts';
import { ILogger } from './logger.ts';

export type AIResponse = {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  content: string;
};

export type LLMConfig = {
  model: string;
  costPerMillionInputTokens: number;
  costPerMillionOutputTokens: number;
};

export type AIProviderConfig = {
  provider: ProviderName;
  model: string;
  apiKey: string;
};

export const PROVIDER_MODELS = Object.fromEntries(
  Object.entries(AI_PROVIDER_CONFIG).map(([provider, config]) => [
    provider,
    Object.fromEntries(
      Object.entries(config.models).map(([model, modelConfig]) => [
        model,
        { input: modelConfig.input, output: modelConfig.output },
      ]),
    ),
  ]),
) as Record<ProviderName, Record<string, { input: number; output: number }>>;

export interface AIProvider {
  createChatCompletion(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    maxCompletionTokens?: number;
    responseFormat?: { type: 'json_object' };
  }): Promise<AIResponse>;
  getConfig(): LLMConfig;
}

class OpenAICompatibleProvider implements AIProvider {
  private client: OpenAIClient;
  private config: LLMConfig;
  private apiModelId: string;

  constructor(config: AIProviderConfig, apiModelId: string) {
    const providerConfig = AI_PROVIDER_CONFIG[config.provider];
    if (!providerConfig?.openAiBaseUrl) {
      throw new Error(`Provider ${config.provider} is not OpenAI-compatible`);
    }

    const modelConfig = getModelConfig(config.provider, config.model);
    if (!modelConfig) {
      throw new Error(`Unsupported model: ${config.model} for ${config.provider}`);
    }

    const defaultHeaders: Record<string, string> = {};
    if (config.provider === 'openrouter') {
      defaultHeaders['HTTP-Referer'] = 'https://first2apply.com';
      defaultHeaders['X-Title'] = 'First2Apply';
    }

    this.client = new OpenAIClient({
      apiKey: config.apiKey,
      baseURL: providerConfig.openAiBaseUrl,
      defaultHeaders,
    });

    this.apiModelId = apiModelId;
    this.config = {
      model: config.model,
      costPerMillionInputTokens: modelConfig.input,
      costPerMillionOutputTokens: modelConfig.output,
    };
  }

  async createChatCompletion(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    maxCompletionTokens?: number;
    responseFormat?: { type: 'json_object' };
  }): Promise<AIResponse> {
    const response = await this.client.chat.completions.create({
      model: this.apiModelId,
      messages: params.messages,
      max_tokens: params.maxCompletionTokens,
      response_format: params.responseFormat,
    });

    const choice = response.choices[0];
    if (!choice?.message.content) {
      throw new Error(`${this.config.model} response missing content`);
    }

    return {
      usage: {
        prompt_tokens: response.usage?.prompt_tokens,
        completion_tokens: response.usage?.completion_tokens,
        total_tokens: response.usage?.total_tokens,
      },
      content: choice.message.content,
    };
  }

  getConfig(): LLMConfig {
    return this.config;
  }
}

class GoogleGeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;
  private config: LLMConfig;
  private apiModelId: string;

  constructor(config: AIProviderConfig) {
    const modelConfig = getModelConfig('google_gemini', config.model);
    if (!modelConfig) {
      throw new Error(`Unsupported Google Gemini model: ${config.model}`);
    }

    this.client = new GoogleGenerativeAI(config.apiKey);
    this.apiModelId = getApiModelId('google_gemini', config.model);
    this.config = {
      model: config.model,
      costPerMillionInputTokens: modelConfig.input,
      costPerMillionOutputTokens: modelConfig.output,
    };
  }

  async createChatCompletion(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    maxCompletionTokens?: number;
    responseFormat?: { type: 'json_object' };
  }): Promise<AIResponse> {
    const model = this.client.getGenerativeModel({
      model: this.apiModelId,
      generationConfig: {
        maxOutputTokens: params.maxCompletionTokens,
        responseMimeType: params.responseFormat?.type === 'json_object' ? 'application/json' : undefined,
      },
    });

    let systemInstruction = '';
    const chatHistory: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const msg of params.messages) {
      if (msg.role === 'system') {
        systemInstruction = msg.content;
      } else {
        const geminiRole = msg.role === 'assistant' ? 'model' : 'user';
        chatHistory.push({
          role: geminiRole,
          parts: [{ text: msg.content }],
        });
      }
    }

    let result;
    if (chatHistory.length > 1) {
      const chat = model.startChat({
        history: chatHistory.slice(0, -1) as any,
        systemInstruction: systemInstruction || undefined,
      });
      result = await chat.sendMessage(chatHistory[chatHistory.length - 1].parts[0].text);
    } else {
      const prompt = systemInstruction
        ? `${systemInstruction}\n\n${chatHistory[0]?.parts[0]?.text || ''}`
        : chatHistory[0]?.parts[0]?.text || '';
      result = await model.generateContent(prompt);
    }

    const response = await result.response;
    const text = response.text();

    const usageMetadata = (response as any).usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount || 0;
    const outputTokens = usageMetadata?.candidatesTokenCount || 0;

    const estimatedInputTokens =
      inputTokens ||
      Math.ceil((systemInstruction.length + chatHistory.reduce((sum, m) => sum + m.parts[0].text.length, 0)) / 4);
    const estimatedOutputTokens = outputTokens || Math.ceil(text.length / 4);

    return {
      usage: {
        prompt_tokens: estimatedInputTokens,
        completion_tokens: estimatedOutputTokens,
        total_tokens: estimatedInputTokens + estimatedOutputTokens,
      },
      content: text,
    };
  }

  getConfig(): LLMConfig {
    return this.config;
  }
}

export function buildAIProvider(config: AIProviderConfig): AIProvider {
  if (!isProviderName(config.provider)) {
    throw new Error(`Unsupported AI provider: ${config.provider}`);
  }

  if (config.provider === 'google_gemini') {
    return new GoogleGeminiProvider(config);
  }

  const apiModelId = getApiModelId(config.provider, config.model);
  return new OpenAICompatibleProvider(config, apiModelId);
}

async function decryptProviderApiKey({
  supabaseAdminClient,
  encryptedKey,
  userId,
  logger,
}: {
  supabaseAdminClient: SupabaseClient;
  encryptedKey: string;
  userId: string;
  logger: ILogger;
}): Promise<string | null> {
  const { data: decryptedKey, error: decryptError } = await supabaseAdminClient.rpc('decrypt_api_key', {
    encrypted_key: encryptedKey,
    user_id: userId,
  });

  if (decryptError || !decryptedKey) {
    logger.error(`Failed to decrypt API key for user ${userId}: ${getExceptionMessage(decryptError)}`);
    return null;
  }

  return decryptedKey;
}

function getEncryptedKeyForProvider(
  record: AdvancedMatchingAiFields,
  provider: ProviderName,
): string | null {
  const keys = record.ai_api_keys_encrypted;
  if (keys && typeof keys === 'object' && keys[provider]) {
    return keys[provider] ?? null;
  }

  if (record.ai_provider === provider && record.ai_api_key_encrypted) {
    return record.ai_api_key_encrypted;
  }

  return null;
}

/**
 * Build provider client for a specific AI task (JD filter, job list scrape, JD parse).
 */
export async function buildAIProviderForTask({
  supabaseAdminClient,
  userId,
  task,
  logger,
}: {
  supabaseAdminClient: SupabaseClient;
  userId: string;
  task: AiTaskId;
  logger: ILogger;
}): Promise<{ provider: AIProvider; config: LLMConfig } | null> {
  const { data: advancedMatching, error } = await supabaseAdminClient
    .from('advanced_matching')
    .select(
      'ai_provider, ai_model, ai_api_key_encrypted, ai_api_keys_encrypted, ai_jd_filter_provider, ai_jd_filter_model, ai_job_list_provider, ai_job_list_model, ai_jd_parse_provider, ai_jd_parse_model',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !advancedMatching) {
    logger.warn(`No AI provider config found for user ${userId}`);
    return null;
  }

  const taskConfig = resolveTaskAiConfig(advancedMatching as AdvancedMatchingAiFields, task);
  if (!taskConfig) {
    logger.info(`User ${userId} has no complete AI config for task ${task}`);
    return null;
  }

  const encryptedKey = getEncryptedKeyForProvider(advancedMatching as AdvancedMatchingAiFields, taskConfig.provider);
  if (!encryptedKey) {
    logger.info(`User ${userId} has no API key for provider ${taskConfig.provider}`);
    return null;
  }

  const decryptedKey = await decryptProviderApiKey({
    supabaseAdminClient,
    encryptedKey,
    userId,
    logger,
  });
  if (!decryptedKey) {
    throw new Error('Failed to decrypt API key');
  }

  try {
    const provider = buildAIProvider({
      provider: taskConfig.provider,
      model: taskConfig.model,
      apiKey: decryptedKey,
    });
    return { provider, config: provider.getConfig() };
  } catch (err) {
    logger.error(`Failed to build AI provider for user ${userId}: ${getExceptionMessage(err)}`);
    throw err;
  }
}

/** @deprecated Use buildAIProviderForTask with the appropriate AiTaskId */
export async function buildAIProviderFromUserConfig({
  supabaseAdminClient,
  userId,
  defaultModel,
  logger,
}: {
  supabaseAdminClient: SupabaseClient;
  userId: string;
  defaultModel?: string;
  logger: ILogger;
}): Promise<{ provider: AIProvider; config: LLMConfig } | null> {
  void defaultModel;
  return buildAIProviderForTask({
    supabaseAdminClient,
    userId,
    task: 'jd_filter',
    logger,
  });
}

export function computeLlmApiCallCost({ llmConfig, response }: { llmConfig: LLMConfig; response: AIResponse }): {
  cost: number;
  inputTokensUsed: number;
  outputTokensUsed: number;
} {
  const inputTokensUsed = response.usage?.prompt_tokens ?? 0;
  const outputTokensUsed = response.usage?.completion_tokens ?? 0;
  const cost =
    (llmConfig.costPerMillionInputTokens / 1_000_000) * inputTokensUsed +
    (llmConfig.costPerMillionOutputTokens / 1_000_000) * outputTokensUsed;

  return { cost, inputTokensUsed, outputTokensUsed };
}

export async function logAiUsage({
  logger,
  supabaseAdminClient,
  forUserId,
  llmConfig,
  response,
}: {
  logger: ILogger;
  supabaseAdminClient: SupabaseClient;
  forUserId: string;
  llmConfig: LLMConfig;
  response: AIResponse;
}) {
  const { cost, inputTokensUsed, outputTokensUsed } = computeLlmApiCallCost({
    llmConfig,
    response,
  });

  const { error: countUsageError } = await supabaseAdminClient.rpc('log_ai_usage', {
    for_user_id: forUserId,
    cost_increment: cost,
    input_tokens_increment: inputTokensUsed,
    output_tokens_increment: outputTokensUsed,
  });
  if (countUsageError) {
    logger.error(getExceptionMessage(countUsageError));
  }
}

export { PROVIDER_NAMES };
