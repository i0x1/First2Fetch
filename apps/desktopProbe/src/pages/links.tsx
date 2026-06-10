import { useEffect, useRef, useState } from 'react';

import { BrowserWindow, BrowserWindowHandle } from '@/components/browserWindow';
import { CreateLink } from '@/components/createLink';
import { LinksList } from '@/components/linksList';
import { LinksListSkeleton } from '@/components/skeletons/linksListSkeleton';
import { useError } from '@/hooks/error';
import { useLinks } from '@/hooks/links';
import { getLinkJobCounts, scanLink } from '@/lib/electronMainSdk';
import { throwError } from '@first2apply/core';
import { toast } from '@first2apply/ui';

import { DefaultLayout } from './defaultLayout';
import { CompactPageHeader } from '@/components/compact/compactLayout';

export function LinksPage() {
  const { handleError } = useError();
  const { isLoading, links, removeLink, updateLink, reloadLinks } = useLinks();
  const browserWindowRef = useRef<BrowserWindowHandle>(null);
  const [currentDebugLinkId, setCurrentDebugLinkId] = useState<number | null>(null);
  const [jobCountsByLinkId, setJobCountsByLinkId] = useState<Record<number, number>>({});

  // refresh links on component mount
  useEffect(() => {
    const asyncLoad = async () => {
      try {
        await reloadLinks();
        const counts = await getLinkJobCounts();
        setJobCountsByLinkId(counts);
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
      <CompactPageHeader title="Searches" action={links.length > 0 ? <CreateLink /> : undefined} />

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
          jobCountsByLinkId={jobCountsByLinkId}
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
