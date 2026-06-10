import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Link, useNavigate } from 'react-router-dom';

import { useAppState } from '@/hooks/appState';
import { useError } from '@/hooks/error';
import { useSession } from '@/hooks/session';
import { useSettings } from '@/hooks/settings';
import { cn } from '@/lib/utils';
import {
  addBlacklistedCompany,
  addFavoriteCompany,
  getAdvancedMatchingConfig,
  getJobById,
  getJobCounts,
  getJobDatesSummary,
  listJobs,
  openExternalUrl,
  removeBlacklistedCompany,
  removeFavoriteCompany,
  scanJob,
  updateJobLabels,
  updateJobStatus,
} from '@/lib/electronMainSdk';
import { Job, JobLabel, JobStatus } from '@first2apply/core';
import { toast } from '@first2apply/ui';

import { BrowserWindow, BrowserWindowHandle } from '../browserWindow';
import { JobDetails } from './jobDetails';
import { JobFilters } from './jobFilters';
import { JobFiltersType } from './jobFilters/jobFiltersMenu';
import { JobNotes } from './jobNotes';
import { JobSummary } from './jobSummary';
import { JobListing } from './jobTabs';
import { JobsList } from './jobsList';
import { JobDetailsSkeleton, JobSummarySkeleton, JobsListSkeleton } from './jobsSkeleton';
import { JobViewMode, jobViewGridClass } from './jobViewModeSeg';

const JOB_VIEW_MODE_KEY = 'jobs-view-mode';

const JOB_BATCH_SIZE = 100;
const ALL_JOB_STATUSES: JobStatus[] = ['new', 'applied', 'archived', 'excluded_by_advanced_matching'];

/**
 * Job tabs content component.
 */
