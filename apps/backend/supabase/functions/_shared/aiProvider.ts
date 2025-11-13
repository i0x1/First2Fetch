import { getExceptionMessage } from '@first2apply/core';
import { SupabaseClient } from '@supabase/supabasefork';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';
import { OpenAI as OpenAIClient } from 'openai';

import { AI_PROVIDER_CONFIG, ProviderName, getModelConfig, getProviderModels } from './aiProviderConfig.ts';
import { ILogger } from './logger.ts';

// Type for AI API response with usage information
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

// Legacy export for backward compatibility - now uses centralized config
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

// Provider interface
export interface AIProvider {
  createChatCompletion(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    maxCompletionTokens?: number;
    responseFormat?: { type: 'json_object' };
  }): Promise<AIResponse>;
  getConfig(): LLMConfig;
}

// OpenAI Provider Implementation
class OpenAIProvider implements AIProvider {
  private client: OpenAIClient;
  private config: LLMConfig;

  constructor(config: AIProviderConfig) {
    if (config.provider !== 'openai') {
      throw new Error('Invalid provider for OpenAIProvider');
    }

    const modelConfig = getModelConfig('openai', config.model);
    if (!modelConfig) {
      throw new Error(`Unsupported OpenAI model: ${config.model}`);
    }

    this.client = new OpenAIClient({
      apiKey: config.apiKey,
    });

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
      model: this.config.model,
      messages: params.messages,
      max_tokens: params.maxCompletionTokens,
      response_format: params.responseFormat,
    });

    const choice = response.choices[0];
    if (!choice || !choice.message.content) {
      throw new Error('OpenAI response missing content');
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

// Google Gemini Provider Implementation
class GoogleGeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;
  private config: LLMConfig;

  constructor(config: AIProviderConfig) {
    if (config.provider !== 'google_gemini') {
      throw new Error('Invalid provider for GoogleGeminiProvider');
    }

    const modelConfig = getModelConfig('google_gemini', config.model);
    if (!modelConfig) {
      throw new Error(`Unsupported Google Gemini model: ${config.model}`);
    }

    this.client = new GoogleGenerativeAI(config.apiKey);

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
      model: this.config.model,
      generationConfig: {
        maxOutputTokens: params.maxCompletionTokens,
        responseMimeType: params.responseFormat?.type === 'json_object' ? 'application/json' : undefined,
      },
    });

    // Convert messages format for Gemini
    // Gemini uses a different format - separate system instruction and chat history
    let systemInstruction = '';
    const chatHistory: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const msg of params.messages) {
      if (msg.role === 'system') {
        systemInstruction = msg.content;
      } else {
        // Map roles: 'user' -> 'user', 'assistant' -> 'model'
        const geminiRole = msg.role === 'assistant' ? 'model' : 'user';
        chatHistory.push({
          role: geminiRole,
          parts: [{ text: msg.content }],
        });
      }
    }

    // Use startChat for conversation or generateContent for single prompt
    let result;
    if (chatHistory.length > 1) {
      // Use chat if we have multiple messages
      const chat = model.startChat({
        history: chatHistory.slice(0, -1) as any,
        systemInstruction: systemInstruction || undefined,
      });
      result = await chat.sendMessage(chatHistory[chatHistory.length - 1].parts[0].text);
    } else {
      // Single message - use generateContent
      const prompt = systemInstruction
        ? `${systemInstruction}\n\n${chatHistory[0]?.parts[0]?.text || ''}`
        : chatHistory[0]?.parts[0]?.text || '';
      result = await model.generateContent(prompt);
    }

    const response = await result.response;
    const text = response.text();

    // Try to get usage metadata if available
    const usageMetadata = (response as any).usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount || 0;
    const outputTokens = usageMetadata?.candidatesTokenCount || 0;

    // Fallback estimation if metadata not available
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

/**
 * Build an AI provider client based on the configuration.
 */
export function buildAIProvider(config: AIProviderConfig): AIProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'google_gemini':
      return new GoogleGeminiProvider(config);
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}. Add implementation in aiProvider.ts`);
  }
}

/**
 * Build an AI provider from user's advanced matching configuration.
 * Decrypts the API key from the database.
 */
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
  // Fetch user's advanced matching config
  const { data: advancedMatching, error } = await supabaseAdminClient
    .from('advanced_matching')
    .select('ai_provider, ai_model, ai_api_key_encrypted')
    .eq('user_id', userId)
    .single();

  if (error || !advancedMatching) {
    logger.warn(`No AI provider config found for user ${userId}, using defaults`);
    return null;
  }

  // If user hasn't configured a provider, return null to use defaults
  if (!advancedMatching.ai_provider || !advancedMatching.ai_model || !advancedMatching.ai_api_key_encrypted) {
    logger.info(`User ${userId} has not configured AI provider, using defaults`);
    return null;
  }

  // Decrypt the API key
  const { data: decryptedKey, error: decryptError } = await supabaseAdminClient.rpc('decrypt_api_key', {
    encrypted_key: advancedMatching.ai_api_key_encrypted,
    user_id: userId,
  });

  if (decryptError || !decryptedKey) {
    logger.error(`Failed to decrypt API key for user ${userId}: ${getExceptionMessage(decryptError)}`);
    throw new Error('Failed to decrypt API key');
  }

  const providerConfig: AIProviderConfig = {
    provider: advancedMatching.ai_provider as ProviderName,
    model: advancedMatching.ai_model,
    apiKey: decryptedKey,
  };

  try {
    const provider = buildAIProvider(providerConfig);
    const config = provider.getConfig();
    return { provider, config };
  } catch (error) {
    logger.error(`Failed to build AI provider for user ${userId}: ${getExceptionMessage(error)}`);
    throw error;
  }
}

/**
 * Compute the cost of an AI API call.
 */
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

/**
 * Log AI usage to the database.
 */
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

  // persist the cost of the AI API call
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
