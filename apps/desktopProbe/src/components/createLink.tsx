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
          <Button variant="default" size="lg" className="px-10 text-base">
            Add Search
          </Button>
        </DialogTrigger>
        <DialogContent className="w-[90vw] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-medium tracking-wide">Add new job search</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-left text-sm text-muted-foreground">
              <p>
                Click on one of the supported job boards and start searching for a role. The more specific your filters,
                the better we can tailor job alerts for you.
              </p>

              <Alert className="mt-2 flex items-center gap-2 border-0 p-0">
                <AlertTitle className="mb-0">
                  <InfoCircledIcon className="h-5 w-5" />
                </AlertTitle>
                <AlertDescription className="text-base">
                  <span className="font-medium">Pro Tip: </span>Apply the 'Last 24 Hours' filter where possible.
                </AlertDescription>
              </Alert>
            </div>
          </DialogDescription>
          </DialogHeader>

          <h2 className="mt-6 text-base tracking-wide">Supported job boards:</h2>
          <DialogFooter>
            <ul className="flex w-full flex-wrap justify-evenly gap-1.5">
              {sortedSites.map((site) => (
                <li key={site.id}>
                  <Badge
                    onClick={() => {
                      onOpenSite(site);
                    }}
                  >
                    {site.name}
                  </Badge>
                </li>
              ))}
            </ul>
          </DialogFooter>
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
      <DialogContent className="w-[95vw] max-w-4xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium tracking-wide">Add new job search</DialogTitle>
          <DialogDescription>
            Customize your job search details and fine-tune the URL parameters to get the most relevant results.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="advanced">URL Parameters</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4 mt-4">
                {/* Title field */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>Search Title</FormLabel>
                      <FormControl>
                        <Input
                          id="title"
                          type="text"
                          placeholder="Enter a descriptive name (e.g., Senior Java Developer Remote)"
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
                      <FormLabel>Search URL</FormLabel>
                      <FormControl>
                        <Input 
                          id="url" 
                          type="url" 
                          placeholder="https://example.com/jobs?q=developer"
                          value={currentUrl}
                          onChange={(e) => handleUrlChange(e.target.value)}
                          className="font-mono text-sm"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        The complete URL of your job search. Use the "URL Parameters" tab for advanced editing.
                      </p>
                    </FormItem>
                  )}
                />

                {/* URL Actions */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCleanUrl}
                    disabled={isSubmitting}
                  >
                    Clean URL
                  </Button>
                </div>

                {/* Validation Results */}
                {validationResult && (
                  <div className="space-y-2">
                    {validationResult.errors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          <ul className="list-disc list-inside space-y-1">
                            {validationResult.errors.map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {validationResult.warnings.length > 0 && (
                      <Alert>
                        <AlertDescription>
                          <div className="space-y-1">
                            <p className="font-medium">Suggestions:</p>
                            <ul className="list-disc list-inside space-y-1">
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

              <TabsContent value="advanced" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Advanced URL Editor</h3>
                  <p className="text-sm text-muted-foreground">
                    Fine-tune your job search by editing individual URL parameters. This allows you to modify 
                    search terms, location, experience level, and other filters that may not be easily 
                    accessible through the job site's interface.
                  </p>
                </div>
                
                <UrlQueryEditor
                  url={currentUrl}
                  onUrlChange={handleUrlChange}
                  disabled={isSubmitting}
                />
              </TabsContent>
            </Tabs>

            <div className="flex flex-row items-center justify-between pt-4 border-t">
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
                className="ml-auto flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Icons.spinner2 className="h-4 w-4 animate-spin" />
                    Creating search...
                  </>
                ) : (
                  'Save search'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
