import { InfoCircledIcon } from '@radix-ui/react-icons/dist';
import { useRef, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { useError } from '@/hooks/error';
import { useLinks } from '@/hooks/links';
import { useSites } from '@/hooks/sites';
import { validateJobSearchUrl, cleanJobSearchUrl } from '@/lib/linkValidation';
import { OverlayBrowserViewResult } from '@/lib/types';
import { JobSite, Link } from '@first2apply/core';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@first2apply/ui';
import { useToast } from '@first2apply/ui';
import { Alert, AlertDescription, AlertTitle } from '@first2apply/ui';
import { Badge } from '@first2apply/ui';
import { Button } from '@first2apply/ui';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@first2apply/ui';
import { Input } from '@first2apply/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@first2apply/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { BrowserWindow, BrowserWindowHandle } from './browserWindow';
import { Icons } from './icons';
import { UrlQueryEditor } from './urlQueryEditor';
import { cn } from '@/lib/utils';

export function CreateLink() {
  const [jobBoardModalResponse, setJobBoardModalResponse] = useState<OverlayBrowserViewResult>();
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false);
  const browserWindowRef = useRef<BrowserWindowHandle>(null);

  const { handleError } = useError();
  const { createLink } = useLinks();
  const { sites } = useSites();
  const { toast } = useToast();

  // sort sites by name
  const sortedSites = sites
    .sort((a, b) => a.name.localeCompare(b.name))
    // also filter out deprecated sites
    .filter((site) => site.deprecated === false);

  const [isOpen, setIsOpen] = useState(false);

  // Handler for form submission
  const onOpenSite = async (site: JobSite) => {
    try {
      setIsOpen(false);
      await browserWindowRef.current?.open(site.urls[0]);
    } catch (error) {
      handleError({ error, title: 'Error opening job board' });
    }
  };
  const onCancelBrowsing = async () => {
    try {
      setJobBoardModalResponse(undefined);
      // await closeJobBoardModal();
    } catch (error) {
      handleError({ error, title: 'Error closing job board' });
    }
  };

  /**
   * Handler for closing the job browser.
   */
  const onSaveCurrentNavigation = async () => {
    try {
      const jobSearchInfo = await browserWindowRef.current?.finish();
      setJobBoardModalResponse(jobSearchInfo);
      setIsConfirmationDialogOpen(true);
    } catch (error) {
      handleError({ error, title: 'Error closing job board' });
    }
  };

  /**
   * Handler for closing the confirmation dialog.
   */
  const onCancelSave = async () => {
    try {
      setIsConfirmationDialogOpen(false);
      setJobBoardModalResponse(undefined);
    } catch (error) {
      handleError({ error, title: 'Error closing job board' });
    }
  };

  const onSaveSearch = async ({ title, url }: { title: string; url: string }) => {
    if (!jobBoardModalResponse) {
      handleError({ error: new Error('No job search data'), title: 'Error saving job search' });
      return;
    }

    const createdLink = await createLink({
      url, // use the URL provided by the user (potentially modified)
      title, // use the title provided by the user
      html: jobBoardModalResponse.html,
    });
    toast({
      title: 'Link created',
      description: `Link ${createdLink.title} created successfully`,
    });

    setIsConfirmationDialogOpen(false);
    setJobBoardModalResponse(undefined);
    setIsOpen(false);

    return createdLink;
  };

  // JSX for rendering the form
  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="default" size="default" className="shadow-sm">
            Add Search
          </Button>
        </DialogTrigger>
        <DialogContent className="w-[95vw] max-w-lg p-0 gap-0 overflow-hidden rounded-xl border-border/60 shadow-xl sm:w-full">
          <div className="p-6 pb-2">
            <DialogHeader className="mb-4">
                <DialogTitle className="text-xl font-semibold tracking-tight">Add new job search</DialogTitle>
                <DialogDescription className="text-base text-muted-foreground/80 leading-relaxed">
                    Select a job board to start searching. Refine your filters on the site for better results.
                </DialogDescription>
            </DialogHeader>

            <Alert className="mb-6 border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-900/10">
                <InfoCircledIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-800 dark:text-blue-300 font-semibold mb-1">Pro Tip</AlertTitle>
                <AlertDescription className="text-blue-700/90 dark:text-blue-300/80">
                    Apply the 'Last 24 Hours' filter on the job board to get the freshest results.
                </AlertDescription>
            </Alert>
          </div>

          <div className="bg-muted/30 p-6 border-t border-border/40">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Supported Job Boards</h3>
            <div className="flex flex-wrap gap-2">
                {sortedSites.map((site) => (
                <Badge
                    key={site.id}
                    variant="outline"
                    className="cursor-pointer px-3 py-1.5 text-sm font-medium hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all active:scale-95 bg-background shadow-sm"
                    onClick={() => {
                        onOpenSite(site);
                    }}
                >
                    {site.name}
                </Badge>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* render a top level action bar overlay */}
      <BrowserWindow
        ref={browserWindowRef}
        onClose={onCancelBrowsing}
        customActionButton={{
          text: 'Save',
          onClick: onSaveCurrentNavigation,
          tooltip: 'Click when you are done browsing and want to save this search',
        }}
      ></BrowserWindow>

      {/* render the confirmation dialog */}
      <JobSearchSubmitDialog
        isOpen={isConfirmationDialogOpen}
        title={jobBoardModalResponse?.title ?? ''}
        url={jobBoardModalResponse?.url ?? ''}
        onCancel={onCancelSave}
        onSaveJobSearch={onSaveSearch}
      />
    </>
  );
}

const JobSearchSubmitDialog = ({
  title,
  url,
  isOpen,
  onSaveJobSearch,
  onCancel,
}: {
  title: string;
  url: string;
  isOpen: boolean;
  onSaveJobSearch: (data: { title: string; url: string }) => Promise<Link>;
  onCancel: () => void;
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(url);
  const [validationResult, setValidationResult] = useState<ReturnType<typeof validateJobSearchUrl> | null>(null);
  const { handleError } = useError();
  const { toast } = useToast();
  const { sites } = useSites();

  const formSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    url: z.string().url('Invalid URL').min(1, 'URL is required'),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title,
      url,
    },
  });

  // Validate URL when it changes
  useEffect(() => {
    if (currentUrl && sites.length > 0) {
      const result = validateJobSearchUrl(currentUrl, sites);
      setValidationResult(result);
    }
  }, [currentUrl, sites]);

  // Reset the form when the incoming values change
  useEffect(() => {
    form.reset({
      title,
      url,
    });
    setCurrentUrl(url);
  }, [title, url, form]);

  const onSubmit = async (data: { title: string; url: string }) => {
    setIsSubmitting(true);
    try {
      await onSaveJobSearch({ title: data.title, url: currentUrl });
      toast({
        title: 'Job search created',
        description: `Job search ${data.title} created successfully`,
      });
    } catch (error) {
      handleError({ error, title: 'Error creating job search' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update form URL when currentUrl changes
  const handleUrlChange = (newUrl: string) => {
    setCurrentUrl(newUrl);
    form.setValue('url', newUrl);
  };

  // Clean URL function
  const handleCleanUrl = () => {
    const cleanedUrl = cleanJobSearchUrl(currentUrl);
    if (cleanedUrl !== currentUrl) {
      handleUrlChange(cleanedUrl);
      toast({
        title: 'URL cleaned',
        description: 'Removed tracking parameters and normalized the URL',
        variant: 'default',
      });
    } else {
      toast({
        title: 'URL is already clean',
        description: 'No changes needed',
        variant: 'default',
      });
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onCancel();
        }
      }}
    >
      <DialogContent className="w-[95vw] max-w-4xl p-0 gap-0 max-h-[90vh] overflow-hidden rounded-xl border-border/60 shadow-2xl flex flex-col">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="text-xl font-semibold tracking-tight">Save Search</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground/80">
            Customize your search parameters before saving.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 pt-2">
                <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="basic">Basic Info</TabsTrigger>
                    <TabsTrigger value="advanced">URL Parameters</TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic" className="space-y-6 mt-0">
                    {/* Title field */}
                    <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem className="w-full">
                        <FormLabel className="font-medium">Search Title</FormLabel>
                        <FormControl>
                            <Input
                            id="title"
                            type="text"
                            placeholder="e.g. Senior Product Designer (Remote)"
                            className="h-10 text-base"
                            {...field}
                            />
                        </FormControl>
                        </FormItem>
                    )}
                    />

                    {/* Simple URL field */}
                    <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                        <FormItem className="w-full">
                        <FormLabel className="font-medium">Search URL</FormLabel>
                        <FormControl>
                            <div className="relative">
                                <Input 
                                id="url" 
                                type="url" 
                                placeholder="https://..."
                                value={currentUrl}
                                onChange={(e) => handleUrlChange(e.target.value)}
                                className="font-mono text-sm h-10 pr-24"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCleanUrl}
                                    disabled={isSubmitting}
                                    className="absolute right-1 top-1 h-8 text-xs font-medium text-muted-foreground hover:text-foreground"
                                >
                                    Clean URL
                                </Button>
                            </div>
                        </FormControl>
                        <p className="text-xs text-muted-foreground mt-1.5">
                            This is the exact URL we'll use to scan for jobs.
                        </p>
                        </FormItem>
                    )}
                    />

                    {/* Validation Results */}
                    {validationResult && (
                    <div className="space-y-2 pt-2">
                        {validationResult.errors.length > 0 && (
                        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
                            <AlertDescription>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                {validationResult.errors.map((error, index) => (
                                <li key={index}>{error}</li>
                                ))}
                            </ul>
                            </AlertDescription>
                        </Alert>
                        )}
                        
                        {validationResult.warnings.length > 0 && (
                        <Alert className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-900/10">
                            <AlertDescription>
                            <div className="space-y-1">
                                <p className="font-medium text-amber-800 dark:text-amber-400 text-sm">Suggestions:</p>
                                <ul className="list-disc list-inside space-y-1 text-sm text-amber-700/90 dark:text-amber-300/80">
                                {validationResult.warnings.map((warning, index) => (
                                    <li key={index}>{warning}</li>
                                ))}
                                </ul>
                            </div>
                            </AlertDescription>
                        </Alert>
                        )}
                    </div>
                    )}
                </TabsContent>

                <TabsContent value="advanced" className="space-y-4 mt-0">
                    <div className="space-y-2 mb-4">
                    <h3 className="text-sm font-medium">Advanced URL Editor</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Fine-tune your job search by editing individual URL parameters. This allows you to modify 
                        search terms, location, experience level, and other filters.
                    </p>
                    </div>
                    
                    <UrlQueryEditor
                    url={currentUrl}
                    onUrlChange={handleUrlChange}
                    disabled={isSubmitting}
                    />
                </TabsContent>
                </Tabs>
            </div>

            <div className="flex flex-row items-center justify-between p-6 border-t bg-muted/20 shrink-0">
              {/* Cancel button */}
              <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Cancel
              </Button>
              {/* Submit button */}
              <Button
                type="submit"
                disabled={
                  !form.formState.isValid || 
                  isSubmitting || 
                  (validationResult && !validationResult.isValid)
                }
                className="ml-auto min-w-[120px]"
              >
                {isSubmitting ? (
                  <>
                    <Icons.spinner2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Search'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
