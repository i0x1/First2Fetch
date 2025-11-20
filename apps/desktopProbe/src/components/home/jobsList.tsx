import { ArchiveIcon, HeartFilledIcon, TrashIcon } from '@radix-ui/react-icons';
import { createRef, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import InfiniteScroll from 'react-infinite-scroll-component';

import { Icons } from '@/components/icons';
import { useLinks } from '@/hooks/links';
import { useSites } from '@/hooks/sites';
import { LABEL_COLOR_CLASSES } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { Job } from '@first2apply/core';
import { Avatar, AvatarFallback, AvatarImage } from '@first2apply/ui';
import { Button } from '@first2apply/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@first2apply/ui';

import { DeleteJobDialog } from './deleteJobDialog';

/**
 * List of jobs component.
 */
export function JobsList({
  jobs,
  selectedJobId,
  hasMore,
  parentContainerId,
  onLoadMore,
  onSelect,
  onArchive,
  onDelete,
  favoriteCompanies = [],
}: {
  jobs: Job[];
  selectedJobId?: number;
  hasMore: boolean;
  parentContainerId: string;
  onLoadMore: () => void;
  onSelect: (job: Job) => void;
  onArchive: (job: Job) => void;
  onDelete: (job: Job) => void;
  favoriteCompanies?: string[];
}) {
  const { siteLogos, siteMap } = useSites();
  const { links } = useLinks();

  const [jobToDelete, setJobToDelete] = useState<Job | undefined>();
  const [scrollToIndex, setScrollToIndex] = useState<number | undefined>();
  const itemRefs = useMemo(() => jobs.map(() => createRef<HTMLLIElement>()), [jobs]);
  const selectedIndex = jobs.findIndex((job) => job.id === selectedJobId);
  const linksMap = useMemo(() => new Map(links.map((link) => [link.id, link])), [links]);

  useEffect(() => {
    if (scrollToIndex === undefined) {
      return;
    }

    const timer = setTimeout(() => {
      const selectedRef = itemRefs[scrollToIndex];
      if (selectedRef.current) {
        selectedRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        setScrollToIndex(undefined);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [scrollToIndex, itemRefs]);

  // Navigate between jobs using arrow keys
  useHotkeys(
    'down',
    () => {
      if (selectedIndex < jobs.length - 1) {
        // Check if not last job
        const nextIndex = selectedIndex + 1;
        onSelect(jobs[nextIndex]);
        setScrollToIndex(nextIndex);
      }
    },
    [selectedIndex, jobs],
  );
  useHotkeys(
    'up',
    () => {
      if (selectedIndex > 0) {
        // Check if not first job
        const prevIndex = selectedIndex - 1;
        onSelect(jobs[prevIndex]);
        setScrollToIndex(prevIndex);
      }
    },
    [selectedIndex, jobs],
  );

  // Archive job keyboard shortcut
  useHotkeys(
    'meta+a, ctrl+a',
    () => {
      if (selectedJobId) {
        const jobToArchive = jobs.find((job) => job.id === selectedJobId);
        if (jobToArchive && jobToArchive.status !== 'archived') {
          onArchive(jobToArchive);
        }
      }
    },
    [selectedJobId, jobs, onArchive],
    { preventDefault: true },
  );

  // Delete job keyboard shortcut
  useHotkeys(
    'meta+d, ctrl+d',
    () => {
      if (selectedJobId) {
        const jobToDelete = jobs.find((job) => job.id === selectedJobId);
        if (jobToDelete) {
          setJobToDelete(jobToDelete);
        }
      }
    },
    [selectedJobId, jobs, onDelete],
    { preventDefault: true },
  );

  const isFavoriteCompany = (companyName?: string | null) => {
    if (!companyName) {
      return false;
    }

    const normalized = companyName.trim().toLowerCase();
    return favoriteCompanies.some((company) => company.toLowerCase() === normalized);
  };

  return (
    <InfiniteScroll
      dataLength={jobs.length}
      next={onLoadMore}
      hasMore={hasMore}
      loader={<Icons.spinner2 />}
      scrollThreshold={0.8}
      scrollableTarget={parentContainerId}
    >
      <ul className="space-y-2 px-2 py-2">
        {jobs.map((job, index) => {
          const fromLink = linksMap.get(job.link_id)?.title;

          return (
            <li
              key={`${job.id}-${index}`}
              className={cn(
                'group relative rounded-xl border transition-all duration-200 ease-out px-4 py-3',
                selectedJobId === job.id
                  ? 'border-primary/50 bg-primary/5 shadow-sm shadow-primary/5'
                  : 'border-border/40 bg-card/40 hover:border-border hover:bg-card hover:shadow-sm'
              )}
              ref={itemRefs[index]}
              onClick={() => onSelect(job)}
            >
              {/* Title Row */}
              <div className="mb-1.5 pr-8">
                <h3 className="text-sm font-bold leading-snug text-foreground tracking-tight">
                  {job.title}
                </h3>
              </div>

              {/* Company & Location Row */}
              <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-primary/90">
                    {job.companyName}
                  </span>
                  {isFavoriteCompany(job.companyName) && (
                    <HeartFilledIcon className="h-3 w-3 text-rose-500 flex-shrink-0" />
                  )}
                </div>
                
                {job.location && (
                  <>
                    <span className="text-border/60 text-xs flex-shrink-0">•</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {job.location}
                    </span>
                  </>
                )}
              </div>

              {/* Footer: Source & Timestamps */}
              <div className="flex items-center justify-between gap-4 border-t border-border/30 pt-2.5">
                {/* Source */}
                <div className="flex items-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                  <Avatar className="h-3.5 w-3.5 ring-1 ring-border/50">
                    <AvatarImage src={siteLogos[job.siteId]} />
                    <AvatarFallback className="text-[6px]">LI</AvatarFallback>
                  </Avatar>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {fromLink ?? siteMap[job.siteId]?.name}
                  </span>
                </div>

                {/* Timestamps */}
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 whitespace-nowrap">
                  {job.posted_at_raw && (
                    <span className="flex items-center gap-1">
                      <span>posted:</span>
                      <span className="text-muted-foreground/80 font-medium">{job.posted_at_raw}</span>
                      {job.is_repost && (
                        <span className="text-amber-500" title="This job was reposted">
                          ↻
                        </span>
                      )}
                    </span>
                  )}
                  {job.posted_at_raw && <span className="text-border/50">•</span>}
                  <span>
                    found: <span className="text-muted-foreground/80 font-medium">{getRelativeTimeString(new Date(job.created_at))}</span>
                  </span>
                </div>
              </div>

              {/* Action buttons - Top Right Absolute */}
              <div className="absolute right-2 top-2 hidden items-center gap-1 rounded-lg bg-card/95 pl-2 shadow-sm ring-1 ring-border/10 backdrop-blur-sm group-hover:flex">
                {/* Archive button */}
                {job.status !== 'archived' && (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                          onClick={(evt) => {
                            onArchive(job);
                            evt.stopPropagation();
                          }}
                        >
                          <ArchiveIcon className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs">
                        Archive
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {/* Delete button */}
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                        onClick={(evt) => {
                          setJobToDelete(job);
                          evt.stopPropagation();
                        }}
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs">
                      Delete
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </li>
          );
        })}
      </ul>
      {jobToDelete && (
        <DeleteJobDialog
          isOpen={!!jobToDelete}
          job={jobToDelete}
          onClose={() => setJobToDelete(undefined)}
          onDelete={onDelete}
        />
      )}
    </InfiniteScroll>
  );
}

function getRelativeTimeString(date: Date, locale: string = 'en') {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const now = new Date();
  const diffInSeconds = (now.getTime() - date.getTime()) / 1000;

  const minutes = Math.floor(diffInSeconds / 60);
  const hours = Math.floor(diffInSeconds / (60 * 60));
  const days = Math.floor(diffInSeconds / (60 * 60 * 24));
  const weeks = Math.floor(diffInSeconds / (60 * 60 * 24 * 7));
  const months = Math.floor(diffInSeconds / (60 * 60 * 24 * 30));
  const years = Math.floor(diffInSeconds / (60 * 60 * 24 * 365));

  if (years >= 1) {
    return rtf.format(-years, 'year');
  } else if (months >= 1) {
    return rtf.format(-months, 'month');
  } else if (weeks >= 1) {
    return rtf.format(-weeks, 'week');
  } else if (days >= 1) {
    return rtf.format(-days, 'day');
  } else if (hours >= 1) {
    return rtf.format(-hours, 'hour');
  } else if (minutes >= 1) {
    return rtf.format(-minutes, 'minute');
  } else {
    return rtf.format(-Math.floor(diffInSeconds), 'second');
  }
}
