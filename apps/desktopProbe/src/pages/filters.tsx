import { Icons } from '@/components/icons';
import {
  CompactChip,
  CompactChipList,
  CompactGrid,
  CompactPageHeader,
  CompactPanel,
} from '@/components/compact/compactLayout';
import { Cross2Icon, DownloadIcon, UploadIcon } from '@radix-ui/react-icons';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';

import { PricingOptions } from '@/components/pricingOptions';
import { FiltersSkeleton } from '@/components/skeletons/filtersSkeleton';
import { useError } from '@/hooks/error';
import { useSession } from '@/hooks/session';
import {
  buildAdvancedMatchingAiPayload,
  buildAiFormStateFromConfig,
} from '@/components/aiProvidersSection';
import {
  UserSettingsImport,
  exportUserSettings,
  getAdvancedMatchingConfig,
  openExternalUrl,
  importUserSettings,
  removeWatchedCompany,
  updateAdvancedMatchingConfig,
} from '@/lib/electronMainSdk';
import { StripeBillingPlan, SubscriptionTier } from '@first2apply/core';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@first2apply/ui';
import { Button } from '@first2apply/ui';
import { Input } from '@first2apply/ui';
import { useToast } from '@first2apply/ui';

import {
  companyListHas,
  filterCompanyFromList,
  mergeUniqueCompanies,
  normalizeCompanyList,
  parseCompanyInput,
} from '@/lib/companyListUtils';
import { DefaultLayout } from './defaultLayout';

