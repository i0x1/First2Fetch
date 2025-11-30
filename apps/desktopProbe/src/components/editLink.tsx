import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { useError } from '@/hooks/error';
import { useSites } from '@/hooks/sites';
import { validateJobSearchUrl, cleanJobSearchUrl } from '@/lib/linkValidation';
import { Link } from '@first2apply/core';
import { Alert, AlertDescription } from '@first2apply/ui';
import { Button } from '@first2apply/ui';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@first2apply/ui';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@first2apply/ui';
import { Input } from '@first2apply/ui';
import { useToast } from '@first2apply/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@first2apply/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Icons } from './icons';
import { UrlQueryEditor } from './urlQueryEditor';

/**
 * Component used to edit a link.
 */
export function EditLink({
  isOpen,
  link,
  onUpdateLink,
  onCancel,
}: {
  isOpen: boolean;
  link: Link | null;
  onUpdateLink: (data: { linkId: number; title: string; url: string }) => Promise<void>;
  onCancel: () => void;
}) {
  if (!isOpen || !link) {
    return null;
  }

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(link.url);
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
      title: link.title,
      url: link.url,
    },
  });

  // Reset form when link changes
  useEffect(() => {
    if (link) {
        form.reset({
            title: link.title,
            url: link.url,
        });
        setCurrentUrl(link.url);
    }
  }, [link, form]);

  const onSubmit = async (data: { title: string; url: string }) => {
    setIsSubmitting(true);
    try {
      await onUpdateLink({
        linkId: link.id,
        title: data.title,
        url: currentUrl, // Use the URL from the query editor
      });
      toast({
        title: 'Job search updated',
        description: `Job search ${data.title} updated successfully`,
        // variant: 'success',
      });
    } catch (error) {
      handleError({ error, title: 'Error updating job search' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validate URL when it changes
  useEffect(() => {
    if (currentUrl && sites.length > 0) {
      const result = validateJobSearchUrl(currentUrl, sites, link.site_id);
      setValidationResult(result);
    }
  }, [currentUrl, sites, link.site_id]);

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
          <DialogTitle className="text-xl font-semibold tracking-tight">Update Job Search</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground/80">
            Refine your search parameters to get better results.
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
                            placeholder="e.g. Senior Java Developer Remote"
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
                            The complete URL of your job search.
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
                        Fine-tune your job search by editing individual URL parameters.
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
                    Updating...
                  </>
                ) : (
                  'Update Search'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
