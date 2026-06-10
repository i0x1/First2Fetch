import { useEffect, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import { useLinks } from '@/hooks/links';
import { useSites } from '@/hooks/sites';
import { cn } from '@/lib/utils';
import { Job } from '@first2apply/core';
import { Button } from '@first2apply/ui';

import { DeleteJobDialog } from './deleteJobDialog';
import { JobsBoardTable } from './jobsTable';

function getDateGroupLabel(dateOrKey: Date | string): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let jobDate: Date;
  let jobDay: Date;

  if (typeof dateOrKey === 'string') {
    const [year, month, day] = dateOrKey.split('-').map(Number);
    jobDate = new Date(year, month - 1, day);
    jobDay = new Date(year, month - 1, day);
  } else {
    jobDate = new Date(dateOrKey);
    jobDay = new Date(jobDate.getFullYear(), jobDate.getMonth(), jobDate.getDate());
  }

  if (jobDay.getTime() === today.getTime()) {
    return 'Today';
  }
  if (jobDay.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }
  return jobDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: jobDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function isToday(dateKey: string): boolean {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return dateKey === todayKey;
}

type DateSummary = {
  date_key: string;
  total_count: number;
  favorite_count: number;
};

export function JobsList({
  dateSummaries,
  jobsByDate,
  selectedJobId,
  onLoadMoreForDate,
  onSelect,
  onApplied,
  onArchive,
  onDelete,
  favoriteCompanies = [],
  watchedCompanies = [],
  showAppliedAction = true,
}: {
  dateSummaries: DateSummary[];
  jobsByDate: Record<string, { jobs: Job[]; hasMore: boolean; isLoading: boolean }>;
  selectedJobId?: number | null;
  onLoadMoreForDate: (dateKey: string, after?: string) => void;
  onSelect: (job: Job) => void;
  onApplied?: (job: Job) => void;
  onArchive: (job: Job) => void;
  onDelete: (job: Job) => void;
  favoriteCompanies?: string[];
  watchedCompanies?: string[];
  showAppliedAction?: boolean;
}) {
  const { siteLogos, siteMap } = useSites();
  const { links } = useLinks();

  const [jobToDelete, setJobToDelete] = useState<Job | undefined>();
  const [visibleDates, setVisibleDates] = useState<Set<string>>(new Set());
  const initialLoadKeyRef = useRef<string | null>(null);
  const linksMap = useMemo(() => new Map(links.map((link) => [link.id, link])), [links]);

  const isFavoriteCompany = (companyName?: string | null) => {
    if (!companyName) return false;
    const normalized = companyName.trim().toLowerCase();
    return favoriteCompanies.some((company) => company.toLowerCase() === normalized);
  };

  const isWatchedCompany = (companyName?: string | null) => {
    if (!companyName) return false;
    const normalized = companyName.trim().toLowerCase();
    return watchedCompanies.some((company) => company.toLowerCase() === normalized);
  };

  const dateGroups = useMemo(() => {
    if (!dateSummaries?.length) return [];

    return dateSummaries
      .map((summary) => {
        const dateJobs = jobsByDate?.[summary.date_key] ?? { jobs: [], hasMore: false, isLoading: false };
        const sortedJobs = [...dateJobs.jobs].sort((a, b) => {
          const aIsFav = isFavoriteCompany(a.companyName);
          const bIsFav = isFavoriteCompany(b.companyName);
          if (aIsFav && !bIsFav) return -1;
          if (!aIsFav && bIsFav) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        return {
          dateKey: summary.date_key,
          label: getDateGroupLabel(summary.date_key),
          jobs: sortedJobs,
          favoriteCount: summary.favorite_count,
          totalCount: summary.total_count,
          hasMore: dateJobs.hasMore,
          isLoading: dateJobs.isLoading,
        };
      })
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [dateSummaries, jobsByDate, favoriteCompanies, watchedCompanies]);

  const newestDateKey = useMemo(
    () => [...dateSummaries].sort((a, b) => b.date_key.localeCompare(a.date_key))[0]?.date_key,
    [dateSummaries],
  );
  const dateSummaryKey = useMemo(
    () => dateSummaries.map((summary) => `${summary.date_key}:${summary.total_count}`).join('|'),
    [dateSummaries],
  );

  useEffect(() => {
    if (!newestDateKey) {
      initialLoadKeyRef.current = null;
      setVisibleDates(new Set());
      return;
    }

    if (initialLoadKeyRef.current === dateSummaryKey) {
      return;
    }

    initialLoadKeyRef.current = dateSummaryKey;
    setVisibleDates(new Set([newestDateKey]));

    const newestDateJobs = jobsByDate?.[newestDateKey];
    if (!newestDateJobs?.jobs.length && !newestDateJobs?.isLoading) {
      setTimeout(() => onLoadMoreForDate(newestDateKey), 0);
    }
  }, [dateSummaryKey, jobsByDate, newestDateKey, onLoadMoreForDate]);

  const visibleGroups = useMemo(
    () => dateGroups.filter((group) => visibleDates.has(group.dateKey)),
    [dateGroups, visibleDates],
  );

  const visibleJobs = useMemo(() => visibleGroups.flatMap((group) => group.jobs), [visibleGroups]);
  const selectedIndex = visibleJobs.findIndex((job) => job.id === selectedJobId);

  useHotkeys('down', () => {
    if (selectedIndex < visibleJobs.length - 1) onSelect(visibleJobs[selectedIndex + 1]);
  }, [selectedIndex, visibleJobs, onSelect]);

  useHotkeys('up', () => {
    if (selectedIndex > 0) onSelect(visibleJobs[selectedIndex - 1]);
  }, [selectedIndex, visibleJobs, onSelect]);

  useHotkeys(
    'meta+a, ctrl+a',
    () => {
      if (selectedJobId) {
        const jobToArchive = visibleJobs.find((job) => job.id === selectedJobId);
        if (jobToArchive && jobToArchive.status !== 'archived') onArchive(jobToArchive);
      }
    },
    [selectedJobId, visibleJobs, onArchive],
    { preventDefault: true },
  );

  useHotkeys(
    'meta+d, ctrl+d',
    () => {
      if (selectedJobId) {
        const job = visibleJobs.find((job) => job.id === selectedJobId);
        if (job) setJobToDelete(job);
      }
    },
    [selectedJobId, visibleJobs],
    { preventDefault: true },
  );

  const showDate = (dateKey: string) => {
    setVisibleDates((prev) => new Set([...prev, dateKey]));
    if (!jobsByDate?.[dateKey]?.jobs.length) {
      setTimeout(() => onLoadMoreForDate(dateKey), 0);
    }
    setTimeout(() => {
      document.getElementById(`date-section-${dateKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border bg-card">
      {dateGroups.length > 0 && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-1.5 py-1 no-scrollbar">
          {dateGroups.map((group) => {
            const active = visibleDates.has(group.dateKey);
            const todayGroup = isToday(group.dateKey);
            return (
              <button
                key={group.dateKey}
                type="button"
                onClick={() => showDate(group.dateKey)}
                className={cn(
                  'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none',
                  active || (!visibleDates.size && todayGroup)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground',
                )}
              >
                {group.label} {group.totalCount}
              </button>
            );
          })}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {visibleGroups.length > 0 ? (
          <>
            <JobsBoardTable
              dateGroups={visibleGroups}
              selectedJobId={selectedJobId}
              onSelect={onSelect}
              onApplied={onApplied}
              onArchive={onArchive}
              onRequestDelete={setJobToDelete}
              siteLogos={siteLogos}
              siteMap={siteMap}
              linksMap={linksMap}
              isFavoriteCompany={isFavoriteCompany}
              isWatchedCompany={isWatchedCompany}
              showAppliedAction={showAppliedAction}
            />
            {visibleGroups
              .map((group) => ({
                ...group,
                remainingCount: Math.max(0, group.totalCount - group.jobs.length),
              }))
              .filter((group) => group.hasMore && group.remainingCount > 0)
              .map((group) => (
                <Button
                  key={`load-${group.dateKey}`}
                  variant="outline"
                  size="sm"
                  className="mx-2 mb-2 h-7 w-[calc(100%-16px)] text-xs"
                  onClick={() => {
                    const lastJob = group.jobs[group.jobs.length - 1];
                    const after = lastJob ? `${lastJob.id}!${lastJob.created_at}` : undefined;
                    onLoadMoreForDate(group.dateKey, after);
                  }}
                  disabled={group.isLoading}
                >
                  {group.isLoading ? 'Loading…' : `Load more ${group.label} (${group.remainingCount})`}
                </Button>
              ))}
          </>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Select a date above to load jobs.</p>
        )}
      </div>

      {jobToDelete && (
        <DeleteJobDialog
          isOpen={!!jobToDelete}
          job={jobToDelete}
          onClose={() => setJobToDelete(undefined)}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}
