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
    <div className="divide-y divide-border">
      <div className="grid grid-cols-[minmax(150px,1fr)_minmax(124px,148px)_minmax(150px,190px)] gap-1.5 bg-muted px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
        <span>Task</span>
        <span>Provider</span>
        <span>Model</span>
      </div>

      {AI_TASKS.map((task) => {
        const state = form.taskConfigs[task.id];
        const models = state.provider ? getProviderModels(state.provider) : {};

        return (
          <div
            key={task.id}
            className="grid grid-cols-[minmax(150px,1fr)_minmax(124px,148px)_minmax(150px,190px)] items-center gap-1.5 px-2 py-1"
          >
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold leading-tight text-foreground">{task.label}</p>
              <p className="truncate text-[9px] leading-tight text-muted-foreground">{task.description}</p>
            </div>
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
              <SelectTrigger id={`${task.id}-provider`} className="h-6 text-[10px]">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                {providerOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.provider ? (
              <Select value={state.model} onValueChange={(model) => updateTask(task.id, { model })}>
                <SelectTrigger id={`${task.id}-model`} className="h-6 text-[10px]">
                  <SelectValue placeholder="Model" />
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
            ) : (
              <span className="text-[9px] text-muted-foreground">Choose provider</span>
            )}
          </div>
        );
      })}

      {providersInUse.length > 0 && (
        <div>
          <div className="bg-muted px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
            API keys
          </div>
          {providersInUse.map((provider) => {
            const input = form.apiKeyInputs[provider] ?? '';
            const hasStored = form.storedProviders.includes(provider);
            const validationError = input ? validateApiKeyFormat(provider, input) : null;

            return (
              <div key={provider} className="grid grid-cols-[128px_minmax(0,1fr)] items-center gap-1.5 px-2 py-1">
                <div>
                  <p className="text-[10px] font-semibold leading-tight text-foreground">{getProviderDisplayName(provider)}</p>
                  <p className="text-[9px] leading-tight text-muted-foreground">{hasStored && !input ? 'Saved' : 'Encrypted on save'}</p>
                </div>
                <div>
                  <div className="relative">
                    <Input
                      id={`key-${provider}`}
                      type={visibleKeyProvider === provider ? 'text' : 'password'}
                      value={input}
                      onChange={(e) => updateApiKey(provider, e.target.value)}
                      placeholder={hasStored && !input ? 'Key saved (enter new key to replace)' : 'Enter API key'}
                      className="h-6 pr-12 text-[10px]"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 h-4 -translate-y-1/2 px-1 text-[9px]"
                      onClick={() => setVisibleKeyProvider(visibleKeyProvider === provider ? null : provider)}
                      disabled={!input}
                    >
                      {visibleKeyProvider === provider ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                  {validationError && <p className="mt-1 text-[10px] text-destructive">{validationError}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
