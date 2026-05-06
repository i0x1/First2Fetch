/**
 * Frontend AI Provider Configuration
 * 
 * This mirrors the backend configuration in apps/backend/supabase/functions/_shared/aiProviderConfig.ts
 * Keep both files in sync when adding new providers or models.
 * 
 * TODO: Consider sharing this config via a shared library in the future
 */

export type ProviderName = 'openai' | 'google_gemini';

export type ModelOption = {
  value: string;
  label: string;
  isBudget?: boolean;
};

export type ProviderOption = {
  value: ProviderName;
  label: string;
  models: ModelOption[];
};

/**
 * AI Provider and Model Configuration for Frontend
 * 
 * This should match the backend configuration in aiProviderConfig.ts
 */
export const AI_PROVIDER_CONFIG: Record<ProviderName, ProviderOption> = {
  openai: {
    value: 'openai',
    label: 'OpenAI',
    models: [
      { value: 'gpt-5.2', label: 'GPT-5.2' },
      { value: 'gpt-5-mini', label: 'GPT-5 mini (Budget)', isBudget: true },
      { value: 'gpt-5-nano', label: 'GPT-5 nano (Budget)', isBudget: true },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Budget)', isBudget: true },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Budget)', isBudget: true },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-4', label: 'GPT-4' },
    ],
  },
  google_gemini: {
    value: 'google_gemini',
    label: 'Google Gemini',
    models: [
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (Budget)', isBudget: true },
    ],
  },
};

/**
 * Get all providers as options for Select component
 */
export function getProviderOptions(): Array<{ value: ProviderName; label: string }> {
  return Object.values(AI_PROVIDER_CONFIG).map((config) => ({
    value: config.value,
    label: config.label,
  }));
}

/**
 * Get models for a specific provider
 */
export function getProviderModels(provider: ProviderName): ModelOption[] {
  return AI_PROVIDER_CONFIG[provider]?.models || [];
}

