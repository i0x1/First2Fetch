/** Re-export shared AI catalog from core */
export {
  AI_PROVIDER_CONFIG,
  AI_TASKS,
  LLM_MAX_HTML_CHARS,
  getDefaultTaskConfig,
  getProviderDisplayName,
  getProviderModels,
  getStoredProviderKeys,
  getTaskMeta,
  isProviderName,
  resolveTaskAiConfig,
  validateApiKeyFormat,
  type AiTaskId,
  type ProviderName,
  providerSupportsTask,
} from '@first2apply/core';

import { AI_PROVIDER_CONFIG, AiTaskId, ProviderName, providerSupportsTask } from '@first2apply/core';

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

export function getProviderOptions(task?: AiTaskId): ProviderOption[] {
  return Object.values(AI_PROVIDER_CONFIG).filter((config) => !task || providerSupportsTask(config.name, task)).map((config) => ({
    value: config.name,
    label: config.displayName,
    models: Object.entries(config.models).map(([value, model]) => ({
      value,
      label: model.label,
      isBudget: model.isBudget,
    })),
  }));
}
