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
  link: Link;
  onUpdateLink: (data: { linkId: number; title: string; url: string }) => Promise<void>;
  onCancel: () => void;
}) {
  if (!isOpen) {
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
        variant: 'success',
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
      <DialogContent className="w-[95vw] max-w-4xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium tracking-wide">Update job search</DialogTitle>
          <DialogDescription>
            Edit your job search details and customize the URL parameters to refine your search criteria.
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
                    Edit individual URL parameters to fine-tune your job search. This is especially useful for 
                    modifying search terms, location, experience level, and other filters that may not be 
                    easily accessible through the job site's interface.
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
                    Updating search...
                  </>
                ) : (
                  'Update search'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
