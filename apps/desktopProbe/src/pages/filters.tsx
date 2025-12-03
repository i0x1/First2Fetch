import { Icons } from '@/components/icons';
import { Cross2Icon, DownloadIcon, UploadIcon } from '@radix-ui/react-icons';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';

import { PricingOptions } from '@/components/pricingOptions';
import { FiltersSkeleton } from '@/components/skeletons/filtersSkeleton';
import { useError } from '@/hooks/error';
import { useSession } from '@/hooks/session';
import { ProviderName, getProviderModels, getProviderOptions } from '@/lib/aiProviderConfig';
import {
  AdvancedMatchingConfigWithAI,
  UserSettingsImport,
  exportUserSettings,
  getAdvancedMatchingConfig,
  openExternalUrl,
  importUserSettings,
  updateAdvancedMatchingConfig,
  addWatchedCompany,
  removeWatchedCompany,
} from '@/lib/electronMainSdk';
import { StripeBillingPlan, SubscriptionTier } from '@first2apply/core';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@first2apply/ui';
import { Badge } from '@first2apply/ui';
import { Button } from '@first2apply/ui';
import { Input } from '@first2apply/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@first2apply/ui';
import { Label } from '@first2apply/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@first2apply/ui';
import { useToast } from '@first2apply/ui';

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

  // AI Provider configuration
  const [aiProvider, setAiProvider] = useState<ProviderName | ''>('');
  const [aiModel, setAiModel] = useState<string>('');
  const [aiApiKey, setAiApiKey] = useState<string>('');
  const [hasStoredAiApiKey, setHasStoredAiApiKey] = useState<boolean>(false);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);

  // Available models per provider - now uses centralized config
  const availableModels = useMemo(() => {
    if (aiProvider) {
      return getProviderModels(aiProvider as ProviderName);
    }
    return [];
  }, [aiProvider]);

  // Provider options from centralized config
  const providerOptions = useMemo(() => getProviderOptions(), []);

  /**
   * Hydrate state from API response
   */
  const hydrateConfigFromResponse = useCallback((config: AdvancedMatchingConfigWithAI) => {
    setUserAiInput(config.chatgpt_prompt);
    setBlacklistedCompanies(config.blacklisted_companies);
    setFavoriteCompanies(config.favorite_companies ?? []);
    setWatchedCompanies(config.watched_companies ?? []);
    const providerValue = config.ai_provider;
    setAiProvider(providerValue === 'openai' || providerValue === 'google_gemini' ? providerValue : '');
    setAiModel(config.ai_model ?? '');
    // API key is cleared from response for security, so if there's a provider set,
    // assume there's a stored key. Only set to false if provider is also null/cleared.
    const hasProvider = providerValue === 'openai' || providerValue === 'google_gemini';
    setHasStoredAiApiKey(hasProvider || Boolean(config.ai_api_key_encrypted));
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

  /**
   * Validate API key format (basic validation)
   */
  const validateApiKey = (provider: string, apiKey: string): string | null => {
    if (!apiKey) return null; // API key is optional if provider is not set

    if (provider === 'openai') {
      if (!apiKey.startsWith('sk-')) {
        return 'OpenAI API keys should start with "sk-"';
      }
      if (apiKey.length < 20) {
        return 'OpenAI API key appears to be too short';
      }
    } else if (provider === 'google_gemini') {
      if (apiKey.length < 20) {
        return 'Google Gemini API key appears to be too short';
      }
    }
    return null;
  };

  const normalizeCompany = (company: string) => company.trim();
  const companyListHas = (companies: string[], candidate: string) =>
    companies.some((company) => company.toLowerCase() === candidate.toLowerCase());
  const filterCompanyFromList = (companies: string[], candidate: string) =>
    companies.filter((company) => company.toLowerCase() !== candidate.toLowerCase());

  const handleAddBlacklistedCompany = () => {
    const normalized = normalizeCompany(addBlacklistedCompany);
    if (!normalized) {
      return;
    }

    if (companyListHas(blacklistedCompanies, normalized)) {
      setAddBlacklistedCompany('');
      return;
    }

    setBlacklistedCompanies([...blacklistedCompanies, normalized]);
    setFavoriteCompanies((companies) => filterCompanyFromList(companies, normalized));
    setAddBlacklistedCompany('');
  };

  const handleAddFavoriteCompany = async () => {
    const normalized = normalizeCompany(addFavoriteCompany);
    if (!normalized) {
      return;
    }

    if (companyListHas(favoriteCompanies, normalized)) {
      setAddFavoriteCompany('');
      return;
    }

    try {
      // If company is in watched, it will be moved to favorites by the API
      const updatedConfig = await updateAdvancedMatchingConfig({
        chatgpt_prompt: userAiInput,
        blacklisted_companies: filterCompanyFromList(blacklistedCompanies, normalized),
        favorite_companies: [...favoriteCompanies, normalized],
        watched_companies: filterCompanyFromList(watchedCompanies, normalized),
        ai_provider: aiProvider || null,
        ai_model: aiModel || null,
      });
      hydrateConfigFromResponse(updatedConfig);
      setAddFavoriteCompany('');
    } catch (error) {
      handleError({ error, title: 'Failed to add favorite company' });
    }
  };

  const handleAddWatchedCompany = async () => {
    const normalized = normalizeCompany(addWatchedCompanyInput);
    if (!normalized) {
      return;
    }

    if (companyListHas(watchedCompanies, normalized) || companyListHas(favoriteCompanies, normalized)) {
      setAddWatchedCompanyInput('');
      return;
    }

    try {
      const updatedConfig = await addWatchedCompany(normalized);
      hydrateConfigFromResponse(updatedConfig);
      setAddWatchedCompanyInput('');
    } catch (error) {
      handleError({ error, title: 'Failed to add watched company' });
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
      // Validate API key if provider is selected
      if (aiProvider && aiApiKey) {
        const validationError = validateApiKey(aiProvider, aiApiKey);
        if (validationError) {
          toast({
            title: 'Invalid API Key',
            description: validationError,
            variant: 'destructive',
          });
          return;
        }
      }

      // If provider is selected but no API key, warn user
      if (aiProvider && !aiApiKey && !hasStoredAiApiKey) {
        const shouldContinue = window.confirm(
          'You selected an AI provider but did not provide an API key. The system will use the default provider. Continue?',
        );
        if (!shouldContinue) {
          return;
        }
      }

      const updatedConfig = await updateAdvancedMatchingConfig({
        chatgpt_prompt: userAiInput,
        blacklisted_companies: blacklistedCompanies,
        favorite_companies: favoriteCompanies,
        watched_companies: watchedCompanies,
        ai_provider: aiProvider || null,
        ai_model: aiModel || null,
        ai_api_key_encrypted: aiApiKey || null, // This will be encrypted on the backend
      });
      hydrateConfigFromResponse(updatedConfig);
      if (aiApiKey) {
        // Clear API key after saving for security but remember that one is stored
        setAiApiKey('');
        setHasStoredAiApiKey(true);
      } else if (!aiProvider) {
        // If provider cleared, ensure we reset stored state
        setHasStoredAiApiKey(false);
      }

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
      <DefaultLayout className="flex flex-col p-6 md:p-10">
        <FiltersSkeleton />
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout className="flex flex-col space-y-16 p-6 md:p-10">
      <h1 className="w-fit text-2xl font-medium tracking-wide">Advanced Matching</h1>

      <section>
        <h2 className="mb-4 text-lg font-medium">Job filter prompt</h2>
        <div className="relative">
          <TextareaAutosize
            value={userAiInput}
            placeholder='E.g. "Avoid Java or senior roles", "Seeking $60K+ salary, remote opportunities", "Suitable for under 2 years of experience"'
            autoFocus={true}
            onChange={(evt) => {
              const newValue = evt.target.value;
              setUserAiInput(newValue);
            }}
            minRows={3}
            maxLength={5000}
            className="w-full resize-none rounded-md border border-border bg-card px-6 py-4 text-base ring-ring placeholder:text-muted-foreground focus:outline-none focus:ring-2"
          />
          <span className="absolute bottom-4 right-4 text-sm text-muted-foreground">{userAiInput.length}/5000</span>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium">Blacklist companies</h2>

        <div className="flex w-full gap-2">
          <div className="relative flex-1">
            <Input
              value={addBlacklistedCompany}
              placeholder="E.g. Luxoft"
              onChange={(evt) => setAddBlacklistedCompany(evt.target.value)}
              maxLength={100}
              className="bg-card px-6 pr-20 text-base ring-ring placeholder:text-base focus-visible:ring-2"
            />
            <span className="absolute bottom-2 right-4 text-sm text-muted-foreground">
              {addBlacklistedCompany.length}/100
            </span>
          </div>

          <Button variant="secondary" className="w-36 border border-border" onClick={handleAddBlacklistedCompany}>
            Add company
          </Button>
        </div>

        <div className="mt-4">
          {blacklistedCompanies.length === 0 ? (
            <p>You haven't blacklisted any companies yet</p>
          ) : (
            <TooltipProvider delayDuration={500}>
              <div className="flex flex-wrap gap-2">
                {(showAllBlacklistedCompanies ? blacklistedCompanies : blacklistedCompanies.slice(0, 10)).map(
                  (company) => (
                    <Badge
                      key={company}
                      className="flex items-center gap-2 border border-border bg-card py-1 pl-4 pr-2 text-base hover:bg-card"
                    >
                      {company}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="inline-flex items-center justify-center"
                            onClick={() => setBlacklistedCompanies(filterCompanyFromList(blacklistedCompanies, company))}
                          >
                            <Cross2Icon className="h-4 w-4 text-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="mt-2 text-sm">
                          Remove
                        </TooltipContent>
                      </Tooltip>
                    </Badge>
                  ),
                )}
                {blacklistedCompanies.length > 10 && !showAllBlacklistedCompanies && (
                  <Button variant="secondary" className="py-2" onClick={() => setShowAllBlacklistedCompanies(true)}>
                    See All
                  </Button>
                )}
                {showAllBlacklistedCompanies && (
                  <Button variant="secondary" className="py-2" onClick={() => setShowAllBlacklistedCompanies(false)}>
                    Show Less
                  </Button>
                )}
              </div>
            </TooltipProvider>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium">Favorite companies</h2>

        <div className="flex w-full gap-2">
          <div className="relative flex-1">
            <Input
              value={addFavoriteCompany}
              placeholder="E.g. Google"
              onChange={(evt) => setAddFavoriteCompany(evt.target.value)}
              maxLength={100}
              className="bg-card px-6 pr-20 text-base ring-ring placeholder:text-base focus-visible:ring-2"
            />
            <span className="absolute bottom-2 right-4 text-sm text-muted-foreground">
              {addFavoriteCompany.length}/100
            </span>
          </div>

          <Button variant="secondary" className="w-36 border border-border" onClick={handleAddFavoriteCompany}>
            Add favorite
          </Button>
        </div>

        <div className="mt-4">
          {favoriteCompanies.length === 0 ? (
            <p>You haven't added any favorite companies yet</p>
          ) : (
            <TooltipProvider delayDuration={500}>
              <div className="flex flex-wrap gap-2">
                {(showAllFavoriteCompanies ? favoriteCompanies : favoriteCompanies.slice(0, 10)).map((company) => (
                  <Badge
                    key={company}
                    className="flex items-center gap-2 border border-border bg-card py-1 pl-4 pr-2 text-base hover:bg-card"
                  >
                    {company}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="inline-flex items-center justify-center"
                          onClick={() => setFavoriteCompanies(filterCompanyFromList(favoriteCompanies, company))}
                        >
                          <Cross2Icon className="h-4 w-4 text-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="mt-2 text-sm">
                        Remove
                      </TooltipContent>
                    </Tooltip>
                  </Badge>
                ))}
                {favoriteCompanies.length > 10 && !showAllFavoriteCompanies && (
                  <Button variant="secondary" className="py-2" onClick={() => setShowAllFavoriteCompanies(true)}>
                    See All
                  </Button>
                )}
                {showAllFavoriteCompanies && (
                  <Button variant="secondary" className="py-2" onClick={() => setShowAllFavoriteCompanies(false)}>
                    Show Less
                  </Button>
                )}
              </div>
            </TooltipProvider>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium">Watched companies</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Watched companies are highlighted in job listings but don't affect sorting. Click the favorite button twice to promote a watched company to favorites.
        </p>

        <div className="flex w-full gap-2">
          <div className="relative flex-1">
            <Input
              value={addWatchedCompanyInput}
              placeholder="E.g. Microsoft"
              onChange={(evt) => setAddWatchedCompanyInput(evt.target.value)}
              maxLength={100}
              className="bg-card px-6 pr-20 text-base ring-ring placeholder:text-base focus-visible:ring-2"
              onKeyDown={(evt) => {
                if (evt.key === 'Enter') {
                  handleAddWatchedCompany();
                }
              }}
            />
            <span className="absolute bottom-2 right-4 text-sm text-muted-foreground">
              {addWatchedCompanyInput.length}/100
            </span>
          </div>

          <Button variant="secondary" className="w-36 border border-border" onClick={handleAddWatchedCompany}>
            Add watched
          </Button>
        </div>

        <div className="mt-4">
          {watchedCompanies.length === 0 ? (
            <p>You haven't added any watched companies yet</p>
          ) : (
            <TooltipProvider delayDuration={500}>
              <div className="flex flex-wrap gap-2">
                {(showAllWatchedCompanies ? watchedCompanies : watchedCompanies.slice(0, 10)).map((company) => (
                  <Badge
                    key={company}
                    className="flex items-center gap-2 border border-border bg-card py-1 pl-4 pr-2 text-base hover:bg-card"
                  >
                    {company}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="inline-flex items-center justify-center"
                          onClick={() => handleRemoveWatchedCompany(company)}
                        >
                          <Cross2Icon className="h-4 w-4 text-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="mt-2 text-sm">
                        Remove
                      </TooltipContent>
                    </Tooltip>
                  </Badge>
                ))}
                {watchedCompanies.length > 10 && !showAllWatchedCompanies && (
                  <Button variant="secondary" className="py-2" onClick={() => setShowAllWatchedCompanies(true)}>
                    See All
                  </Button>
                )}
                {showAllWatchedCompanies && (
                  <Button variant="secondary" className="py-2" onClick={() => setShowAllWatchedCompanies(false)}>
                    Show Less
                  </Button>
                )}
              </div>
            </TooltipProvider>
          )}
        </div>
      </section>

      {/* AI Provider Configuration Section */}
      <section className="rounded-lg border border-border/70 bg-card/50 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-medium">AI Provider (optional)</h2>
          {aiProvider && (
            <span className="text-xs text-muted-foreground">
              {providerOptions.find((option) => option.value === aiProvider)?.label}
            </span>
          )}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ai-provider">Provider</Label>
            <Select
              value={aiProvider}
              onValueChange={(value) => {
                const provider = value as ProviderName;
                if (provider !== aiProvider) {
                  setAiApiKey('');
                  setHasStoredAiApiKey(false);
                }
                setAiProvider(provider);
                setAiModel(''); // Reset model when provider changes
              }}
            >
              <SelectTrigger id="ai-provider" className="w-full">
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

          {aiProvider && (
            <div className="space-y-1.5">
              <Label htmlFor="ai-model">Model</Label>
              <Select value={aiModel} onValueChange={setAiModel}>
                <SelectTrigger id="ai-model" className="w-full">
                  <SelectValue placeholder="Choose model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                      {model.isBudget ? ' · Budget' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {aiProvider && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ai-api-key">API Key</Label>
              <div className="space-y-1">
                <div className="relative">
                  <Input
                    id="ai-api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    placeholder={
                      hasStoredAiApiKey && aiApiKey === ''
                        ? 'API key saved securely (enter a new key to replace)'
                        : `Enter ${aiProvider === 'openai' ? 'OpenAI' : 'Google Gemini'} API key`
                    }
                    className="pr-20"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 h-8 -translate-y-1/2 px-2"
                    onClick={() => setShowApiKey(!showApiKey)}
                    disabled={aiApiKey.length === 0}
                  >
                    {showApiKey ? 'Hide' : 'Show'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {hasStoredAiApiKey && aiApiKey === ''
                    ? 'API key saved securely. Enter a new key if you need to replace it.'
                    : 'Stored encrypted after you save.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex items-center gap-2"
            onClick={handleExportSettings}
            disabled={isExportingSettings}
          >
            {isExportingSettings ? <Icons.spinner2 className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}
            <span>Export</span>
          </Button>
          <Button
            variant="secondary"
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
        <Button className="w-36" onClick={onSave}>
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
