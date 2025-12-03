import { CalendarIcon, ChevronDownIcon, ArchiveIcon, HeartFilledIcon, TrashIcon } from '@radix-ui/react-icons';
import { useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import { Icons } from '@/components/icons';
import { useLinks } from '@/hooks/links';
import { useSites } from '@/hooks/sites';
import { cn } from '@/lib/utils';
import { Job } from '@first2apply/core';
import { Avatar, AvatarFallback, AvatarImage } from '@first2apply/ui';
import { Button } from '@first2apply/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@first2apply/ui';

import { DeleteJobDialog } from './deleteJobDialog';

/**
 * Get date group label for a given date (e.g., "Today", "Yesterday", or formatted date)
 * Accepts either a Date object or a LOCAL date key string (YYYY-MM-DD)
 * IMPORTANT: Labels are ALWAYS based on the date_key from summary (local timezone), never recalculated from jobs
 */
function getDateGroupLabel(dateOrKey: Date | string): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Convert to local date for comparison
  let jobDate: Date;
  let jobDay: Date;
  
  if (typeof dateOrKey === 'string') {
    // Parse local date key (YYYY-MM-DD) as local date
    const [year, month, day] = dateOrKey.split('-').map(Number);
    jobDate = new Date(year, month - 1, day);
    jobDay = new Date(year, month - 1, day);
  } else {
    jobDate = new Date(dateOrKey);
    jobDay = new Date(jobDate.getFullYear(), jobDate.getMonth(), jobDate.getDate());
  }
  
  if (jobDay.getTime() === today.getTime()) {
    return 'Today';
  } else if (jobDay.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    // For all other dates, use unified format: "Mon, Dec 1" or "Mon, Dec 1, 2024" if different year
    return jobDate.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: jobDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}

/**
 * Check if a date key (from backend, LOCAL timezone-based) represents today
 */
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

/**
 * List of jobs component with date-based grouping and on-demand loading.
 * Uses two-phase loading: date summaries first, then jobs per date on expand.
 */
export function JobsList({
  dateSummaries,
  jobsByDate,
  selectedJobId,
  onLoadMoreForDate,
  onSelect,
  onArchive,
  onDelete,
  favoriteCompanies = [],
}: {
  dateSummaries: DateSummary[];
  jobsByDate: Record<string, { jobs: Job[]; hasMore: boolean; isLoading: boolean }>;
  selectedJobId?: number;
  onLoadMoreForDate: (dateKey: string, after?: string) => void;
  onSelect: (job: Job) => void;
  onArchive: (job: Job) => void;
  onDelete: (job: Job) => void;
  favoriteCompanies?: string[];
}) {
  const { siteLogos, siteMap } = useSites();
  const { links } = useLinks();

  const [jobToDelete, setJobToDelete] = useState<Job | undefined>();
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const linksMap = useMemo(() => new Map(links.map((link) => [link.id, link])), [links]);

  const isFavoriteCompany = (companyName?: string | null) => {
    if (!companyName) {
      return false;
    }
    const normalized = companyName.trim().toLowerCase();
    return favoriteCompanies.some((company) => company.toLowerCase() === normalized);
  };

  // Build date groups from summaries and loaded jobs
  const dateGroups = useMemo(() => {
    if (!dateSummaries || dateSummaries.length === 0) return [];
    return dateSummaries.map((summary) => {
      const dateJobs = (jobsByDate && jobsByDate[summary.date_key]) || { jobs: [], hasMore: false, isLoading: false };
      
      // Sort jobs: favorites first, then by time
      const sortedJobs = [...dateJobs.jobs].sort((a, b) => {
        const aIsFav = isFavoriteCompany(a.companyName);
        const bIsFav = isFavoriteCompany(b.companyName);
        if (aIsFav && !bIsFav) return -1;
        if (!aIsFav && bIsFav) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      // ALWAYS use summary.date_key for label - never recalculate from jobs
      // This ensures labels stay consistent when jobs load
      // date_key is now in LOCAL timezone (from backend)
      const label = getDateGroupLabel(summary.date_key);
      
      return {
        dateKey: summary.date_key, // Local date key (YYYY-MM-DD)
        label, // Always based on summary date_key, never changes
        jobs: sortedJobs,
        favoriteCount: summary.favorite_count,
        totalCount: summary.total_count,
        hasMore: dateJobs.hasMore,
        isLoading: dateJobs.isLoading,
      };
    }).sort((a, b) => {
      // Sort by date descending (newest dates first)
      return b.dateKey.localeCompare(a.dateKey);
    });
  }, [dateSummaries, jobsByDate, favoriteCompanies]);

  // Expand Today by default - date_key is now in local timezone
  useEffect(() => {
    if (dateSummaries.length === 0) return;
    
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // Find the date key that matches today (dates are now in local timezone)
    const todayDateKey = dateSummaries.find((summary) => summary.date_key === todayKey)?.date_key;
    
    if (todayDateKey && !expandedDates.has(todayDateKey)) {
      // Use functional update to avoid dependency on expandedDates
      setExpandedDates((prev) => {
        if (prev.has(todayDateKey)) return prev;
        return new Set([...prev, todayDateKey]);
      });
      
      // Load jobs for today (using local date key) - defer to avoid React warning
      setTimeout(() => {
        onLoadMoreForDate(todayDateKey);
      }, 0);
    }
  }, [dateSummaries, onLoadMoreForDate]); // Removed expandedDates from deps to avoid loops

  // Create a flat list of visible jobs for keyboard navigation
  const visibleJobs = useMemo(() => {
    const result: Job[] = [];
    for (const group of dateGroups) {
      if (expandedDates.has(group.dateKey)) {
        result.push(...group.jobs);
      }
    }
    return result;
  }, [dateGroups, expandedDates]);

  const selectedIndex = visibleJobs.findIndex((job) => job.id === selectedJobId);

  // Navigate between jobs using arrow keys
  useHotkeys(
    'down',
    () => {
      if (selectedIndex < visibleJobs.length - 1) {
        onSelect(visibleJobs[selectedIndex + 1]);
      }
    },
    [selectedIndex, visibleJobs],
  );
  useHotkeys(
    'up',
    () => {
      if (selectedIndex > 0) {
        onSelect(visibleJobs[selectedIndex - 1]);
      }
    },
    [selectedIndex, visibleJobs],
  );

  // Archive job keyboard shortcut
  useHotkeys(
    'meta+a, ctrl+a',
    () => {
      if (selectedJobId) {
        const jobToArchive = visibleJobs.find((job) => job.id === selectedJobId);
        if (jobToArchive && jobToArchive.status !== 'archived') {
          onArchive(jobToArchive);
        }
      }
    },
    [selectedJobId, visibleJobs, onArchive],
    { preventDefault: true },
  );

  // Delete job keyboard shortcut
  useHotkeys(
    'meta+d, ctrl+d',
    () => {
      if (selectedJobId) {
        const job = visibleJobs.find((job) => job.id === selectedJobId);
        if (job) {
          setJobToDelete(job);
        }
      }
    },
    [selectedJobId, visibleJobs],
    { preventDefault: true },
  );

  const toggleDateGroup = (dateKey: string) => {
    const isExpanding = !expandedDates.has(dateKey);
    
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
    
    // Load jobs for this date if expanding and not already loaded - defer to avoid React warning
    if (isExpanding && (!jobsByDate || !jobsByDate[dateKey] || jobsByDate[dateKey].jobs.length === 0)) {
      setTimeout(() => {
        onLoadMoreForDate(dateKey);
      }, 0);
    }
  };

  // Scroll to a date section
  const scrollToDate = (dateKey: string) => {
    const element = document.getElementById(`date-section-${dateKey}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Expand the section if collapsed
      if (!expandedDates.has(dateKey)) {
        toggleDateGroup(dateKey);
      }
    }
  };

  return (
    <div>
      {/* Date Navigation Bar - Sticky at top */}
      {dateGroups.length > 0 && (
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/30 px-3 py-3 mb-4">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-xs font-medium text-muted-foreground/70 mr-1 flex-shrink-0">Jump to:</span>
            {dateGroups.map((group) => {
              const isTodayGroup = isToday(group.dateKey);
              return (
                <button
                  key={group.dateKey}
                  onClick={() => scrollToDate(group.dateKey)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                    "flex-shrink-0",
                    isTodayGroup
                      ? "bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20"
                      : "bg-muted/60 hover:bg-muted/80 text-foreground/80 hover:text-foreground"
                  )}
                >
                  <span>{group.label}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                    isTodayGroup
                      ? "bg-primary-foreground/15 text-primary-foreground"
                      : "bg-background/60 text-muted-foreground"
                  )}>
                    {group.totalCount}
                  </span>
                  {group.favoriteCount > 0 && (
                    <HeartFilledIcon className={cn(
                      "h-3 w-3 flex-shrink-0",
                      isTodayGroup ? "text-primary-foreground/80" : "text-rose-500/70"
                    )} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-6 px-3 py-2">
        {dateGroups.map((group, groupIndex) => {
          const isExpanded = expandedDates.has(group.dateKey);
          const isTodayGroup = isToday(group.dateKey);

          return (
            <div key={group.dateKey} id={`date-section-${group.dateKey}`} className="relative scroll-mt-16">
              {/* Visual separator between date groups */}
              {groupIndex > 0 && (
                <div className="absolute -top-3 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/30 to-transparent" />
              )}
              
              {/* Date Header - Collapsible */}
              <button
                onClick={() => toggleDateGroup(group.dateKey)}
                className={cn(
                  "w-full flex items-center gap-3 py-3.5 px-4 rounded-2xl transition-all duration-200",
                  "hover:bg-muted/40 cursor-pointer select-none",
                  "group/header",
                  isTodayGroup
                    ? "bg-primary/5"
                    : "bg-muted/20"
                )}
              >
                {/* Chevron */}
                <div className={cn(
                  "flex-shrink-0 transition-transform duration-200",
                  isExpanded ? "rotate-0" : "-rotate-90"
                )}>
                  <ChevronDownIcon className="h-4 w-4 text-muted-foreground/60 group-hover/header:text-muted-foreground" />
                </div>
                
                {/* Calendar icon and date label */}
                <CalendarIcon className={cn(
                  "h-4 w-4 flex-shrink-0 transition-colors",
                  isTodayGroup ? "text-primary/80" : "text-muted-foreground/60"
                )} />
                <span className={cn(
                  "text-sm font-semibold tracking-tight",
                  isTodayGroup ? "text-primary" : "text-foreground/90"
                )}>
                  {group.label}
                </span>

                {/* Job counts */}
                <div className="flex items-center gap-2 ml-auto">
                  {group.favoriteCount > 0 && (
                    <span className="flex items-center gap-1.5 text-xs text-rose-500/80 bg-rose-500/8 px-2.5 py-1 rounded-full">
                      <HeartFilledIcon className="h-3 w-3" />
                      <span className="font-medium">{group.favoriteCount}</span>
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground/70 bg-muted/40 px-2.5 py-1 rounded-full font-medium">
                    {group.totalCount} {group.totalCount === 1 ? 'job' : 'jobs'}
                  </span>
                </div>
              </button>

              {/* Jobs List - Expandable content */}
              {isExpanded && (
                <ul className="space-y-3 mt-3">
                  {group.jobs.map((job, jobIndex) => {
                    const fromLink = linksMap.get(job.link_id)?.title;
                    const isJobFavorite = isFavoriteCompany(job.companyName);
                    const isFirstNonFavorite = 
                      !isJobFavorite && 
                      jobIndex > 0 && 
                      isFavoriteCompany(group.jobs[jobIndex - 1]?.companyName);

                    return (
                      <li key={job.id} className="list-none">
                        {/* Separator between favorites and other jobs */}
                        {isFirstNonFavorite && (
                          <div className="flex items-center gap-3 py-3 mb-1">
                            <div className="flex-1 h-px bg-border/20" />
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 px-2 font-medium">
                              Other Jobs
                            </span>
                            <div className="flex-1 h-px bg-border/20" />
                          </div>
                        )}

                        {/* Job card */}
                        <div
                          className={cn(
                            'group relative rounded-2xl transition-all duration-200 ease-out px-5 py-4 cursor-pointer',
                            selectedJobId === job.id
                              ? 'bg-primary/8 shadow-sm shadow-primary/10 border border-primary/20'
                              : 'bg-card/30 hover:bg-card/50 border border-border/20 hover:border-border/40 hover:shadow-sm'
                          )}
                          onClick={() => onSelect(job)}
                        >
                          {/* Title Row */}
                          <div className="mb-2 pr-10">
                            <h3 className="text-sm font-semibold leading-snug text-foreground tracking-tight">
                              {job.title}
                            </h3>
                          </div>

                          {/* Company & Location Row */}
                          <div className="mb-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-foreground/90">
                                {job.companyName}
                              </span>
                              {isJobFavorite && (
                                <HeartFilledIcon className="h-3.5 w-3.5 text-rose-500/80 flex-shrink-0" />
                              )}
                            </div>
                            
                            {job.location && (
                              <>
                                <span className="text-border/40 text-xs flex-shrink-0">•</span>
                                <span className="text-xs text-muted-foreground/80 truncate max-w-[200px]">
                                  {job.location}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Footer: Source & Timestamps */}
                          <div className="flex items-center justify-between gap-4 border-t border-border/20 pt-3">
                            {/* Source */}
                            <div className="flex items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                              <Avatar className="h-4 w-4 ring-1 ring-border/30">
                                <AvatarImage src={siteLogos[job.siteId]} />
                                <AvatarFallback className="text-[7px]">LI</AvatarFallback>
                              </Avatar>
                              <span className="text-[11px] font-medium text-muted-foreground/80">
                                {fromLink ?? siteMap[job.siteId]?.name}
                              </span>
                            </div>

                            {/* Timestamps */}
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 whitespace-nowrap">
                              {job.posted_at_raw && (
                                <span className="flex items-center gap-1">
                                  <span className="text-muted-foreground/50">posted:</span>
                                  <span className="text-muted-foreground/70 font-medium">{job.posted_at_raw}</span>
                                  {job.is_repost && (
                                    <span className="text-amber-500/70" title="This job was reposted">
                                      ↻
                                    </span>
                                  )}
                                </span>
                              )}
                              {job.posted_at_raw && <span className="text-border/30">•</span>}
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help text-muted-foreground/50">
                                      found: <span className="text-muted-foreground/70 font-medium">{getRelativeTimeString(new Date(job.created_at))}</span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    {formatExactTime(new Date(job.created_at))}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>

                          {/* Action buttons - Top Right Absolute */}
                          <div className="absolute right-3 top-3 hidden items-center gap-0.5 rounded-xl bg-background/90 pl-2 pr-1 py-1 shadow-lg ring-1 ring-border/20 backdrop-blur-md group-hover:flex">
                            {/* Archive button */}
                            {job.status !== 'archived' && (
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
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
                                    className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
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
                        </div>
                      </li>
                    );
                  })}
                  
                  {/* Load More button for this date */}
                  {group.hasMore && (
                    <li className="list-none pt-2">
                      <Button
                        variant="outline"
                        className="w-full rounded-xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 text-sm font-semibold text-primary transition-all duration-200 shadow-sm hover:shadow-md"
                        onClick={() => {
                          const lastJob = group.jobs[group.jobs.length - 1];
                          const after = lastJob ? `${lastJob.id}!${lastJob.created_at}` : undefined;
                          onLoadMoreForDate(group.dateKey, after);
                        }}
                        disabled={group.isLoading}
                      >
                        {group.isLoading ? (
                          <>
                            <Icons.spinner2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          `Load more jobs (${group.totalCount - group.jobs.length} remaining)`
                        )}
                      </Button>
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
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

/**
 * Get a more precise relative time string with better accuracy
 * Examples: "5m ago", "2h 15m ago", "1d 3h ago", "3 days ago"
 */
function getRelativeTimeString(date: Date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 0) {
    return 'just now';
  }

  const minutes = Math.floor(diffInSeconds / 60);
  const hours = Math.floor(diffInSeconds / 3600);
  const days = Math.floor(diffInSeconds / 86400);
  const weeks = Math.floor(diffInSeconds / 604800);
  const months = Math.floor(diffInSeconds / 2592000); // ~30 days
  const years = Math.floor(diffInSeconds / 31536000); // ~365 days

  // Less than 1 minute: show seconds
  if (minutes < 1) {
    return `${diffInSeconds}s ago`;
  }
  
  // Less than 1 hour: show minutes
  if (hours < 1) {
    return `${minutes}m ago`;
  }
  
  // Less than 24 hours: show hours and minutes for precision
  if (days < 1) {
    const remainingMinutes = minutes % 60;
    if (remainingMinutes > 0) {
      return `${hours}h ${remainingMinutes}m ago`;
    }
    return `${hours}h ago`;
  }
  
  // Less than 7 days: show days and hours for better accuracy
  if (weeks < 1) {
    const remainingHours = hours % 24;
    if (remainingHours > 0 && days <= 2) {
      // Show hours for first 2 days for better precision
      return `${days}d ${remainingHours}h ago`;
    }
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }
  
  // Less than 1 month: show weeks
  if (months < 1) {
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }
  
  // Less than 1 year: show months
  if (years < 1) {
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }
  
  // Years
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

/**
 * Format exact time for tooltip display
 */
function formatExactTime(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const isToday = dateOnly.getTime() === today.getTime();
  const isYesterday = dateOnly.getTime() === today.getTime() - 86400000;
  
  // Format time (e.g., "2:30 PM")
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  
  if (isToday) {
    return `Today at ${timeStr}`;
  } else if (isYesterday) {
    return `Yesterday at ${timeStr}`;
  } else {
    // Format date (e.g., "Dec 15, 2024 at 2:30 PM")
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
    return `${dateStr} at ${timeStr}`;
  }
}
