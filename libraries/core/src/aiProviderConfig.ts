/**
 * Shared AI provider + model catalog and per-task defaults.
 * Used by desktop UI and Supabase edge functions — keep in sync here only.
 */

export type ProviderName =
  | 'openai'
  | 'google_gemini'
  | 'deepseek'
  | 'moonshot'
  | 'openrouter';

export type AiTaskId = 'jd_filter' | 'job_list' | 'jd_parse';

export type ModelConfig = {
  input: number;
  output: number;
  label: string;
  isBudget?: boolean;
  /** OpenRouter / gateway model id when different from `value` key */
  apiModelId?: string;
};

export type ProviderConfig = {
  name: ProviderName;
  displayName: string;
  models: Record<string, ModelConfig>;
  /** OpenAI-compatible API base URL (not used for google_gemini) */
  openAiBaseUrl?: string;
  apiKeyHint?: string;
};

export type AiTaskConfig = {
  provider: ProviderName;
  model: string;
};

export type AiTaskMeta = {
  id: AiTaskId;
  label: string;
  description: string;
  defaultProvider: ProviderName;
  defaultModel: string;
};

/** ~25k tokens — safe for long runs without blowing context or cost */
export const LLM_MAX_HTML_CHARS = 100_000;

/** JD filter: full description is rarely needed beyond this */
export const LLM_MAX_JD_FILTER_DESCRIPTION_CHARS = 32_000;

export const AI_TASKS: AiTaskMeta[] = [
  {
    id: 'jd_filter',
    label: 'JD filter (advanced matching)',
    description: 'Decides if a job matches your filter rules after the description is loaded.',
    defaultProvider: 'google_gemini',
    defaultModel: 'gemini-2.5-flash-lite',
  },
  {
    id: 'job_list',
    label: 'Job list scraping (custom sites)',
    description: 'Extracts job cards from custom career/listing pages.',
    defaultProvider: 'google_gemini',
    defaultModel: 'gemini-2.5-flash',
  },
  {
    id: 'jd_parse',
    label: 'Job description parsing (custom sites)',
    description: 'Extracts and summarizes a single job description page.',
    defaultProvider: 'google_gemini',
    defaultModel: 'gemini-2.5-flash',
  },
];

/** Standard-tier USD per 1M tokens (Google AI Gemini API, Jun 2026) */
const GEMINI_25_FLASH_LITE = { input: 0.1, output: 0.4, label: 'Gemini 2.5 Flash Lite', isBudget: true };
const GEMINI_25_FLASH = { input: 0.3, output: 2.5, label: 'Gemini 2.5 Flash' };
const GEMINI_25_PRO = { input: 1.25, output: 5, label: 'Gemini 2.5 Pro' };
const GEMINI_20_FLASH = { input: 0.1, output: 0.4, label: 'Gemini 2.0 Flash', isBudget: true };

