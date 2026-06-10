import { ArchiveIcon, DotsVerticalIcon, DownloadIcon, TrashIcon, UpdateIcon } from '@radix-ui/react-icons';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useError } from '@/hooks/error';
import { changeAllJobsStatus, exportJobsToCsv } from '@/lib/electronMainSdk';
import { Job, JobStatus } from '@first2apply/core';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
} from '@first2apply/ui';

import { JobTabsContent } from './jobTabsContent';

export type JobListing = {
  isLoading: boolean;
  hasMore: boolean;
  jobs: Array<Job & { isLoadingJD?: boolean }>;
  new: number;
  applied: number;
  archived: number;
  filtered: number;
  nextPageToken?: string;
};

function parseIds(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id));
}

function parseLabels(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}

export function JobTabs() {
  const { handleError } = useError();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const status = (searchParams.get('status') || 'new') as JobStatus;
  const search = searchParams.get('search') || '';
  const siteIds = parseIds(searchParams.get('site_ids'));
  const linkIds = parseIds(searchParams.get('link_ids'));
  const labels = parseLabels(searchParams.get('labels'));
  const hideReposted = searchParams.get('hide_reposted') === 'true';

  const [listing, setListing] = useState<JobListing>({
    isLoading: true,
    hasMore: true,
    jobs: [],
    new: 0,
    applied: 0,
    archived: 0,
    filtered: 0,
  });

  const navigateWithFilters = (nextStatus: JobStatus) => {
    navigate(
      `?status=${nextStatus}&search=${encodeURIComponent(search)}&site_ids=${siteIds.join(',')}&link_ids=${linkIds.join(',')}&labels=${labels.join(',')}&hide_reposted=${hideReposted}&r=${Math.random()}`,
    );
  };

  const onArchiveAll = async (tab: JobStatus) => {
    try {
      await changeAllJobsStatus({ from: status, to: 'archived' });
      navigateWithFilters(tab);
      toast({
        title: 'All jobs archived',
        description: `All your ${status} jobs have been archived.`,
        variant: 'success',
      });
    } catch (error) {
      handleError({ error, title: 'Failed to archive all jobs' });
    }
  };

  const onDeleteAll = async (tab: JobStatus) => {
    try {
      await changeAllJobsStatus({ from: tab, to: 'deleted' });
      navigateWithFilters(tab);
      toast({
        title: 'All jobs deleted',
        description: `All your ${status} jobs have been deleted.`,
        variant: 'success',
      });
    } catch (error) {
      handleError({ error, title: 'Failed to delete all jobs' });
    }
  };

  const onCsvExport = async (tab: JobStatus) => {
    try {
      await exportJobsToCsv(tab);
      toast({
        title: 'Jobs exported',
        description: `All your ${tab} jobs have been exported to a CSV file.`,
        variant: 'success',
      });
    } catch (error) {
      handleError({ error, title: 'Failed to export jobs' });
    }
  };

  return (
    <JobTabsContent
      status={status}
      listing={listing}
      setListing={setListing}
      search={search}
      siteIds={siteIds}
      linkIds={linkIds}
      labels={labels}
      hideReposted={hideReposted}
      onStatusChange={navigateWithFilters}
      tabActions={
        <TabActionsMenu
          tab={status}
          onRefresh={() => navigateWithFilters(status)}
          onCsvExport={onCsvExport}
          onArchiveAll={onArchiveAll}
          onDeleteAll={onDeleteAll}
        />
      }
    />
  );
}

function TabActionsMenu({
  tab,
  onRefresh,
  onCsvExport,
  onArchiveAll,
  onDeleteAll,
}: {
  tab: JobStatus;
  onRefresh: () => void;
  onCsvExport: (tab: JobStatus) => Promise<void>;
  onArchiveAll: (tab: JobStatus) => Promise<void>;
  onDeleteAll: (tab: JobStatus) => Promise<void>;
}) {
  const [isArchiveAllDialogOpen, setIsArchiveAllDialogOpen] = useState(false);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground"
            aria-label="Tab actions"
          >
            <DotsVerticalIcon className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" className="space-y-1">
          <DropdownMenuItem className="cursor-pointer" onClick={onRefresh}>
            <UpdateIcon className="mb-0.5 mr-2 inline-block h-4 w-4" />
            Refresh
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer" onClick={() => onCsvExport(tab)}>
            <DownloadIcon className="mb-0.5 mr-2 inline-block h-4 w-4" />
            CSV export
          </DropdownMenuItem>
          {tab !== 'archived' && (
            <DropdownMenuItem className="cursor-pointer" onClick={() => setIsArchiveAllDialogOpen(true)}>
              <ArchiveIcon className="mb-0.5 mr-2 inline-block h-4 w-4" />
              Archive all
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="cursor-pointer bg-destructive/5 focus:bg-destructive/20"
            onClick={() => setIsDeleteAllDialogOpen(true)}
          >
            <TrashIcon className="-ml-0.5 mb-0.5 mr-2 inline-block h-5 w-5 text-destructive" />
            Delete all
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isArchiveAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to archive all {tab} jobs?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone, and all jobs will be moved to the archived tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsArchiveAllDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsArchiveAllDialogOpen(false);
                onArchiveAll(tab);
              }}
            >
              Archive All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete all {tab} jobs?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteAllDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                setIsDeleteAllDialogOpen(false);
                onDeleteAll(tab);
              }}
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