export function JobTabsContent({
  status,
  listing,
  setListing,
  search,
  siteIds,
  linkIds,
  labels,
  hideReposted,
  onStatusChange,
  tabActions,
}: {
  status: JobStatus;
  listing: JobListing;
  setListing: (listing: React.SetStateAction<JobListing>) => void;
  search: string;
  siteIds: number[];
  linkIds: number[];
  labels: string[];
  hideReposted: boolean;
  onStatusChange: (status: JobStatus) => void;
  tabActions?: React.ReactNode;
}) {
  const { handleError } = useError();
  const { settings } = useSettings();
  const { isScanning } = useAppState();

  const navigate = useNavigate();
  const { isSubscriptionExpired } = useSession();

  const jobDescriptionRef = useRef<HTMLDivElement>(null);
  const browserWindowRef = useRef<BrowserWindowHandle>(null);
  const browserWindowRefOther = useRef<BrowserWindowHandle>(null);
  const activeJobQueryKeyRef = useRef('');

  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<JobViewMode>(() => {
    const stored = localStorage.getItem(JOB_VIEW_MODE_KEY);
    if (stored === 'list-focus' || stored === 'split' || stored === 'detail-focus') {
      return stored;
    }
    return 'split';
  });

  // Two-phase loading: date summaries + per-date jobs
  const [dateSummaries, setDateSummaries] = useState<
    Array<{ date_key: string; total_count: number; favorite_count: number }>
  >([]);
  const [jobsByDate, setJobsByDate] = useState<
    Record<string, { jobs: Job[]; hasMore: boolean; isLoading: boolean; nextPageToken?: string }>
  >({});

  // Get selected job from loaded jobs
  const selectedJob = useMemo(() => {
    if (!selectedJobId || !jobsByDate) return undefined;
    for (const dateJobs of Object.values(jobsByDate)) {
      if (!dateJobs || !dateJobs.jobs) continue;
      const job = dateJobs.jobs.find((j) => j.id === selectedJobId);
      if (job) return job;
    }
    return undefined;
  }, [jobsByDate, selectedJobId]);

  const [favoriteCompanies, setFavoriteCompanies] = useState<string[]>([]);
  const [watchedCompanies, setWatchedCompanies] = useState<string[]>([]);
  const [blacklistedCompanies, setBlacklistedCompanies] = useState<string[]>([]);
  const [isAdvancedMatchingLoaded, setIsAdvancedMatchingLoaded] = useState(false);
  const [pendingFavoriteCompany, setPendingFavoriteCompany] = useState<string | null>(null);
  const [pendingBlacklistCompany, setPendingBlacklistCompany] = useState<string | null>(null);

  const statusIndex = ALL_JOB_STATUSES.indexOf(status);

  // Navigate between tabs using arrow keys
  useHotkeys('left', () => {
    const nextIndex = (statusIndex - 1 + ALL_JOB_STATUSES.length) % ALL_JOB_STATUSES.length;
    navigate(`?status=${ALL_JOB_STATUSES[nextIndex]}&r=${Math.random()}`);
  });
  useHotkeys('right', () => {
    const nextIndex = (statusIndex + 1) % ALL_JOB_STATUSES.length;
    navigate(`?status=${ALL_JOB_STATUSES[nextIndex]}&r=${Math.random()}`);
  });

  useEffect(() => {
    const loadAdvancedMatching = async () => {
      try {
        const config = await getAdvancedMatchingConfig();
        if (config) {
          setFavoriteCompanies(config.favorite_companies ?? []);
          setWatchedCompanies(config.watched_companies ?? []);
          setBlacklistedCompanies(config.blacklisted_companies ?? []);
        }
      } catch (error) {
        handleError({ error, title: 'Failed to load company preferences' });
      } finally {
        setIsAdvancedMatchingLoaded(true);
      }
    };

    loadAdvancedMatching();
  }, [handleError]);

  // Get user's timezone (detect once, use throughout)
  const userTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);

  const jobQueryKey = useMemo(
    () =>
      JSON.stringify({
        status,
        search,
        siteIds,
        linkIds,
        labels,
        hideReposted,
        userTimezone,
      }),
    [hideReposted, labels, linkIds, search, siteIds, status, userTimezone],
  );

  // Load date summaries when location changes (Phase 1: Fast summary load)
  useEffect(() => {
    const requestKey = jobQueryKey;
    activeJobQueryKeyRef.current = requestKey;

    const asyncLoad = async () => {
      try {
        // check subscription status
        if (isSubscriptionExpired) {
          navigate('/subscription');
          return;
        }

        setListing((listing) => ({ ...listing, isLoading: true }));
        setJobsByDate({});
        setSelectedJobId(null);
        setDateSummaries([]);

        // Load active-tab date summaries and all-tab counts separately. Summaries are scoped to
        // one status, while tab badges need counts across every status.
        const [summaries, counts] = await Promise.all([
          getJobDatesSummary({ status, search, siteIds, linkIds, labels, hideReposted, timezone: userTimezone }),
          getJobCounts({ search, siteIds, linkIds, labels, hideReposted }),
        ]);

        if (activeJobQueryKeyRef.current !== requestKey) {
          return;
        }

        setJobsByDate({});
        setSelectedJobId(null);
        setDateSummaries(summaries);

        setListing((listing) => ({
          ...listing,
          isLoading: false,
          new: counts.new,
          applied: counts.applied,
          archived: counts.archived,
          filtered: counts.filtered,
        }));

      } catch (error) {
        if (activeJobQueryKeyRef.current === requestKey) {
          setListing((listing) => ({ ...listing, isLoading: false }));
          handleError({ error, title: 'Failed to load job summaries' });
        }
      }
    };
    asyncLoad();
  }, [
    handleError,
    isSubscriptionExpired,
    jobQueryKey,
    navigate,
    setListing,
  ]);

  // Load jobs for a specific date (Phase 2: On-demand job loading)
  const loadJobsForDate = useCallback(async (dateKey: string, after?: string) => {
    const requestKey = jobQueryKey;

    try {
      setJobsByDate((prev) => {
        if (activeJobQueryKeyRef.current !== requestKey) {
          return prev;
        }

        const existing = prev?.[dateKey] || { jobs: [], hasMore: false, isLoading: false };
        return {
          ...(prev || {}),
          [dateKey]: { ...existing, isLoading: true },
        };
      });

      const result = await listJobs({
        status,
        search,
        siteIds,
        linkIds,
        labels,
        hideReposted,
        limit: JOB_BATCH_SIZE,
        after,
        dateFilter: dateKey, // Local date (YYYY-MM-DD)
        timezone: userTimezone,
      });

      if (activeJobQueryKeyRef.current !== requestKey) {
        return;
      }

      setJobsByDate((prev) => {
        const existing = prev?.[dateKey] || { jobs: [], hasMore: false, isLoading: false };
        const existingJobIds = new Set(existing.jobs.map((job) => job.id));
        const newJobs = result.jobs.filter((job) => !existingJobIds.has(job.id));

        return {
          ...(prev || {}),
          [dateKey]: {
            jobs: [...existing.jobs, ...newJobs],
            hasMore: !!result.nextPageToken && result.jobs.length === JOB_BATCH_SIZE,
            isLoading: false,
            nextPageToken: result.nextPageToken,
          },
        };
      });

      // Select first job if none selected
      if (!selectedJobId && result.jobs.length > 0) {
        scanJobAndSelect(result.jobs[0]);
      }
    } catch (error) {
      if (activeJobQueryKeyRef.current !== requestKey) {
        return;
      }

      handleError({ error, title: `Failed to load jobs for ${dateKey}` });
      setJobsByDate((prev) => {
        if (!prev) return prev;
        const existing = prev[dateKey];
        if (!existing) return prev;
        return {
          ...prev,
          [dateKey]: { ...existing, isLoading: false },
        };
      });
    }
  }, [
    jobQueryKey,
    selectedJobId,
  ]);

  // Update the status of a job and remove it from the list if necessary
  const updateListedJobStatus = async (jobId: number, newStatus: JobStatus) => {
    await updateJobStatus({ jobId, status: newStatus });

    // Find and remove job from jobsByDate
    let oldJob: Job | undefined;
    let jobDateKey: string | undefined;

    if (jobsByDate) {
      for (const [dateKey, dateJobs] of Object.entries(jobsByDate)) {
        if (!dateJobs || !dateJobs.jobs) continue;
        const job = dateJobs.jobs.find((j) => j.id === jobId);
        if (job) {
          oldJob = job;
          jobDateKey = dateKey;
          break;
        }
      }
    }

    if (jobDateKey) {
      setJobsByDate((prev) => {
        const dateJobs = prev[jobDateKey!];
        if (!dateJobs || !dateJobs.jobs) return prev;
        return {
          ...prev,
          [jobDateKey!]: {
            ...dateJobs,
            jobs: dateJobs.jobs.filter((job) => job.id !== jobId),
          },
        };
      });
    }

    // Update counts
    const tabToDecrement = oldJob?.status as JobStatus;
    const tabToIncrement = newStatus;

    setListing((listing) => {
      const newCount =
        tabToIncrement === 'new' ? listing.new + 1 : tabToDecrement === 'new' ? listing.new - 1 : listing.new;
      const appliedCount =
        tabToIncrement === 'applied'
          ? listing.applied + 1
          : tabToDecrement === 'applied'
            ? listing.applied - 1
            : listing.applied;
      const archivedCount =
        tabToIncrement === 'archived'
          ? listing.archived + 1
          : tabToDecrement === 'archived'
            ? listing.archived - 1
            : listing.archived;
      const filteredCount =
        tabToDecrement === 'excluded_by_advanced_matching' ? listing.filtered - 1 : listing.filtered;

      return {
        ...listing,
        new: newCount,
        applied: appliedCount,
        archived: archivedCount,
        filtered: filteredCount,
      };
    });
  };

  // Select the next job in the list
  const selectNextJob = (jobId: number) => {
    // Flatten all jobs from all dates
    const allJobs: Job[] = [];
    if (jobsByDate) {
      for (const dateJobs of Object.values(jobsByDate)) {
        if (dateJobs && dateJobs.jobs) {
          allJobs.push(...dateJobs.jobs);
        }
      }
    }

    const currentJobIndex = allJobs.findIndex((job) => job.id === jobId);
    const nextJob = allJobs[currentJobIndex + 1] ?? allJobs[currentJobIndex - 1];
    if (nextJob) {
      scanJobAndSelect(nextJob);
    } else {
      setSelectedJobId(null);
    }
  };

  const onUpdateJobStatus = async (jobId: number, newStatus: JobStatus) => {
    try {
      await updateListedJobStatus(jobId, newStatus);
      selectNextJob(jobId);
    } catch (error) {
      handleError({ error, title: 'Failed to update job status' });
    }
  };

  const onUpdateJobLabels = async (jobId: number, labels: JobLabel[]) => {
    try {
      const updatedJob = await updateJobLabels({ jobId, labels });
      setJobsByDate((prev) => {
        if (!prev) return prev;
        const updated = { ...prev };
        for (const dateKey in updated) {
          const dateJobs = updated[dateKey];
          if (dateJobs && dateJobs.jobs) {
            updated[dateKey] = {
              ...dateJobs,
              jobs: dateJobs.jobs.map((job) => (job.id === jobId ? updatedJob : job)),
            };
          }
        }
        return updated;
      });
    } catch (error) {
      handleError({ error, title: 'Failed to update job label' });
    }
  };

  // Select a job and open the job details panel. If the jd is empty, scan the job to get the job description
  const scanJobAndSelect = async (job: Job) => {
    setSelectedJobId(job.id);

    if (!job.description) {
      try {
        // Set the job as loading in jobsByDate
        const jobDateKey = getDateKey(new Date(job.created_at));
        setJobsByDate((prev) => {
          if (!prev) return prev;
          const dateJobs = prev[jobDateKey];
          if (!dateJobs || !dateJobs.jobs) return prev;
          return {
            ...prev,
            [jobDateKey]: {
              ...dateJobs,
              jobs: dateJobs.jobs.map((j) =>
                j.id === job.id ? ({ ...j, isLoadingJD: true } as Job & { isLoadingJD?: boolean }) : j,
              ),
            },
          };
        });

        // fetch job again, just in case the JD was scrapped in the background
        let updatedJob = await getJobById(job.id);

        // if the JD is still empty, scan the job to get the job description
        if (!updatedJob.description) {
          updatedJob = await scanJob(updatedJob);
        }

        // Update the job in jobsByDate
        setJobsByDate((prev) => {
          if (!prev) return prev;
          const dateJobs = prev[jobDateKey];
          if (!dateJobs || !dateJobs.jobs) return prev;
          return {
            ...prev,
            [jobDateKey]: {
              ...dateJobs,
              jobs: dateJobs.jobs.map((j) => (j.id === updatedJob.id ? updatedJob : j)),
            },
          };
        });
      } catch (error) {
        handleError({ error, title: 'Failed to scan job' });
      }
    }
  };

  // Helper to get date key
  function getDateKey(date: Date): string {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Open a job in the default browser
  const onViewJob = (job: Job) => {
    if (settings.inAppBrowserEnabled) {
      browserWindowRef.current?.open(job.externalUrl);
    } else {
      openExternalUrl(job.externalUrl);
    }
  };
  const onOpenUrl = (url: string) => {
    browserWindowRefOther.current?.open(url);
  };

  const markSelectedJobAsApplied = async () => {
    try {
      if (selectedJobId) {
        await onUpdateJobStatus(selectedJobId, 'applied');
        toast({
          title: 'Job marked as applied',
          description: 'The job has been moved to the applied jobs list.',
          variant: 'success',
        });
        await browserWindowRef.current?.finish();
      }
    } catch (error) {
      handleError({ error, title: 'Failed to mark job as applied' });
    }
  };

  // Scroll to the top of the job description panel when the selected job changes
  useEffect(() => {
    if (jobDescriptionRef.current) {
      jobDescriptionRef.current.scrollTop = 0;
    }
  }, [selectedJobId]);

  // Update the query params when the search input changes
  const onSearchJobs = ({ search, filters }: { search: string; filters: JobFiltersType }) => {
    navigate(
      `?status=${status}&search=${search}&site_ids=${filters.sites.join(',')}&link_ids=${filters.links.join(',')}&labels=${filters.labels.join(',')}&hide_reposted=${filters.hideReposted}`,
    );
  };

  const normalizeCompanyName = (companyName?: string | null) => companyName?.trim() ?? '';
  const companyKey = (companyName?: string | null) => normalizeCompanyName(companyName).toLowerCase();

  const isFavoriteCompany = (companyName?: string | null) => {
    const key = companyKey(companyName);
    if (!key) {
      return false;
    }
    return favoriteCompanies.some((company) => company.toLowerCase() === key);
  };

  const isBlacklistedCompany = (companyName?: string | null) => {
    const key = companyKey(companyName);
    if (!key) {
      return false;
    }
    return blacklistedCompanies.some((company) => company.toLowerCase() === key);
  };

  const removeJobsByCompany = (companyName: string): Job | null => {
    const key = companyName.toLowerCase();
    let nextJobToSelect: Job | null = null;
    let removedSelectedJob = false;
    setListing((prev) => {
      const jobsToRemove = prev.jobs.filter((job) => job.companyName && job.companyName.toLowerCase() === key);
      if (jobsToRemove.length === 0) {
        return prev;
      }

      const remainingJobs = prev.jobs.filter((job) => !job.companyName || job.companyName.toLowerCase() !== key);

      let newCount = prev.new;
      let appliedCount = prev.applied;
      let archivedCount = prev.archived;
      let filteredCount = prev.filtered;
      const removedIds = new Set<number>();

      jobsToRemove.forEach((job) => {
        removedIds.add(job.id);
        switch (job.status) {
          case 'new':
            newCount = Math.max(0, newCount - 1);
            break;
          case 'applied':
            appliedCount = Math.max(0, appliedCount - 1);
            break;
          case 'archived':
            archivedCount = Math.max(0, archivedCount - 1);
            break;
          case 'excluded_by_advanced_matching':
            filteredCount = Math.max(0, filteredCount - 1);
            break;
          default:
            break;
        }
      });

      if (selectedJobId && removedIds.has(selectedJobId)) {
        removedSelectedJob = true;
        nextJobToSelect = remainingJobs[0] ?? null;
      }

      return {
        ...prev,
        jobs: remainingJobs,
        new: newCount,
        applied: appliedCount,
        archived: archivedCount,
        filtered: filteredCount,
      };
    });

    if (removedSelectedJob) {
      if (nextJobToSelect) {
        setSelectedJobId(nextJobToSelect.id);
      } else {
        setSelectedJobId(null);
      }
    }

    return nextJobToSelect;
  };

  const toggleFavoriteCompany = async (companyName?: string | null) => {
    const normalized = normalizeCompanyName(companyName);
    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    setPendingFavoriteCompany(key);
    const alreadyFavorite = isFavoriteCompany(normalized);
    const isWatched = watchedCompanies.some((c) => c.toLowerCase() === key);

    try {
      const updatedConfig = alreadyFavorite
        ? await removeFavoriteCompany(normalized)
        : await addFavoriteCompany(normalized);

      setFavoriteCompanies(updatedConfig.favorite_companies ?? []);
      setWatchedCompanies(updatedConfig.watched_companies ?? []);
      setBlacklistedCompanies(updatedConfig.blacklisted_companies ?? []);

      let toastMessage = '';
      if (alreadyFavorite) {
        toastMessage = `${normalized} removed from favorites`;
      } else if (isWatched) {
        toastMessage = `${normalized} promoted to favorites`;
      } else {
        toastMessage = `${normalized} added to watched companies`;
      }

      toast({
        title: toastMessage,
        variant: 'success',
      });
    } catch (error) {
      handleError({ error, title: 'Failed to update favorite companies' });
    } finally {
      setPendingFavoriteCompany(null);
    }
  };

  const toggleBlacklistedCompany = async (companyName?: string | null) => {
    const normalized = normalizeCompanyName(companyName);
    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    setPendingBlacklistCompany(key);
    const alreadyBlacklisted = isBlacklistedCompany(normalized);

    try {
      const updatedConfig = alreadyBlacklisted
        ? await removeBlacklistedCompany(normalized)
        : await addBlacklistedCompany(normalized);

      setBlacklistedCompanies(updatedConfig.blacklisted_companies ?? []);
      setFavoriteCompanies(updatedConfig.favorite_companies ?? []);

      if (alreadyBlacklisted) {
        toast({
          title: `${normalized} removed from blacklist`,
          variant: 'success',
        });
      } else {
        const nextJob = removeJobsByCompany(normalized);
        toast({
          title: `${normalized} added to blacklist`,
          description: 'We cleaned the current list for you. Future scans will skip this company.',
          variant: 'success',
        });
        if (nextJob) {
          scanJobAndSelect(nextJob);
        }
      }
    } catch (error) {
      handleError({ error, title: 'Failed to update blacklisted companies' });
    } finally {
      setPendingBlacklistCompany(null);
    }
  };

  const selectedCompanyKey = selectedJob ? companyKey(selectedJob.companyName) : '';

  const onViewModeChange = (mode: JobViewMode) => {
    setViewMode(mode);
    localStorage.setItem(JOB_VIEW_MODE_KEY, mode);
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-1.5 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 data-testid="page-title" className="text-[17px] font-semibold leading-tight text-foreground">
              Jobs
            </h1>
            <p className="text-[10px] text-muted-foreground">
              Tabular board · logos · search · times in columns
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {isScanning && (
              <div className="hidden items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[10px] sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                <strong className="text-foreground">Scanning</strong>
              </div>
            )}
            {tabActions}
          </div>
        </div>
        <JobFilters
          search={search}
          siteIds={siteIds}
          linkIds={linkIds}
          labels={labels}
          hideReposted={hideReposted}
          status={status}
          listingCounts={{
            new: listing.new,
            applied: listing.applied,
            archived: listing.archived,
            filtered: listing.filtered,
          }}
          onStatusChange={onStatusChange}
          onSearchJobs={onSearchJobs}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />
      </div>

      <section
        className={cn(
          'grid min-h-0 flex-1 grid-cols-1 gap-1.5',
          jobViewGridClass(viewMode),
        )}
      >
        <div id="jobsList" className="flex min-h-0 min-w-0 flex-col">
          <div className="min-h-0 flex-1">
            {listing.isLoading ? (
              <JobsListSkeleton />
            ) : dateSummaries.length > 0 ? (
              <JobsList
                dateSummaries={dateSummaries}
                jobsByDate={jobsByDate}
                selectedJobId={selectedJobId}
                onLoadMoreForDate={loadJobsForDate}
                onSelect={(job) => scanJobAndSelect(job)}
                onApplied={(j) => onUpdateJobStatus(j.id, 'applied')}
                onArchive={(j) => onUpdateJobStatus(j.id, 'archived')}
                onDelete={(j) => onUpdateJobStatus(j.id, 'deleted')}
                favoriteCompanies={favoriteCompanies}
                watchedCompanies={watchedCompanies}
                showAppliedAction={status === 'new'}
              />
            ) : (
              <p className="px-4 pt-20 text-center">
                {search || (siteIds && siteIds.length > 0) || (linkIds && linkIds.length > 0) ? (
                  <NoSearchResults />
                ) : (
                  "No new job listings right now, but don't worry! We're on the lookout and will update you as soon as we find anything."
                )}
              </p>
            )}
          </div>
        </div>

        {listing.isLoading ? (
          <div className="no-scrollbar hidden min-h-0 animate-pulse space-y-4 overflow-scroll rounded-md border border-border bg-card p-4 lg:block">
            <JobSummarySkeleton />
            <JobDetailsSkeleton />
          </div>
        ) : Object.values(jobsByDate).some((dateJobs) => dateJobs?.jobs?.length > 0) || selectedJob ? (
          <div
            ref={jobDescriptionRef}
            className="hidden min-h-0 flex-col overflow-hidden rounded-md border border-border bg-card lg:flex"
          >
            {selectedJob && (
              <>
                <JobSummary
                  job={selectedJob}
                  onView={onViewJob}
                  onUpdateJobStatus={onUpdateJobStatus}
                  onUpdateLabels={onUpdateJobLabels}
                  onOpenUrl={onOpenUrl}
                  isFavoriteCompany={isFavoriteCompany(selectedJob.companyName)}
                  isWatchedCompany={watchedCompanies.some(
                    (c) => c.toLowerCase() === (selectedJob.companyName || '').toLowerCase(),
                  )}
                  isBlacklistedCompany={isBlacklistedCompany(selectedJob.companyName)}
                  onToggleFavorite={toggleFavoriteCompany}
                  onToggleBlacklist={toggleBlacklistedCompany}
                  favoriteActionPending={!!selectedCompanyKey && pendingFavoriteCompany === selectedCompanyKey}
                  blacklistActionPending={!!selectedCompanyKey && pendingBlacklistCompany === selectedCompanyKey}
                  isCompanyPreferencesLoaded={isAdvancedMatchingLoaded}
                />
                <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2.5">
                  <JobNotes jobId={selectedJob.id} compact />
                  <JobDetails
                    job={selectedJob}
                    compact
                    isScrapingDescription={!!(selectedJob as Job & { isLoadingJD?: boolean }).isLoadingJD}
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <div
            ref={jobDescriptionRef}
            className="hidden min-h-0 items-center justify-center overflow-scroll rounded-md border border-border bg-card p-4 lg:flex lg:w-full"
          >
            <EmptyJobsIllustration />
          </div>
        )}
      </section>

      <div className="mt-1 flex items-center justify-between rounded-md border border-border bg-card px-2 py-1 text-[10px] text-muted-foreground">
        <span>↑↓ jobs · Enter open · A applied · E archive</span>
      </div>
      </div>

      <BrowserWindow
        ref={browserWindowRef}
        onClose={() => {}}
        customActionButton={{
          text: 'Applied',
          onClick: () => markSelectedJobAsApplied(),
          tooltip: 'Mark this job as applied',
        }}
      />
      <BrowserWindow
        ref={browserWindowRefOther}
        onClose={() => {}}
        customActionButton={{
          text: 'Done',
          onClick: () => {
            browserWindowRefOther.current?.finish();
          },
          tooltip: 'Done browsing',
        }}
      />
    </>
  );
}

function EmptyJobsIllustration() {
  return (
    <svg
      width="798"
      height="835"
      viewBox="0 0 798 835"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto h-fit w-3/5 opacity-80"
    >
      <g clipPath="url(#clip0_empty_jobs)">
        <path
          d="M496 603C662.514 603 797.5 468.014 797.5 301.5C797.5 134.986 662.514 0 496 0C329.486 0 194.5 134.986 194.5 301.5C194.5 468.014 329.486 603 496 603Z"
          fill="currentColor"
          className="text-muted-foreground/30"
        />
      </g>
      <defs>
        <clipPath id="clip0_empty_jobs">
          <rect width="797.5" height="834.5" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

const NoSearchResults = () => {
  const { isScanning } = useAppState();

  return isScanning ? (
    <span>
      There aren't any jobs that match your search. We are currently scanning your saved{' '}
      <Link className="text-primary" to={`/links`}>
        Job Searches
      </Link>{' '}
      for any new jobs. Please check back in a few minutes.
    </span>
  ) : (
    <span>There aren't any jobs that match your search.</span>
  );
};
