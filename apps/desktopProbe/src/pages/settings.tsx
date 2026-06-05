import { CronSchedule } from '@/components/cronSchedule';
import {
  AiProvidersFormState,
  AiProvidersSection,
  buildAdvancedMatchingAiPayload,
  buildAiFormStateFromConfig,
  collectProvidersInUse,
} from '@/components/aiProvidersSection';
import {
  CompactKvRow,
  CompactKvTable,
  CompactPageHeader,
  CompactPanel,
} from '@/components/compact/compactLayout';
import { SettingsSkeleton } from '@/components/skeletons/SettingsSkeleton';
import { useAppState } from '@/hooks/appState';
import { useError } from '@/hooks/error';
import { useSession } from '@/hooks/session';
import { useSettings } from '@/hooks/settings';
import { validateApiKeyFormat } from '@/lib/aiProviderConfig';
import {
  AdvancedMatchingConfigWithAI,
  applyAppUpdate,
  getAdvancedMatchingConfig,
  logout,
  openExternalUrl,
  updateAdvancedMatchingConfig,
} from '@/lib/electronMainSdk';
import { JobScannerSettings } from '@/lib/types';
import { Button, Input } from '@first2apply/ui';
import { Switch } from '@first2apply/ui';
import { useToast } from '@first2apply/ui';
import { PauseIcon, PlayIcon } from '@radix-ui/react-icons';
import * as luxon from 'luxon';
import { useEffect, useState } from 'react';

import { DefaultLayout } from './defaultLayout';

