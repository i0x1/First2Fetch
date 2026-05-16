/**
 * Centralized AI Provider Configuration
 *
 * This file serves as the single source of truth for AI providers and models.
 * To add a new provider or model, update this file and follow the instructions in README.md
 */

export type ProviderName = 'openai' | 'google_gemini';

export type ModelConfig = {
  input: number; // Cost per million input tokens
  output: number; // Cost per million output tokens
  label: string; // Display name for UI
  isBudget?: boolean; // Mark budget-friendly models
};

export type ProviderConfig = {
  name: ProviderName;
  displayName: string;
  models: Record<string, ModelConfig>;
};

/**
 * AI Provider and Model Configuration
 *
 * To add a new provider:
 * 1. Add the provider name to ProviderName type above
 * 2. Add provider configuration below
 * 3. Update database constraint in seed.sql
 * 4. Implement provider class in aiProvider.ts
 *
 * To add a new model:
 * 1. Add model entry to the appropriate provider's models object below
 * 2. Model will automatically appear in UI
 */
export const AI_PROVIDER_CONFIG: Record<ProviderName, ProviderConfig> = {
  openai: {
    name: 'openai',
    displayName: 'OpenAI',
    models: {
      'gpt-5.5': { input: 5, output: 30, label: 'GPT-5.5' },
      'gpt-5.4': { input: 2.5, output: 15, label: 'GPT-5.4' },
      'gpt-5.4-mini': { input: 0.75, output: 4.5, label: 'GPT-5.4 mini', isBudget: true },
      'gpt-5.4-nano': { input: 0.2, output: 1.25, label: 'GPT-5.4 nano', isBudget: true },
      'gpt-5.2': { input: 1.75, output: 14, label: 'GPT-5.2' },
      'gpt-5-mini': { input: 0.25, output: 2, label: 'GPT-5 mini', isBudget: true },
      'gpt-5-nano': { input: 0.05, output: 0.4, label: 'GPT-5 nano', isBudget: true },
      'gpt-4o': { input: 2.5, output: 10, label: 'GPT-4o' },
      'gpt-4o-mini': { input: 0.15, output: 0.6, label: 'GPT-4o Mini', isBudget: true },
      'gpt-3.5-turbo': { input: 0.5, output: 1.5, label: 'GPT-3.5 Turbo', isBudget: true },
      'gpt-4-turbo': { input: 10, output: 30, label: 'GPT-4 Turbo' },
      'gpt-4': { input: 30, output: 60, label: 'GPT-4' },
    },
  },
  google_gemini: {
    name: 'google_gemini',
    displayName: 'Google Gemini',
    models: {
      'gemini-2.5-pro': { input: 1.25, output: 5, label: 'Gemini 2.5 Pro' },
      'gemini-2.5-flash': { input: 0.075, output: 0.3, label: 'Gemini 2.5 Flash' },
      'gemini-2.5-flash-lite': { input: 0.05, output: 0.2, label: 'Gemini 2.5 Flash Lite', isBudget: true },
    },
  },
};

/**
 * Get all provider names
 */
export function getProviderNames(): ProviderName[] {
  return Object.keys(AI_PROVIDER_CONFIG) as ProviderName[];
}

/**
 * Get models for a specific provider
 */
export function getProviderModels(provider: ProviderName): Record<string, ModelConfig> {
  return AI_PROVIDER_CONFIG[provider]?.models || {};
}

/**
 * Get model configuration
 */
export function getModelConfig(provider: ProviderName, model: string): ModelConfig | undefined {
  return AI_PROVIDER_CONFIG[provider]?.models[model];
}

/**
 * Get provider display name
 */
export function getProviderDisplayName(provider: ProviderName): string {
  return AI_PROVIDER_CONFIG[provider]?.displayName || provider;
}