export const AI_PROVIDER_CONFIG: Record<ProviderName, ProviderConfig> = {
  openai: {
    name: 'openai',
    displayName: 'OpenAI',
    openAiBaseUrl: 'https://api.openai.com/v1',
    apiKeyHint: 'sk-...',
    models: {
      'gpt-4o-mini': { input: 0.15, output: 0.6, label: 'GPT-4o mini', isBudget: true },
      'gpt-4o': { input: 2.5, output: 10, label: 'GPT-4o' },
      'gpt-4.1-mini': { input: 0.4, output: 1.6, label: 'GPT-4.1 mini', isBudget: true },
      'gpt-4.1': { input: 2, output: 8, label: 'GPT-4.1' },
      'o4-mini': { input: 1.1, output: 4.4, label: 'o4-mini' },
      'gpt-5-mini': { input: 0.25, output: 2, label: 'GPT-5 mini', isBudget: true },
      'gpt-5-nano': { input: 0.05, output: 0.4, label: 'GPT-5 nano', isBudget: true },
    },
  },
  google_gemini: {
    name: 'google_gemini',
    displayName: 'Google Gemini',
    apiKeyHint: 'AIza...',
    models: {
      'gemini-2.5-flash-lite': GEMINI_25_FLASH_LITE,
      'gemini-2.5-flash': GEMINI_25_FLASH,
      'gemini-2.5-pro': GEMINI_25_PRO,
      'gemini-2.0-flash': GEMINI_20_FLASH,
    },
  },
  deepseek: {
    name: 'deepseek',
    displayName: 'DeepSeek',
    openAiBaseUrl: 'https://api.deepseek.com',
    apiKeyHint: 'sk-...',
    models: {
      'deepseek-chat': { input: 0.28, output: 0.42, label: 'DeepSeek Chat (V3)', isBudget: true },
      'deepseek-reasoner': { input: 0.28, output: 0.42, label: 'DeepSeek Reasoner' },
    },
  },
  moonshot: {
    name: 'moonshot',
    displayName: 'Moonshot (Kimi)',
    openAiBaseUrl: 'https://api.moonshot.ai/v1',
    apiKeyHint: 'sk-...',
    models: {
      'kimi-k2-turbo-preview': { input: 0.15, output: 4, label: 'Kimi K2 Turbo' },
      'kimi-k2-0905-preview': { input: 0.15, output: 4, label: 'Kimi K2' },
      'moonshot-v1-8k': { input: 0.2, output: 2, label: 'Moonshot v1 8k', isBudget: true },
      'moonshot-v1-32k': { input: 0.2, output: 2, label: 'Moonshot v1 32k' },
      'moonshot-v1-128k': { input: 0.2, output: 2, label: 'Moonshot v1 128k' },
    },
  },
  openrouter: {
    name: 'openrouter',
    displayName: 'OpenRouter',
    openAiBaseUrl: 'https://openrouter.ai/api/v1',
    apiKeyHint: 'sk-or-...',
    models: {
      'google/gemini-2.5-flash-lite': {
        ...GEMINI_25_FLASH_LITE,
        label: 'Gemini 2.5 Flash Lite (via OR)',
        apiModelId: 'google/gemini-2.5-flash-lite',
      },
      'google/gemini-2.5-flash': {
        ...GEMINI_25_FLASH,
        label: 'Gemini 2.5 Flash (via OR)',
        apiModelId: 'google/gemini-2.5-flash',
      },
      'google/gemini-2.5-pro': {
        ...GEMINI_25_PRO,
        label: 'Gemini 2.5 Pro (via OR)',
        apiModelId: 'google/gemini-2.5-pro',
      },
      'openai/gpt-4o-mini': {
        input: 0.15,
        output: 0.6,
        label: 'GPT-4o mini (via OR)',
        isBudget: true,
        apiModelId: 'openai/gpt-4o-mini',
      },
      'deepseek/deepseek-chat': {
        input: 0.28,
        output: 0.42,
        label: 'DeepSeek Chat (via OR)',
        isBudget: true,
        apiModelId: 'deepseek/deepseek-chat',
      },
      'anthropic/claude-3-5-haiku': {
        input: 0.8,
        output: 4,
        label: 'Claude 3.5 Haiku (via OR)',
        isBudget: true,
        apiModelId: 'anthropic/claude-3-5-haiku',
      },
      'anthropic/claude-sonnet-4': {
        input: 3,
        output: 15,
        label: 'Claude Sonnet 4 (via OR)',
        apiModelId: 'anthropic/claude-sonnet-4',
      },
      'meta-llama/llama-3.3-70b-instruct': {
        input: 0.13,
        output: 0.38,
        label: 'Llama 3.3 70B (via OR)',
        isBudget: true,
        apiModelId: 'meta-llama/llama-3.3-70b-instruct',
      },
    },
  },
};

export const PROVIDER_NAMES = Object.keys(AI_PROVIDER_CONFIG) as ProviderName[];

export function isProviderName(value: string | null | undefined): value is ProviderName {
  return !!value && PROVIDER_NAMES.includes(value as ProviderName);
}

export function getProviderNames(): ProviderName[] {
  return PROVIDER_NAMES;
}