export function SettingsPage() {
  const { handleError } = useError();
  const { toast } = useToast();
  const { isLoading: isLoadingSession, logout: resetUser, user, profile, stripeConfig } = useSession();
  const { isLoading: isLoadingSettings, settings, updateSettings } = useSettings();
  const { newUpdate } = useAppState();
  const [isLoadingAiConfig, setIsLoadingAiConfig] = useState(true);
  const [aiForm, setAiForm] = useState<AiProvidersFormState>(() => buildAiFormStateFromConfig({} as AdvancedMatchingConfigWithAI));

  const isLoading = !profile || !stripeConfig || isLoadingSettings || isLoadingSession || isLoadingAiConfig;
  const hasNewUpdate = !!newUpdate;

  useEffect(() => {
    const loadAiConfig = async () => {
      try {
        const config = await getAdvancedMatchingConfig();
        if (config) {
          setAiForm(buildAiFormStateFromConfig(config));
        }
      } catch (error) {
        handleError({ error, title: 'Failed to load AI settings' });
      } finally {
        setIsLoadingAiConfig(false);
      }
    };

    loadAiConfig();
  }, [handleError]);

  // Update settings
  const onUpdatedSettings = async (newSettings: JobScannerSettings) => {
    try {
      await updateSettings(newSettings);
    } catch (error) {
      handleError({ error });
    }
  };

  // Logout
  const onLogout = async () => {
    try {
      await logout();
      resetUser();
    } catch (error) {
      handleError({ error });
    }
  };

  // Update cron rule
  const onCronRuleChange = async (cronRule: string | undefined) => {
    try {
      const newSettings = { ...settings, cronRule };
      await updateSettings(newSettings);
    } catch (error) {
      handleError({ error, title: 'Failed to update notification frequency' });
    }
  };

  const onApplyUpdate = async () => {
    try {
      await applyAppUpdate();
    } catch (error) {
      handleError({ error });
    }
  };

  const onSaveAiSettings = async () => {
    try {
      const providersInUse = collectProvidersInUse(aiForm.taskConfigs);
      for (const provider of providersInUse) {
        const key = aiForm.apiKeyInputs[provider];
        if (!key) {
          continue;
        }
        const validationError = validateApiKeyFormat(provider, key);
        if (validationError) {
          toast({
            title: 'Invalid API key',
            description: `${provider}: ${validationError}`,
            variant: 'destructive',
          });
          return;
        }
      }

      const missingKeys = providersInUse.filter(
        (provider) => !aiForm.apiKeyInputs[provider]?.trim() && !aiForm.storedProviders.includes(provider),
      );
      if (missingKeys.length > 0) {
        const shouldContinue = window.confirm(
          `Missing API keys for: ${missingKeys.join(', ')}. Custom scraping and AI filters will not work until you add keys. Continue saving anyway?`,
        );
        if (!shouldContinue) {
          return;
        }
      }

      const currentConfig = await getAdvancedMatchingConfig();
      const updatedConfig = await updateAdvancedMatchingConfig({
        chatgpt_prompt: currentConfig?.chatgpt_prompt ?? '',
        blacklisted_companies: currentConfig?.blacklisted_companies ?? [],
        favorite_companies: currentConfig?.favorite_companies ?? [],
        watched_companies: currentConfig?.watched_companies ?? [],
        ...buildAdvancedMatchingAiPayload(aiForm),
      });

      const nextForm = buildAiFormStateFromConfig(updatedConfig);
      for (const provider of providersInUse) {
        if (aiForm.apiKeyInputs[provider]?.trim()) {
          nextForm.storedProviders = [...new Set([...nextForm.storedProviders, provider])];
        }
      }
      setAiForm({ ...nextForm, apiKeyInputs: {} });
      toast({ title: 'AI settings saved' });
    } catch (error) {
      handleError({ error, title: 'Failed to save AI settings' });
    }
  };

  if (isLoading) {
    return (
      <DefaultLayout className="space-y-2">
        <SettingsSkeleton />
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout className="max-w-4xl space-y-2">
      <CompactPageHeader title="Settings" />

      {hasNewUpdate && (
        <CompactPanel title="App Update">
          <CompactKvTable>
            <tbody>
              <CompactKvRow label={newUpdate.name} hint={newUpdate.message}>
                {!profile.is_trial ? (
                  <Button size="sm" onClick={() => onApplyUpdate()}>
                    Update now
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Available after trial</span>
                )}
              </CompactKvRow>
            </tbody>
          </CompactKvTable>
        </CompactPanel>
      )}

      <CompactPanel title="Account & Scanner">
        <CompactKvTable>
          <tbody>
            <CompactKvRow label="Plan">
              <span className="mr-2 text-xs font-semibold">
                {profile.subscription_tier.toUpperCase()}
                {profile.is_trial ? ' Trial' : ''}
              </span>
              {!profile.is_trial ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => openExternalUrl(stripeConfig.customerPortalLink)}
                >
                  Manage
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Trial active</span>
              )}
            </CompactKvRow>
            <CompactKvRow label={profile.is_trial ? 'Trial ends' : 'Renews'}>
              <span className="text-xs text-muted-foreground">
                {luxon.DateTime.fromISO(profile.subscription_end_date).toFormat('MMM dd, yyyy')}
              </span>
            </CompactKvRow>
            <CompactKvRow label="Scanner" hint={settings.isPaused ? 'Paused' : 'Running'}>
              <Button
                variant={settings.isPaused ? 'default' : 'secondary'}
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => onUpdatedSettings({ ...settings, isPaused: !settings.isPaused })}
              >
                {settings.isPaused ? <PlayIcon className="h-3.5 w-3.5" /> : <PauseIcon className="h-3.5 w-3.5" />}
              </Button>
            </CompactKvRow>
            <CompactKvRow label="Scan frequency">
              <CronSchedule cronRule={settings.cronRule} onCronRuleChange={onCronRuleChange} />
            </CompactKvRow>
            <CompactKvRow label="LinkedIn interval" hint="Minutes; blank uses default">
              <Input
                type="number"
                min={1}
                max={1440}
                placeholder="Min"
                className="h-6 w-16 text-[10px]"
                value={settings.linkedinScanIntervalMinutes ?? ''}
                onChange={(e) => {
                  const value = e.target.value ? parseInt(e.target.value, 10) : undefined;
                  onUpdatedSettings({ ...settings, linkedinScanIntervalMinutes: value });
                }}
              />
            </CompactKvRow>
            <CompactKvRow label="In-app browser">
              <Switch
                checked={settings.inAppBrowserEnabled}
                onCheckedChange={(checked) => onUpdatedSettings({ ...settings, inAppBrowserEnabled: checked })}
              />
            </CompactKvRow>
            <CompactKvRow label="Prevent sleep" hint="Keep scanning while idle">
              <Switch
                checked={settings.preventSleep}
                onCheckedChange={(checked) => onUpdatedSettings({ ...settings, preventSleep: checked })}
              />
            </CompactKvRow>
            <CompactKvRow label="Sound effects">
              <Switch
                checked={settings.useSound}
                onCheckedChange={(checked) => onUpdatedSettings({ ...settings, useSound: checked })}
              />
            </CompactKvRow>
            <CompactKvRow label="Email alerts">
              <Switch
                checked={settings.areEmailAlertsEnabled}
                onCheckedChange={(checked) => onUpdatedSettings({ ...settings, areEmailAlertsEnabled: checked })}
              />
            </CompactKvRow>
          </tbody>
        </CompactKvTable>
      </CompactPanel>

      <CompactPanel title="AI & API Keys">
        <div className="overflow-x-auto">
          <AiProvidersSection form={aiForm} onChange={setAiForm} />
          <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1">
            <span className="min-w-0 truncate text-[10px] text-muted-foreground">Signed in as {user.email}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={onSaveAiSettings}>
                Save AI settings
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onLogout}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </CompactPanel>
    </DefaultLayout>
  );
}