export function FiltersPage() {
  const { handleError } = useError();
  const { toast } = useToast();
  const { profile, stripeConfig, refreshProfile } = useSession();

  const [userAiInput, setUserAiInput] = useState<string>('');
  const [blacklistedCompanies, setBlacklistedCompanies] = useState<string[]>([]);
  const [addBlacklistedCompany, setAddBlacklistedCompany] = useState<string>('');
  const [favoriteCompanies, setFavoriteCompanies] = useState<string[]>([]);
  const [addFavoriteCompany, setAddFavoriteCompany] = useState<string>('');
  const [watchedCompanies, setWatchedCompanies] = useState<string[]>([]);
  const [addWatchedCompanyInput, setAddWatchedCompanyInput] = useState<string>('');
  const [isSubscriptionDialogOpen, setSubscriptionDialogOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showAllBlacklistedCompanies, setShowAllBlacklistedCompanies] = useState(false);
  const [showAllFavoriteCompanies, setShowAllFavoriteCompanies] = useState(false);
  const [showAllWatchedCompanies, setShowAllWatchedCompanies] = useState(false);
  const [isExportingSettings, setIsExportingSettings] = useState(false);
  const [isImportingSettings, setIsImportingSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Hydrate state from API response
   */
  const hydrateConfigFromResponse = useCallback((config: Awaited<ReturnType<typeof getAdvancedMatchingConfig>>) => {
    if (!config) {
      return;
    }
    setUserAiInput(config.chatgpt_prompt);
    setBlacklistedCompanies(normalizeCompanyList(config.blacklisted_companies));
    setFavoriteCompanies(normalizeCompanyList(config.favorite_companies ?? []));
    setWatchedCompanies(normalizeCompanyList(config.watched_companies ?? []));
  }, []);

  /**
   * Load the advanced matching filters from the user's profile.
   */
  useEffect(() => {
    const asyncLoad = async () => {
      try {
        const config = await getAdvancedMatchingConfig();
        if (config) {
          hydrateConfigFromResponse(config);
        }
      } catch (error) {
        handleError({ error, title: 'Failed to load advanced matching filters' });
      } finally {
        setIsLoading(false);
      }
    };
    asyncLoad();
  }, []); // Only run once on mount

  const addCompaniesFromInput = (
    input: string,
    {
      onAdded,
      clearInput,
    }: {
      onAdded: (companies: string[]) => void;
      clearInput: () => void;
    },
  ) => {
    const companies = parseCompanyInput(input);
    if (companies.length === 0) {
      return;
    }

    onAdded(companies);
    clearInput();
  };

  const handleAddBlacklistedCompany = (rawInput?: string) => {
    addCompaniesFromInput(rawInput ?? addBlacklistedCompany, {
      clearInput: () => setAddBlacklistedCompany(''),
      onAdded: (companies) => {
        const updatedBlacklist = mergeUniqueCompanies(blacklistedCompanies, companies);
        const addedKeys = new Set(companies.map((company) => company.toLowerCase()));

        setBlacklistedCompanies(updatedBlacklist);
        setFavoriteCompanies((existing) =>
          existing.filter((company) => !addedKeys.has(company.toLowerCase())),
        );
        setWatchedCompanies((existing) =>
          existing.filter((company) => !addedKeys.has(company.toLowerCase())),
        );
      },
    });
  };

  const handleAddFavoriteCompany = async (rawInput?: string) => {
    const companies = parseCompanyInput(rawInput ?? addFavoriteCompany);
    if (companies.length === 0) {
      return;
    }

    const newFavorites = companies.filter((company) => !companyListHas(favoriteCompanies, company));
    if (newFavorites.length === 0) {
      setAddFavoriteCompany('');
      return;
    }

    try {
      const currentConfig = await getAdvancedMatchingConfig();
      const preservedAiPayload = currentConfig
        ? buildAdvancedMatchingAiPayload(buildAiFormStateFromConfig(currentConfig))
        : {};

      const addedKeys = new Set(newFavorites.map((company) => company.toLowerCase()));
      const updatedConfig = await updateAdvancedMatchingConfig({
        chatgpt_prompt: userAiInput,
        blacklisted_companies: blacklistedCompanies.filter(
          (company) => !addedKeys.has(company.toLowerCase()),
        ),
        favorite_companies: mergeUniqueCompanies(favoriteCompanies, newFavorites),
        watched_companies: watchedCompanies.filter((company) => !addedKeys.has(company.toLowerCase())),
        ...preservedAiPayload,
      });
      hydrateConfigFromResponse(updatedConfig);
      setAddFavoriteCompany('');
    } catch (error) {
      handleError({ error, title: 'Failed to add favorite company' });
    }
  };

  const handleAddWatchedCompany = async (rawInput?: string) => {
    const companies = parseCompanyInput(rawInput ?? addWatchedCompanyInput);
    if (companies.length === 0) {
      return;
    }

    const newWatched = companies.filter(
      (company) => !companyListHas(watchedCompanies, company) && !companyListHas(favoriteCompanies, company),
    );
    if (newWatched.length === 0) {
      setAddWatchedCompanyInput('');
      return;
    }

    try {
      const currentConfig = await getAdvancedMatchingConfig();
      const preservedAiPayload = currentConfig
        ? buildAdvancedMatchingAiPayload(buildAiFormStateFromConfig(currentConfig))
        : {};

      const updatedConfig = await updateAdvancedMatchingConfig({
        chatgpt_prompt: currentConfig?.chatgpt_prompt ?? userAiInput,
        blacklisted_companies: currentConfig?.blacklisted_companies ?? blacklistedCompanies,
        favorite_companies: currentConfig?.favorite_companies ?? favoriteCompanies,
        watched_companies: mergeUniqueCompanies(watchedCompanies, newWatched),
        ...preservedAiPayload,
      });
      hydrateConfigFromResponse(updatedConfig);
      setAddWatchedCompanyInput('');
    } catch (error) {
      handleError({ error, title: 'Failed to add watched company' });
    }
  };

  const handleCompanyPaste = (
    evt: React.ClipboardEvent<HTMLInputElement>,
    inputValue: string,
    addHandler: (combinedInput: string) => void | Promise<void>,
  ) => {
    const pasted = evt.clipboardData.getData('text');
    const combined = `${inputValue}${pasted}`;

    if (parseCompanyInput(combined).length > 1) {
      evt.preventDefault();
      void addHandler(combined);
    }
  };

  const handleRemoveWatchedCompany = async (company: string) => {
    try {
      const updatedConfig = await removeWatchedCompany(company);
      hydrateConfigFromResponse(updatedConfig);
    } catch (error) {
      handleError({ error, title: 'Failed to remove watched company' });
    }
  };

  const handleExportSettings = async () => {
    try {
      setIsExportingSettings(true);
      const settings = await exportUserSettings();
      const json = JSON.stringify(settings, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      // Format: YYYY-MM-DDTHH-MM-SS (filesystem-friendly, includes time and seconds)
      const now = new Date();
      const timestamp = now.toISOString().replace(/:/g, '-').split('.')[0]; // e.g., "2025-12-01T22-10-47"
      anchor.href = url;
      anchor.download = `first2fetch-settings-${timestamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      toast({
        title: 'Settings exported',
        description: 'We saved your configuration to a JSON file.',
      });
    } catch (error) {
      handleError({ error, title: 'Failed to export settings' });
    } finally {
      setIsExportingSettings(false);
    }
  };

  const handleImportSettingsFromFile = async (evt: ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setIsImportingSettings(true);
      const fileContent = await file.text();
      const parsedSettings = JSON.parse(fileContent) as UserSettingsImport;
      const updatedConfig = await importUserSettings(parsedSettings);
      hydrateConfigFromResponse(updatedConfig);
      toast({
        title: 'Settings imported',
        description: 'We refreshed your filters and company preferences.',
      });
    } catch (error) {
      handleError({ error, title: 'Failed to import settings' });
    } finally {
      setIsImportingSettings(false);
      evt.target.value = '';
    }
  };

  const triggerImportSettings = () => {
    fileInputRef.current?.click();
  };

  /**
   * Save the config to the database.
   */
  const onSave = async () => {
    try {
      const currentConfig = await getAdvancedMatchingConfig();
      const preservedAiPayload = currentConfig
        ? buildAdvancedMatchingAiPayload(buildAiFormStateFromConfig(currentConfig))
        : {};

      const updatedConfig = await updateAdvancedMatchingConfig({
        chatgpt_prompt: userAiInput,
        blacklisted_companies: blacklistedCompanies,
        favorite_companies: favoriteCompanies,
        watched_companies: watchedCompanies,
        ...preservedAiPayload,
      });
      hydrateConfigFromResponse(updatedConfig);

      // if the user is not on the PRO plan, show the subscription dialog
      if (profile.subscription_tier !== 'pro') {
        setSubscriptionDialogOpen(true);
        return;
      } else {
        toast({ title: 'Advanced matching filters saved' });
      }
    } catch (error) {
      handleError({ error, title: 'Failed to save advanced matching filters' });
    }
  };

  /**
   * Handle plan selection from a trial customer.
   */
  const onSelectPlan = async ({ tier, billingCycle }: { tier: SubscriptionTier; billingCycle: string }) => {
    try {
      if (!profile.is_trial) {
        await openExternalUrl(stripeConfig.customerPortalLink);
      } else {
        const stripePlan = stripeConfig.plans.find((p) => p.tier === tier);

        if (!stripePlan) {
          console.error(`Stripe plan not found for ${tier}`);
          return;
        }
        const checkoutLink = stripePlan[`${billingCycle}CheckoutLink` as keyof StripeBillingPlan];

        if (!checkoutLink) {
          console.error(`Checkout link not found for ${billingCycle}`);
          return;
        }

        await openExternalUrl(checkoutLink);
      }
    } catch (error) {
      handleError({ error, title: 'Failed to upgrade to PRO plan' });
    }
  };

  const onCloseSubscriptionDialog = async () => {
    try {
      await refreshProfile();
      setSubscriptionDialogOpen(false);
    } catch (error) {
      handleError({ error, title: 'Failed to close subscription dialog' });
    }
  };

  if (isLoading) {
    return (
      <DefaultLayout className="flex flex-col">
        <FiltersSkeleton />
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout className="flex flex-col space-y-3">
      <CompactPageHeader title="Advanced Matching" />

      <CompactPanel title="Job Filter Prompt">
        <div className="relative p-2">
          <TextareaAutosize
            value={userAiInput}
            placeholder='E.g. "Avoid Java or senior roles", "Seeking $60K+ salary, remote opportunities", "Suitable for under 2 years of experience"'
            autoFocus={true}
            onChange={(evt) => setUserAiInput(evt.target.value)}
            minRows={3}
            maxLength={5000}
            className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm ring-ring placeholder:text-muted-foreground focus:outline-none focus:ring-2"
          />
          <span className="absolute bottom-3 right-3 text-[10px] text-muted-foreground">{userAiInput.length}/5000</span>
        </div>
      </CompactPanel>

      <CompactGrid cols={2}>
        <CompactPanel title="Blacklist Companies">
          <div className="space-y-2 p-2">
            <div className="flex w-full gap-2">
              <div className="relative flex-1">
                <Input
                  value={addBlacklistedCompany}
                  placeholder="E.g. Luxoft or Google, Meta, Apple"
                  onChange={(evt) => setAddBlacklistedCompany(evt.target.value)}
                  onPaste={(evt) => handleCompanyPaste(evt, addBlacklistedCompany, handleAddBlacklistedCompany)}
                  onKeyDown={(evt) => {
                    if (evt.key === 'Enter') {
                      handleAddBlacklistedCompany();
                    }
                  }}
                  className="h-8 bg-card text-xs focus-visible:ring-2"
                />
              </div>
              <Button variant="secondary" size="sm" className="h-8" onClick={() => handleAddBlacklistedCompany()}>
                Add
              </Button>
            </div>

            {blacklistedCompanies.length === 0 ? (
              <p className="text-xs text-muted-foreground">No blacklisted companies yet.</p>
            ) : (
              <CompactChipList>
                {(showAllBlacklistedCompanies ? blacklistedCompanies : blacklistedCompanies.slice(0, 10)).map((company) => (
                  <CompactChip
                    key={company}
                    onRemove={() => setBlacklistedCompanies(filterCompanyFromList(blacklistedCompanies, company))}
                  >
                    {company}
                  </CompactChip>
                ))}
                {blacklistedCompanies.length > 10 && !showAllBlacklistedCompanies && (
                  <Button variant="secondary" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setShowAllBlacklistedCompanies(true)}>
                    See all
                  </Button>
                )}
                {showAllBlacklistedCompanies && (
                  <Button variant="secondary" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setShowAllBlacklistedCompanies(false)}>
                    Show less
                  </Button>
                )}
              </CompactChipList>
            )}
          </div>
        </CompactPanel>

        <CompactPanel title="Favorite Companies">
          <div className="space-y-2 p-2">
            <div className="flex w-full gap-2">
              <div className="relative flex-1">
                <Input
                  value={addFavoriteCompany}
                  placeholder="E.g. Google or Google, Meta, Apple"
                  onChange={(evt) => setAddFavoriteCompany(evt.target.value)}
                  onPaste={(evt) => handleCompanyPaste(evt, addFavoriteCompany, handleAddFavoriteCompany)}
                  onKeyDown={(evt) => {
                    if (evt.key === 'Enter') {
                      void handleAddFavoriteCompany();
                    }
                  }}
                  className="h-8 bg-card text-xs focus-visible:ring-2"
                />
              </div>
              <Button variant="secondary" size="sm" className="h-8" onClick={() => void handleAddFavoriteCompany()}>
                Add
              </Button>
            </div>

            {favoriteCompanies.length === 0 ? (
              <p className="text-xs text-muted-foreground">No favorite companies yet.</p>
            ) : (
              <CompactChipList>
                {(showAllFavoriteCompanies ? favoriteCompanies : favoriteCompanies.slice(0, 10)).map((company) => (
                  <CompactChip
                    key={company}
                    onRemove={() => setFavoriteCompanies(filterCompanyFromList(favoriteCompanies, company))}
                  >
                    {company}
                  </CompactChip>
                ))}
                {favoriteCompanies.length > 10 && !showAllFavoriteCompanies && (
                  <Button variant="secondary" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setShowAllFavoriteCompanies(true)}>
                    See all
                  </Button>
                )}
                {showAllFavoriteCompanies && (
                  <Button variant="secondary" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setShowAllFavoriteCompanies(false)}>
                    Show less
                  </Button>
                )}
              </CompactChipList>
            )}
          </div>
        </CompactPanel>

        <CompactPanel title="Watched Companies" className="md:col-span-2">
          <div className="space-y-2 p-2">
            <p className="text-xs text-muted-foreground">
              Highlight-only list. Favoriting a watched company promotes it in ranking.
            </p>
            <div className="flex w-full gap-2">
              <div className="relative flex-1">
                <Input
                  value={addWatchedCompanyInput}
                  placeholder="E.g. Microsoft or Google, Meta, Apple"
                  onChange={(evt) => setAddWatchedCompanyInput(evt.target.value)}
                  onPaste={(evt) => handleCompanyPaste(evt, addWatchedCompanyInput, handleAddWatchedCompany)}
                  onKeyDown={(evt) => {
                    if (evt.key === 'Enter') {
                      void handleAddWatchedCompany();
                    }
                  }}
                  className="h-8 bg-card text-xs focus-visible:ring-2"
                />
              </div>
              <Button variant="secondary" size="sm" className="h-8" onClick={() => void handleAddWatchedCompany()}>
                Add
              </Button>
            </div>

            {watchedCompanies.length === 0 ? (
              <p className="text-xs text-muted-foreground">No watched companies yet.</p>
            ) : (
              <CompactChipList>
                {(showAllWatchedCompanies ? watchedCompanies : watchedCompanies.slice(0, 10)).map((company) => (
                  <CompactChip key={company} onRemove={() => handleRemoveWatchedCompany(company)}>
                    {company}
                  </CompactChip>
                ))}
                {watchedCompanies.length > 10 && !showAllWatchedCompanies && (
                  <Button variant="secondary" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setShowAllWatchedCompanies(true)}>
                    See all
                  </Button>
                )}
                {showAllWatchedCompanies && (
                  <Button variant="secondary" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setShowAllWatchedCompanies(false)}>
                    Show less
                  </Button>
                )}
              </CompactChipList>
            )}
          </div>
        </CompactPanel>
      </CompactGrid>

      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
            onClick={handleExportSettings}
            disabled={isExportingSettings}
          >
            {isExportingSettings ? <Icons.spinner2 className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}
            <span>Export</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
            onClick={triggerImportSettings}
            disabled={isImportingSettings}
          >
            {isImportingSettings ? <Icons.spinner2 className="h-4 w-4 animate-spin" /> : <UploadIcon className="h-4 w-4" />}
            <span>Import</span>
          </Button>
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept="application/json"
            onChange={handleImportSettingsFromFile}
          />
        </div>
        <Button size="sm" className="w-24" onClick={onSave}>
          Save
        </Button>
      </div>

      <SubscriptionDialog
        isOpen={isSubscriptionDialogOpen}
        onCancel={() => onCloseSubscriptionDialog()}
        onSelectPlan={onSelectPlan}
      />
    </DefaultLayout>
  );
}

function SubscriptionDialog({
  isOpen,
  onCancel,
  onSelectPlan,
}: {
  isOpen: boolean;
  onCancel: () => void;
  onSelectPlan: (_: { tier: SubscriptionTier; billingCycle: string }) => Promise<void>;
}) {
  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent className="max-h-screen max-w-[80%] overflow-y-scroll">
        <AlertDialogHeader>
          <AlertDialogTitle className="mb-5 text-center text-2xl">
            Advanced matching is only available with a <b>PRO</b> plan
            <Cross2Icon className="absolute right-4 top-4 h-6 w-6 cursor-pointer" onClick={onCancel} />
          </AlertDialogTitle>
          <AlertDialogDescription className="">
            <PricingOptions onSelectPlan={onSelectPlan} disableBasic={true}></PricingOptions>
          </AlertDialogDescription>
          <AlertDialogDescription className="flex items-center"></AlertDialogDescription>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>
  );
}