export function getProviderModels(provider: ProviderName): Record<string, ModelConfig> {
  return AI_PROVIDER_CONFIG[provider]?.models ?? {};
}

export function getModelConfig(provider: ProviderName, model: string): ModelConfig | undefined {
  return AI_PROVIDER_CONFIG[provider]?.models[model];
}

export function getProviderDisplayName(provider: ProviderName): string {
  return AI_PROVIDER_CONFIG[provider]?.displayName ?? provider;
}

export function getApiModelId(provider: ProviderName, model: string): string {
  const modelConfig = getModelConfig(provider, model);
  return modelConfig?.apiModelId ?? model;
}

export function getDefaultTaskConfig(task: AiTaskId): AiTaskConfig {
  const meta = AI_TASKS.find((t) => t.id === task)!;
  return { provider: meta.defaultProvider, model: meta.defaultModel };
}

export function getTaskMeta(task: AiTaskId): AiTaskMeta {
  return AI_TASKS.find((t) => t.id === task)!;
}

export function validateApiKeyFormat(provider: ProviderName, apiKey: string): string | null {
  if (!apiKey) return null;
  const trimmed = apiKey.trim();
  if (trimmed.length < 16) {
    return 'API key appears too short';
  }
  switch (provider) {
    case 'openai':
    case 'deepseek':
    case 'moonshot':
      if (!trimmed.startsWith('sk-')) {
        return 'Key should start with sk-';
      }
      break;
    case 'openrouter':
      if (!trimmed.startsWith('sk-or-')) {
        return 'OpenRouter keys usually start with sk-or-';
      }
      break;
    default:
      break;
  }
  return null;
}

export type AdvancedMatchingAiFields = {
  ai_provider?: ProviderName | string | null;
  ai_model?: string | null;
  ai_jd_filter_provider?: ProviderName | string | null;
  ai_jd_filter_model?: string | null;
  ai_job_list_provider?: ProviderName | string | null;
  ai_job_list_model?: string | null;
  ai_jd_parse_provider?: ProviderName | string | null;
  ai_jd_parse_model?: string | null;
  ai_api_key_encrypted?: string | null;
  ai_api_keys_encrypted?: Record<string, string> | null;
  ai_configured_providers?: string[] | null;
};

const TASK_AI_COLUMNS: Record<AiTaskId, { provider: keyof AdvancedMatchingAiFields; model: keyof AdvancedMatchingAiFields }> = {
  jd_filter: { provider: 'ai_jd_filter_provider', model: 'ai_jd_filter_model' },
  job_list: { provider: 'ai_job_list_provider', model: 'ai_job_list_model' },
  jd_parse: { provider: 'ai_jd_parse_provider', model: 'ai_jd_parse_model' },
};

export function resolveTaskAiConfig(
  record: AdvancedMatchingAiFields,
  task: AiTaskId,
): AiTaskConfig | null {
  const { provider: providerField, model: modelField } = TASK_AI_COLUMNS[task];
  let provider = record[providerField] as string | null | undefined;
  let model = record[modelField] as string | null | undefined;

  if (!provider || !model) {
    provider = record.ai_provider ?? provider;
    model = record.ai_model ?? model;
  }

  if (!isProviderName(provider) || !model) {
    return null;
  }

  if (!getModelConfig(provider, model)) {
    return null;
  }

  return { provider, model };
}

export function getStoredProviderKeys(record: AdvancedMatchingAiFields): ProviderName[] {
  const keys = new Set<ProviderName>();
  for (const k of record.ai_configured_providers ?? []) {
    if (isProviderName(k)) {
      keys.add(k);
    }
  }
  const jsonKeys = record.ai_api_keys_encrypted ?? {};
  for (const k of Object.keys(jsonKeys)) {
    if (isProviderName(k) && jsonKeys[k]) {
      keys.add(k);
    }
  }
  if (record.ai_api_key_encrypted && isProviderName(record.ai_provider ?? undefined)) {
    keys.add(record.ai_provider as ProviderName);
  }
  return [...keys];
}
