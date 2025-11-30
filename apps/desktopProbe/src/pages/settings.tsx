import { CronSchedule } from '@/components/cronSchedule';
import { SettingsSkeleton } from '@/components/skeletons/SettingsSkeleton';
import { useAppState } from '@/hooks/appState';
import { useError } from '@/hooks/error';
import { useSession } from '@/hooks/session';
import { useSettings } from '@/hooks/settings';
import { applyAppUpdate, logout, openExternalUrl } from '@/lib/electronMainSdk';
import { JobScannerSettings } from '@/lib/types';
import { Button, Input } from '@first2apply/ui';
import { Switch } from '@first2apply/ui';
import { PauseIcon, PlayIcon } from '@radix-ui/react-icons';
import * as luxon from 'luxon';

import { DefaultLayout } from './defaultLayout';

export function SettingsPage() {
  const { handleError } = useError();
  const { isLoading: isLoadingSession, logout: resetUser, user, profile, stripeConfig } = useSession();
  const { isLoading: isLoadingSettings, settings, updateSettings } = useSettings();
  const { newUpdate } = useAppState();

  const isLoading = !profile || !stripeConfig || isLoadingSettings || isLoadingSession;
  const hasNewUpdate = !!newUpdate;

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

  if (isLoading) {
    return (
      <DefaultLayout className="space-y-3 p-6 md:p-10">
        <SettingsSkeleton />
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout className="space-y-8 p-6 md:p-10 max-w-4xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your preferences and subscription.</p>
      </div>

      {/* New Updates */}
      {hasNewUpdate && (
        <div className="flex flex-row items-center justify-between gap-6 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-900/20">
          <div className="space-y-1">
            <h2 className="text-sm font-medium">
              Update available: <span className="font-bold">{newUpdate.name}</span>
            </h2>
            <p className="text-xs text-muted-foreground">{newUpdate.message}</p>
          </div>
          {!profile.is_trial && (
            <Button size="sm" onClick={() => onApplyUpdate()}>
              Update Now
            </Button>
          )}
        </div>
      )}

      {/* Subscription Card */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
            <h2 className="text-lg font-medium">
                {profile.subscription_tier.toUpperCase()} Plan
                {profile.is_trial && ' (Trial)'}
            </h2>
            <p className="text-sm text-muted-foreground">
                {profile.is_trial ? 'Trial ends on ' : 'Renews on '}
                <span className="font-medium text-foreground">
                {luxon.DateTime.fromISO(profile.subscription_end_date).toFormat('MMMM dd, yyyy')}
                </span>
            </p>
            </div>
            {!profile.is_trial && (
            <Button
                variant="outline"
                onClick={() => openExternalUrl(stripeConfig.customerPortalLink)}
            >
                Manage Subscription
            </Button>
            )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground px-1">Scraping & Behavior</h3>
        <div className="divide-y rounded-xl border bg-card shadow-sm">
            {/* Play/Pause scraping */}
            <div className="flex flex-row items-center justify-between gap-4 p-4">
                <div className="space-y-0.5">
                    <h2 className="text-base font-medium">Job Scraping</h2>
                    <p className="text-sm text-muted-foreground">
                        {settings.isPaused
                        ? 'Scraping is paused.'
                        : 'Active and scanning for jobs.'}
                    </p>
                </div>
                <Button
                    variant={settings.isPaused ? 'default' : 'secondary'}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => onUpdatedSettings({ ...settings, isPaused: !settings.isPaused })}
                >
                    {settings.isPaused ? <PlayIcon className="h-4 w-4" /> : <PauseIcon className="h-4 w-4" />}
                </Button>
            </div>

            {/* Cron settings */}
            <div className="p-4">
                <CronSchedule cronRule={settings.cronRule} onCronRuleChange={onCronRuleChange} />
            </div>

            {/* LinkedIn scan interval override */}
            <div className="flex flex-row items-center justify-between gap-4 p-4">
                <div className="space-y-0.5">
                    <h2 className="text-base font-medium">LinkedIn Scan Interval</h2>
                    <p className="text-sm text-muted-foreground">
                        Override global frequency (minutes). Empty to use default.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Input
                        type="number"
                        min={1}
                        max={1440}
                        placeholder="Min"
                        className="w-20 h-9"
                        value={settings.linkedinScanIntervalMinutes ?? ''}
                        onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value, 10) : undefined;
                            onUpdatedSettings({ ...settings, linkedinScanIntervalMinutes: value });
                        }}
                    />
                </div>
            </div>

            {/* In-app browser settings */}
            <div className="flex flex-row items-center justify-between gap-4 p-4">
                <div className="space-y-0.5">
                    <h2 className="text-base font-medium">In-app Browser</h2>
                    <p className="text-sm text-muted-foreground">Open job listings within the app.</p>
                </div>
                <Switch
                    checked={settings.inAppBrowserEnabled}
                    onCheckedChange={(checked) => onUpdatedSettings({ ...settings, inAppBrowserEnabled: checked })}
                />
            </div>

             {/* Prevent sleep settings */}
             <div className="flex flex-row items-center justify-between gap-4 p-4">
                <div className="space-y-0.5">
                    <h2 className="text-base font-medium">Prevent Sleep</h2>
                    <p className="text-sm text-muted-foreground">Keep scanning while computer is idle.</p>
                </div>
                <Switch
                    checked={settings.preventSleep}
                    onCheckedChange={(checked) => onUpdatedSettings({ ...settings, preventSleep: checked })}
                />
            </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground px-1">Notifications</h3>
        <div className="divide-y rounded-xl border bg-card shadow-sm">
             {/* Notification settings */}
             <div className="flex flex-row items-center justify-between gap-4 p-4">
                <div className="space-y-0.5">
                    <h2 className="text-base font-medium">Sound Effects</h2>
                    <p className="text-sm text-muted-foreground">Play a sound when a new job is found.</p>
                </div>
                <Switch
                    checked={settings.useSound}
                    onCheckedChange={(checked) => onUpdatedSettings({ ...settings, useSound: checked })}
                />
            </div>

            {/* Email notifications */}
            <div className="flex flex-row items-center justify-between gap-4 p-4">
                <div className="space-y-0.5">
                    <h2 className="text-base font-medium">Email Alerts</h2>
                    <p className="text-sm text-muted-foreground">Receive email summaries of new jobs.</p>
                </div>
                <Switch
                    checked={settings.areEmailAlertsEnabled}
                    onCheckedChange={(checked) => onUpdatedSettings({ ...settings, areEmailAlertsEnabled: checked })}
                />
            </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 pt-4 border-t">
        <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Signed in as {user.email}</span>
            <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onLogout}>
            Sign Out
            </Button>
        </div>
      </div>
    </DefaultLayout>
  );
}
