import {
  AI_TASKS,
  AiTaskId,
  ProviderName,
  getDefaultTaskConfig,
  getProviderDisplayName,
  getProviderModels,
  getProviderOptions,
  getStoredProviderKeys,
  resolveTaskAiConfig,
  validateApiKeyFormat,
} from '@/lib/aiProviderConfig';
import { AdvancedMatchingConfigWithAI } from '@/lib/electronMainSdk';
import { useMemo, useState } from 'react';

import { Button } from '@first2apply/ui';
import { Input } from '@first2apply/ui';
import { Label } from '@first2apply/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@first2apply/ui';

export type AiTaskState = Record<AiTaskId, { provider: ProviderName | ''; model: string }>;

export type AiProvidersFormState = {
  taskConfigs: AiTaskState;
  apiKeyInputs: Partial<Record<ProviderName, string>>;
  storedProviders: ProviderName[];
};

const emptyTaskState = (): AiTaskState =>
  Object.fromEntries(
    AI_TASKS.map((t) => [t.id, { provider: '' as const, model: '' }]),
  ) as AiTaskState;

export function buildAiFormStateFromConfig(config: AdvancedMatchingConfigWithAI): AiProvidersFormState {
  const taskConfigs = emptyTaskState();
  for (const task of AI_TASKS) {
    const resolved = resolveTaskAiConfig(config, task.id);
    const defaults = getDefaultTaskConfig(task.id);
    taskConfigs[task.id] = {
      provider: resolved?.provider ?? defaults.provider,
      model: resolved?.model ?? defaults.model,
    };
  }

  return {
    taskConfigs,
    apiKeyInputs: {},
    storedProviders: getStoredProviderKeys(config),
  };
}

export function buildAdvancedMatchingAiPayload(form: AiProvidersFormState) {
  const apiKeys: Record<string, string> = {};
  for (const [provider, key] of Object.entries(form.apiKeyInputs)) {
    if (key?.trim()) {
      apiKeys[provider] = key.trim();
    }
  }

  const jdFilter = form.taskConfigs.jd_filter;
  const jobList = form.taskConfigs.job_list;
  const jdParse = form.taskConfigs.jd_parse;

  return {
    ai_provider: jdFilter.provider || null,
    ai_model: jdFilter.model || null,
    ai_jd_filter_provider: jdFilter.provider || null,
    ai_jd_filter_model: jdFilter.model || null,
    ai_job_list_provider: jobList.provider || null,
    ai_job_list_model: jobList.model || null,
    ai_jd_parse_provider: jdParse.provider || null,
    ai_jd_parse_model: jdParse.model || null,
    ai_api_keys: Object.keys(apiKeys).length > 0 ? apiKeys : null,
    ai_api_key_encrypted: null as string | null,
  };
}

export function collectProvidersInUse(taskConfigs: AiTaskState): ProviderName[] {
  const set = new Set<ProviderName>();
  for (const task of AI_TASKS) {
    const p = taskConfigs[task.id].provider;
    if (p) set.add(p);
  }
  return [...set];
}

type Props = {
  form: AiProvidersFormState;
  onChange: (next: AiProvidersFormState) => void;
};

export function AiProvidersSection({ form, onChange }: Props) {
  const providerOptions = useMemo(() => getProviderOptions(), []);
  const providersInUse = useMemo(() => collectProvidersInUse(form.taskConfigs), [form.taskConfigs]);
  const [visibleKeyProvider, setVisibleKeyProvider] = useState<ProviderName | null>(null);

  const updateTask = (taskId: AiTaskId, patch: Partial<{ provider: ProviderName | ''; model: string }>) => {
    onChange({
      ...form,
      taskConfigs: {
        ...form.taskConfigs,
        [taskId]: { ...form.taskConfigs[taskId], ...patch },
      },
    });
  };

  const updateApiKey = (provider: ProviderName, value: string) => {
    onChange({
      ...form,
      apiKeyInputs: { ...form.apiKeyInputs, [provider]: value },
    });
  };

  return (
    <section className="rounded-lg border border-border/70 bg-card/50 p-4 space-y-4">
      <div>
        <h2 className="text-base font-medium">AI models (optional)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick a provider and model per task. HTML sent to the API is capped at 100k characters per request for long
          runs.
        </p>
      </div>

      {AI_TASKS.map((task) => {
        const state = form.taskConfigs[task.id];
        const models = state.provider ? getProviderModels(state.provider) : {};
        return (
          <div key={task.id} className="rounded-md border border-border/50 p-3 space-y-2">
            <div>
              <p className="text-sm font-medium">{task.label}</p>
              <p className="text-xs text-muted-foreground">{task.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${task.id}-provider`}>Provider</Label>
                <Select
                  value={state.provider || undefined}
                  onValueChange={(value) => {
                    const provider = value as ProviderName;
                    const defaultModel = getDefaultTaskConfig(task.id).model;
                    const modelEntries = Object.keys(getProviderModels(provider));
                    const model = modelEntries.includes(defaultModel) ? defaultModel : modelEntries[0] ?? '';
                    updateTask(task.id, { provider, model });
                  }}
                >
                  <SelectTrigger id={`${task.id}-provider`}>
                    <SelectValue placeholder="Choose provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providerOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {state.provider && (
                <div className="space-y-1.5">
                  <Label htmlFor={`${task.id}-model`}>Model</Label>
                  <Select value={state.model} onValueChange={(model) => updateTask(task.id, { model })}>
                    <SelectTrigger id={`${task.id}-model`}>
                      <SelectValue placeholder="Choose model" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(models).map(([value, model]) => (
                        <SelectItem key={value} value={value}>
                          {model.label}
                          {model.isBudget ? ' · Budget' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {providersInUse.length > 0 && (
        <div className="space-y-3 border-t border-border/50 pt-3">
          <p className="text-sm font-medium">API keys</p>
          <p className="text-xs text-muted-foreground">
            One key per provider you use above. Keys are encrypted when you save filters.
          </p>
          {providersInUse.map((provider) => {
            const input = form.apiKeyInputs[provider] ?? '';
            const hasStored = form.storedProviders.includes(provider);
            const validationError = input ? validateApiKeyFormat(provider, input) : null;
            return (
              <div key={provider} className="space-y-1.5">
                <Label htmlFor={`key-${provider}`}>{getProviderDisplayName(provider)}</Label>
                <div className="relative">
                  <Input
                    id={`key-${provider}`}
                    type={visibleKeyProvider === provider ? 'text' : 'password'}
                    value={input}
                    onChange={(e) => updateApiKey(provider, e.target.value)}
                    placeholder={
                      hasStored && !input
                        ? 'Key saved (enter new key to replace)'
                        : `Enter ${getProviderDisplayName(provider)} API key`
                    }
                    className="pr-16"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 h-8 -translate-y-1/2 px-2"
                    onClick={() => setVisibleKeyProvider(visibleKeyProvider === provider ? null : provider)}
                    disabled={!input}
                  >
                    {visibleKeyProvider === provider ? 'Hide' : 'Show'}
                  </Button>
                </div>
                {validationError && <p className="text-xs text-destructive">{validationError}</p>}
                {hasStored && !input && (
                  <p className="text-xs text-muted-foreground">A key is already stored for this provider.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
