import { Cross2Icon, InfoCircledIcon, MinusCircledIcon } from '@radix-ui/react-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';

import { PricingOptions } from '@/components/pricingOptions';
import { FiltersSkeleton } from '@/components/skeletons/filtersSkeleton';
import { useError } from '@/hooks/error';
import { useSession } from '@/hooks/session';
import { ProviderName, getProviderModels, getProviderOptions } from '@/lib/aiProviderConfig';
import {
  AdvancedMatchingConfigWithAI,
  getAdvancedMatchingConfig,
  openExternalUrl,
  updateAdvancedMatchingConfig,
} from '@/lib/electronMainSdk';
import { StripeBillingPlan, SubscriptionTier } from '@first2apply/core';
import { Alert, AlertDescription, AlertTitle } from '@first2apply/ui';
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
  const [isSubscriptionDialogOpen, setSubscriptionDialogOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showAllBlacklistedCompanies, setShowAllBlacklistedCompanies] = useState(false);

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
    const providerValue = config.ai_provider;
    setAiProvider(providerValue === 'openai' || providerValue === 'google_gemini' ? providerValue : '');
    setAiModel(config.ai_model ?? '');
    setHasStoredAiApiKey(Boolean(config.ai_api_key_encrypted));
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
  }, [handleError, hydrateConfigFromResponse]);

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
        <p className="mb-4 text-lg">
          Set your preferences and let <span className="font-medium">AI</span> find the{' '}
          <span className="font-medium">right jobs</span> for you. Just tell us what you’re looking for:
        </p>

        <div className="relative">
          <TextareaAutosize
            value={userAiInput}
            placeholder='E.g. "Avoid Java or senior roles", "Seeking $60K+ salary, remote opportunities", "Suitable for under 2 years of experience"'
            autoFocus={true}
            onChange={(evt) => setUserAiInput(evt.target.value)}
            minRows={3}
            maxLength={5000}
            className="w-full resize-none rounded-md border border-border bg-card px-6 py-4 text-base ring-ring placeholder:text-muted-foreground focus:outline-none focus:ring-2"
          />
          <span className="absolute bottom-4 right-4 text-sm text-muted-foreground">{userAiInput.length}/5000</span>
        </div>

        <Alert className="flex items-center gap-2 border-0 p-0">
          <AlertTitle className="mb-0">
            <InfoCircledIcon className="h-4 w-4 text-muted-foreground" />
          </AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">
            Pro Tips: Exclude skills you don’t want, specify salary expectations, define experience levels, select job
            specifics like remote work or PTO preferences and more.
          </AlertDescription>
        </Alert>
      </section>

      {/* HERE STARTS THE BLACKLISTING */}

      <section>
        <p className="mb-4 text-lg">
          <span className="font-medium">Blacklist companies</span> you don’t want to work for. We’ll make sure you{' '}
          <span className="font-medium">don’t see jobs</span> from them anymore:
        </p>

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

          <Button
            variant="secondary"
            className="w-36 border border-border"
            onClick={() => {
              if (addBlacklistedCompany) {
                setBlacklistedCompanies([...blacklistedCompanies, addBlacklistedCompany]);
                setAddBlacklistedCompany('');
              }
            }}
          >
            Add company
          </Button>
        </div>

        <Alert className="mt-1.5 flex items-center gap-2 border-0 p-0">
          <AlertTitle className="mb-0">
            <MinusCircledIcon className="h-4 w-4 text-destructive/90" />
          </AlertTitle>
          <AlertDescription className="text-sm text-destructive/90">
            Attention: Ensure you input the company name accurately without any typos.
          </AlertDescription>
        </Alert>

        <div className="mt-4">
          {blacklistedCompanies.length === 0 ? (
            <p>You haven't blacklisted any companies yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(showAllBlacklistedCompanies ? blacklistedCompanies : blacklistedCompanies.slice(0, 10)).map(
                (company) => (
                  <Badge
                    key={company}
                    className="flex items-center gap-2 border border-border bg-card py-1 pl-4 pr-2 text-base hover:bg-card"
                  >
                    {company}
                    <TooltipProvider delayDuration={500}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="inline-flex items-center justify-center"
                            onClick={() => setBlacklistedCompanies(blacklistedCompanies.filter((c) => c !== company))}
                          >
                            <Cross2Icon className="h-4 w-4 text-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="mt-2 text-sm">
                          Remove
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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

      <Button className="ml-auto w-36" onClick={onSave}>
        Save filters
      </Button>

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
