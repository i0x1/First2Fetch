import { useEffect, useRef, useState } from 'react';

import { BrowserWindow, BrowserWindowHandle } from '@/components/browserWindow';
import { CreateLink } from '@/components/createLink';
import { LinksList } from '@/components/linksList';
import { LinksListSkeleton } from '@/components/skeletons/linksListSkeleton';
import { useAppState } from '@/hooks/appState';
import { useError } from '@/hooks/error';
import { useLinks } from '@/hooks/links';
import { scanLink } from '@/lib/electronMainSdk';
import { throwError } from '@first2apply/core';
import { toast } from '@first2apply/ui';

import { DefaultLayout } from './defaultLayout';

export function LinksPage() {
  const { handleError } = useError();
  const { isLoading, links, removeLink, updateLink, reloadLinks } = useLinks();
  const { isScanning } = useAppState();
  const browserWindowRef = useRef<BrowserWindowHandle>(null);
  const [currentDebugLinkId, setCurrentDebugLinkId] = useState<number | null>(null);

  // refresh links on component mount
  useEffect(() => {
    const asyncLoad = async () => {
      try {
        await reloadLinks();
      } catch (error) {
        handleError({ error });
      }
    };

    asyncLoad();
  }, []);

  // Delete an existing link
  const handleDeleteLink = async (linkId: number) => {
    try {
      await removeLink(linkId);
    } catch (error) {
      handleError({ error });
    }
  };

  const handleDebugLink = async (linkId: number) => {
    try {
      await browserWindowRef.current?.open(links.find((l) => l.id === linkId)?.url ?? throwError('Link not found'));
      setCurrentDebugLinkId(linkId);
    } catch (error) {
      handleError({ error });
    }
  };

  const handleScanLink = async () => {
    try {
      const linkId = currentDebugLinkId ?? throwError('No link is being debugged');
      await scanLink(linkId);
      setCurrentDebugLinkId(null);
      await browserWindowRef.current?.finish();

      toast({
        title: 'Scanning URL in background ...',
        description: 'The link will be scanned in the background. You will be notified if there are new jobs.',
        // variant: 'success',
      });
    } catch (error) {
      handleError({ error });
    }
  };

  // update link
  const handleUpdateLink = async (data: { linkId: number; title: string; url: string }) => {
    try {
      await updateLink(data.linkId, { title: data.title, url: data.url });
    } catch (error) {
      handleError({ error });
    }
  };

  if (isLoading) {
    return (
      <DefaultLayout className="p-6 md:p-10">
        <LinksListSkeleton />
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout className="p-6 md:p-10">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Job Searches</h1>
          <p className="text-sm text-muted-foreground">
             {isScanning ? (
               <span className="flex items-center gap-2 text-primary">
                 <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                 Scanning for new jobs...
               </span>
             ) : (
               'Manage and monitor your job feeds.'
             )}
          </p>
        </div>

        {links.length > 0 && <CreateLink />}
      </div>

      {links.length === 0 && (
        <div className="flex h-[calc(100vh-200px)] flex-col items-center justify-center text-center">
          <div className="max-w-md space-y-6">
            <h2 className="text-2xl font-semibold tracking-tight">Start your job hunt</h2>
            <p className="text-muted-foreground">
              First 2 Apply periodically visits your pre-configured job searches and fetches the list of jobs.
            </p>
            <div className="flex justify-center">
              <CreateLink />
            </div>
          </div>
        </div>
      )}

      {links.length > 0 && (
        <LinksList
          links={links}
          onDeleteLink={handleDeleteLink}
          onDebugLink={handleDebugLink}
          onUpdateLink={handleUpdateLink}
        />
      )}

      <BrowserWindow
        ref={browserWindowRef}
        onClose={() => {}}
        customActionButton={{
          text: 'Retry',
          onClick: () => handleScanLink(),
          tooltip: 'Click to retry fetching jobs for this search',
        }}
      ></BrowserWindow>
    </DefaultLayout>
  );
}
