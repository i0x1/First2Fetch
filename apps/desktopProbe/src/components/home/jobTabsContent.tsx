import { useEffect, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAppState } from '@/hooks/appState';
import { useError } from '@/hooks/error';
import { useSession } from '@/hooks/session';
import { useSettings } from '@/hooks/settings';
import {
  addBlacklistedCompany,
  addFavoriteCompany,
  getJobById,
  getAdvancedMatchingConfig,
  listJobs,
  openExternalUrl,
  removeBlacklistedCompany,
  removeFavoriteCompany,
  scanJob,
  updateJobLabels,
  updateJobStatus,
} from '@/lib/electronMainSdk';
import { Job, JobLabel, JobStatus } from '@first2apply/core';
import { TabsContent } from '@first2apply/ui';
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

const JOB_BATCH_SIZE = 30;
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
}: {
  status: JobStatus;
  listing: JobListing;
  setListing: (listing: React.SetStateAction<JobListing>) => void;
  search: string;
  siteIds: number[];
  linkIds: number[];
  labels: string[];
  hideReposted: boolean;
}) {
  const { handleError } = useError();
  const { settings } = useSettings();

  const navigate = useNavigate();
  const location = useLocation();
  const { isSubscriptionExpired } = useSession();

  const jobDescriptionRef = useRef<HTMLDivElement>(null);
  const browserWindowRef = useRef<BrowserWindowHandle>(null);
  const browserWindowRefOther = useRef<BrowserWindowHandle>(null);

  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const selectedJob = listing.jobs.find((job) => job.id === selectedJobId);

  const [favoriteCompanies, setFavoriteCompanies] = useState<string[]>([]);
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

  // Reload jobs when location changes
  useEffect(() => {
    const asyncLoad = async () => {
      try {
        // check subscription status
        if (isSubscriptionExpired) {
          navigate('/subscription');
          return;
        }

        console.log(location.search);
        setListing((listing) => ({ ...listing, isLoading: true }));

        const result = await listJobs({ status, search, siteIds, linkIds, labels, hideReposted, limit: JOB_BATCH_SIZE });
        console.log('found jobs', result.jobs.length);

        setListing({
          ...result,
          isLoading: false,
          hasMore: result.jobs.length === JOB_BATCH_SIZE,
        });

        const firstJob = result.jobs[0];
        if (firstJob) {
          scanJobAndSelect(firstJob);
        } else {
          setSelectedJobId(null);
        }
      } catch (error) {
        handleError({ error, title: 'Failed to load jobs' });
      }
    };
    asyncLoad();
  }, [location.search]); // using location.search to trigger the effect when the query parameter changes

  // Load a new batch of jobs after updating the status of a job if there are still jobs to load
  useEffect(() => {
    const asyncLoad = async () => {
      try {
        if (
          !listing.isLoading &&
          listing.jobs.length < JOB_BATCH_SIZE / 2 &&
          listing.hasMore &&
          listing.nextPageToken
        ) {
          setListing((l) => ({ ...l, isLoading: true }));
          const result = await listJobs({
            status,
            limit: JOB_BATCH_SIZE,
            after: listing.nextPageToken,
            search,
            siteIds,
            labels,
            linkIds,
            hideReposted,
          });
          setListing((l) => {
            // Deduplicate jobs by ID to prevent duplicate keys
            const existingJobIds = new Set(l.jobs.map((job) => job.id));
            const newJobs = result.jobs.filter((job) => !existingJobIds.has(job.id));
            return {
              ...result,
              jobs: l.jobs.concat(newJobs),
              isLoading: false,
              hasMore: !!result.nextPageToken,
            };
          });
        }
      } catch (error) {
        handleError({ error });
      }
    };

    asyncLoad();
  }, [listing]);

  // Update the status of a job and remove it from the list if necessary
  const updateListedJobStatus = async (jobId: number, newStatus: JobStatus) => {
    await updateJobStatus({ jobId, status: newStatus });

    setListing((listing) => {
      const oldJob = listing.jobs.find((job) => job.id === jobId);
      const jobs = listing.jobs.filter((job) => job.id !== jobId);

      const tabToDecrement = oldJob?.status as JobStatus;
      const tabToIncrement = newStatus;

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
        jobs,
        new: newCount,
        applied: appliedCount,
        archived: archivedCount,
        filtered: filteredCount,
      };
    });
  };

  // Select the next job in the list
  const selectNextJob = (jobId: number) => {
    const currentJobIndex = listing.jobs.findIndex((job) => job.id === jobId);
    const nextJob = listing.jobs[currentJobIndex + 1] ?? listing.jobs[currentJobIndex - 1];
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
      setListing((listing) => ({
        ...listing,
        jobs: listing.jobs.map((job) => (job.id === jobId ? updatedJob : job)),
      }));
    } catch (error) {
      handleError({ error, title: 'Failed to update job label' });
    }
  };

  const onLoadMore = async () => {
    try {
      const result = await listJobs({
        status,
        limit: JOB_BATCH_SIZE,
        after: listing.nextPageToken,
        search,
        siteIds,
        hideReposted,
        labels,
        linkIds,
      });

      setListing((listing) => {
        // Deduplicate jobs by ID to prevent duplicate keys
        const existingJobIds = new Set(listing.jobs.map((job) => job.id));
        const newJobs = result.jobs.filter((job) => !existingJobIds.has(job.id));
        return {
          ...result,
          jobs: [...listing.jobs, ...newJobs],
          isLoading: false,
          hasMore: result.jobs.length === JOB_BATCH_SIZE,
        };
      });
    } catch (error) {
      handleError({ error, title: 'Failed to load more jobs' });
    }
  };

  // Select a job and open the job details panel. If the jd is empty, scan the job to get the job description
  const scanJobAndSelect = async (job: Job) => {
    setSelectedJobId(job.id);

    if (!job.description) {
      try {
        // Set the job as loading
        setListing((listing) => {
          const jobs = listing.jobs.map((j) => (j.id === job.id ? { ...job, isLoadingJD: true } : j));
          return { ...listing, jobs };
        });

        // fetch job again, just in case the JD was scrapped in the background
        let updatedJob = await getJobById(job.id);

        // if the JD is still empty, scan the job to get the job description
        if (!updatedJob.description) {
          updatedJob = await scanJob(updatedJob);
        }

        // Update the job in the list
        setListing((listing) => {
          const jobs = listing.jobs.map((j) => (j.id === updatedJob.id ? updatedJob : j));
          return { ...listing, jobs };
        });
      } catch (error) {
        handleError({ error, title: 'Failed to scan job' });
      }
    }
  };

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
      const jobsToRemove = prev.jobs.filter(
        (job) => job.companyName && job.companyName.toLowerCase() === key,
      );
      if (jobsToRemove.length === 0) {
        return prev;
      }

      const remainingJobs = prev.jobs.filter(
        (job) => !job.companyName || job.companyName.toLowerCase() !== key,
      );

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

    try {
      const updatedConfig = alreadyFavorite
        ? await removeFavoriteCompany(normalized)
        : await addFavoriteCompany(normalized);

      setFavoriteCompanies(updatedConfig.favorite_companies ?? []);
      setBlacklistedCompanies(updatedConfig.blacklisted_companies ?? []);

      toast({
        title: alreadyFavorite ? `${normalized} removed from favorites` : `${normalized} added to favorites`,
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

  return (
    <>
      {ALL_JOB_STATUSES.map((statusItem) => {
        return (
          <TabsContent key={statusItem} value={statusItem} className="focus-visible:ring-0">
            <section className="flex gap-4">
              {/* Jobs list, search and filters side */}
              <div
                id="jobsList"
                className="no-scrollbar h-[calc(100vh-100px)] w-1/2 overflow-y-scroll lg:w-2/5"
              >
                <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm pb-4 pt-2">
                  <JobFilters
                    search={search}
                    siteIds={siteIds}
                    linkIds={linkIds}
                    labels={labels}
                    hideReposted={hideReposted}
                    onSearchJobs={onSearchJobs}
                  />
                </div>

                {listing.isLoading || statusItem !== status ? (
                  <JobsListSkeleton />
                ) : listing.jobs.length > 0 ? (
                  <JobsList
                    jobs={listing.jobs}
                    selectedJobId={selectedJobId}
                    hasMore={listing.hasMore}
                    parentContainerId="jobsList"
                    onLoadMore={onLoadMore}
                    onSelect={(job) => scanJobAndSelect(job)}
                    onArchive={(j) => {
                      onUpdateJobStatus(j.id, 'archived');
                    }}
                    onDelete={(j) => {
                      onUpdateJobStatus(j.id, 'deleted');
                    }}
                    favoriteCompanies={favoriteCompanies}
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

              {/* Job description side */}
              {listing.isLoading || statusItem !== status ? (
                <div className="no-scrollbar h-[calc(100vh-100px)] w-1/2 animate-pulse space-y-6 overflow-scroll border-l border-border/50 pl-4 lg:w-3/5 lg:space-y-8">
                  <JobSummarySkeleton />
                  <JobDetailsSkeleton />
                </div>
              ) : listing.jobs.length > 0 ? (
                <div
                  ref={jobDescriptionRef}
                  className="no-scrollbar h-[calc(100vh-100px)] w-1/2 space-y-6 overflow-y-scroll border-l border-border/50 pl-4 lg:w-3/5 lg:space-y-8"
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
                        isBlacklistedCompany={isBlacklistedCompany(selectedJob.companyName)}
                        onToggleFavorite={toggleFavoriteCompany}
                        onToggleBlacklist={toggleBlacklistedCompany}
                        favoriteActionPending={
                          !!selectedCompanyKey && pendingFavoriteCompany === selectedCompanyKey
                        }
                        blacklistActionPending={
                          !!selectedCompanyKey && pendingBlacklistCompany === selectedCompanyKey
                        }
                        isCompanyPreferencesLoaded={isAdvancedMatchingLoaded}
                      />
                      <JobNotes jobId={selectedJobId} />
                      <hr className="border-t border-border/50" />
                      <JobDetails job={selectedJob} isScrapingDescription={!!selectedJob.isLoadingJD}></JobDetails>
                    </>
                  )}
                </div>
              ) : (
                <div
                  ref={jobDescriptionRef}
                  className="flex h-[calc(100vh-100px)] w-1/2 items-center justify-center overflow-scroll border-l border-border/50 pl-4 lg:w-3/5"
                >
                  {/* Light mode svg */}
                  <svg
                    width="798"
                    height="835"
                    viewBox="0 0 798 835"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mx-auto mt-20 h-fit w-3/5 dark:hidden"
                  >
                    <g clipPath="url(#clip0_2004_166)">
                      <path
                        d="M308.5 834.5C478.88 834.5 617 810.1 617 780C617 749.9 478.88 725.5 308.5 725.5C138.12 725.5 0 749.9 0 780C0 810.1 138.12 834.5 308.5 834.5Z"
                        fill="#3F3D56"
                      />
                      <path
                        d="M496 603C662.514 603 797.5 468.014 797.5 301.5C797.5 134.986 662.514 0 496 0C329.486 0 194.5 134.986 194.5 301.5C194.5 468.014 329.486 603 496 603Z"
                        fill="#3F3D56"
                      />
                      <path
                        opacity="0.05"
                        d="M496 550.398C633.462 550.398 744.898 438.962 744.898 301.5C744.898 164.037 633.462 52.6021 496 52.6021C358.537 52.6021 247.102 164.037 247.102 301.5C247.102 438.962 358.537 550.398 496 550.398Z"
                        fill="black"
                      />
                      <path
                        opacity="0.05"
                        d="M496 505.494C608.663 505.494 699.994 414.163 699.994 301.5C699.994 188.837 608.663 97.5063 496 97.5063C383.337 97.5063 292.006 188.837 292.006 301.5C292.006 414.163 383.337 505.494 496 505.494Z"
                        fill="black"
                      />
                      <path
                        opacity="0.05"
                        d="M496 447.759C576.777 447.759 642.26 382.277 642.26 301.5C642.26 220.723 576.777 155.24 496 155.24C415.223 155.24 349.74 220.723 349.74 301.5C349.74 382.277 415.223 447.759 496 447.759Z"
                        fill="black"
                      />
                      <path
                        d="M197.17 328.482C197.17 328.482 173.466 395.205 184.001 418.909C194.536 442.613 211.217 465.439 211.217 465.439C211.217 465.439 205.071 332.872 197.17 328.482Z"
                        fill="#CCCCCC"
                      />
                      <path
                        opacity="0.1"
                        d="M196.868 329C196.868 329 173.164 395.722 183.699 419.426C194.234 443.13 210.915 465.956 210.915 465.956C210.915 465.956 204.769 333.39 196.868 329Z"
                        fill="black"
                      />
                      <path
                        d="M213.851 482.997C213.851 482.997 212.095 499.678 211.217 500.555C210.339 501.433 212.095 503.189 211.217 505.823C210.339 508.457 209.461 511.968 211.217 512.846C212.973 513.724 201.56 590.982 201.56 590.982C201.56 590.982 173.466 627.854 184.879 685.797L188.391 744.618C188.391 744.618 215.607 746.374 215.607 736.717C215.607 736.717 213.851 725.304 213.851 720.036C213.851 714.769 218.24 714.769 215.607 712.135C212.973 709.501 212.973 707.745 212.973 707.745C212.973 707.745 217.362 704.234 216.485 703.356C215.607 702.478 224.386 640.145 224.386 640.145C224.386 640.145 234.043 630.488 234.043 625.221V619.953C234.043 619.953 238.433 608.54 238.433 607.662C238.433 606.784 262.137 553.231 262.137 553.231L271.794 591.86L282.329 647.169C282.329 647.169 287.596 697.21 298.131 716.525C298.131 716.525 316.568 779.735 316.568 777.979C316.568 776.224 347.295 771.834 346.417 763.933C345.539 756.031 327.981 645.413 327.981 645.413L332.37 481.241L213.851 482.997Z"
                        fill="#2F2E41"
                      />
                      <path
                        d="M190.147 740.228C190.147 740.228 166.443 786.758 182.246 788.514C198.048 790.27 204.194 790.27 211.217 783.247C215.057 779.407 222.832 774.255 229.093 770.374C232.802 768.111 235.799 764.849 237.739 760.961C239.679 757.073 240.484 752.717 240.062 748.392C239.599 744.097 237.994 740.558 234.043 740.228C223.508 739.351 211.217 729.693 211.217 729.693L190.147 740.228Z"
                        fill="#2F2E41"
                      />
                      <path
                        d="M320.957 774.468C320.957 774.468 297.254 820.998 313.056 822.754C328.859 824.509 335.004 824.509 342.028 817.486C345.867 813.646 353.643 808.495 359.903 804.613C363.613 802.35 366.609 799.088 368.549 795.2C370.489 791.312 371.295 786.956 370.872 782.631C370.409 778.336 368.804 774.797 364.854 774.468C354.319 773.59 342.028 763.933 342.028 763.933L320.957 774.468Z"
                        fill="#2F2E41"
                      />
                      <path
                        d="M295.905 252.337C316.287 252.337 332.809 235.814 332.809 215.432C332.809 195.051 316.287 178.528 295.905 178.528C275.523 178.528 259 195.051 259 215.432C259 235.814 275.523 252.337 295.905 252.337Z"
                        fill="#FFB8B8"
                      />
                      <path
                        d="M272.18 227.558C272.18 227.558 245.82 276.061 243.711 276.061C241.602 276.061 291.16 291.878 291.16 291.878C291.16 291.878 304.867 245.483 306.976 241.266L272.18 227.558Z"
                        fill="#FFB8B8"
                      />
                      <path
                        d="M312.617 280.636C312.617 280.636 259.942 251.664 254.674 252.542C249.407 253.42 193.22 302.584 194.098 322.776C194.976 342.968 201.999 376.329 201.999 376.329C201.999 376.329 204.633 469.389 209.9 470.267C215.168 471.145 209.022 486.948 210.778 486.948C212.534 486.948 333.687 486.948 334.565 484.314C335.443 481.68 312.617 280.636 312.617 280.636Z"
                        fill="#CCCCCC"
                      />
                      <path
                        d="M342.028 489.142C342.028 489.142 358.708 540.062 344.661 538.306C330.615 536.55 324.469 494.41 324.469 494.41L342.028 489.142Z"
                        fill="#FFB8B8"
                      />
                      <path
                        d="M297.254 277.562C297.254 277.562 264.77 284.586 270.038 328.482C275.306 372.378 284.963 416.274 284.963 416.274L317.446 487.386L320.958 500.555L344.662 494.41L327.103 392.57C327.103 392.57 320.958 283.708 313.056 280.196C308.074 278.072 302.656 277.169 297.254 277.562Z"
                        fill="#CCCCCC"
                      />
                      <path
                        opacity="0.1"
                        d="M277.5 414.958L317.885 486.947L283.86 411.09L277.5 414.958Z"
                        fill="black"
                      />
                      <path
                        d="M332.646 204.566L332.768 201.746L338.378 203.142C338.318 202.237 338.062 201.355 337.628 200.558C337.194 199.761 336.592 199.068 335.864 198.527L341.84 198.193C336.826 191.067 330.419 185.032 323.007 180.451C315.595 175.87 307.332 172.839 298.716 171.541C285.79 169.668 271.397 172.379 262.534 181.972C258.234 186.625 255.533 192.542 253.611 198.579C250.072 209.697 249.351 222.951 256.731 231.988C264.232 241.173 277.333 242.972 289.137 244.109C293.29 244.509 297.643 244.881 301.491 243.27C301.92 238.855 301.355 234.401 299.838 230.233C299.206 228.943 298.904 227.516 298.959 226.081C299.483 222.569 304.168 221.684 307.686 222.159C311.205 222.633 315.436 223.359 317.748 220.664C319.341 218.808 319.247 216.105 319.458 213.669C320.033 207.035 332.586 205.956 332.646 204.566Z"
                        fill="#2F2E41"
                      />
                      <path
                        d="M559 787.5C582.748 787.5 602 768.248 602 744.5C602 720.752 582.748 701.5 559 701.5C535.252 701.5 516 720.752 516 744.5C516 768.248 535.252 787.5 559 787.5Z"
                        fill="#809966"
                      />
                      <path
                        d="M54 772.5C77.7482 772.5 97 753.248 97 729.5C97 705.752 77.7482 686.5 54 686.5C30.2518 686.5 11 705.752 11 729.5C11 753.248 30.2518 772.5 54 772.5Z"
                        fill="#809966"
                      />
                      <path
                        d="M54 703.5C71.1208 703.5 85 689.621 85 672.5C85 655.379 71.1208 641.5 54 641.5C36.8792 641.5 23 655.379 23 672.5C23 689.621 36.8792 703.5 54 703.5Z"
                        fill="#809966"
                      />
                      <path
                        d="M54 646.5C66.1503 646.5 76 636.65 76 624.5C76 612.35 66.1503 602.5 54 602.5C41.8497 602.5 32 612.35 32 624.5C32 636.65 41.8497 646.5 54 646.5Z"
                        fill="#809966"
                      />
                    </g>
                    <defs>
                      <clipPath id="clip0_2004_166">
                        <rect width="797.5" height="834.5" fill="white" />
                      </clipPath>
                    </defs>
                  </svg>

                  {/* Dark mode svg */}
                  <svg
                    width="798"
                    height="835"
                    viewBox="0 0 798 835"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mx-auto my-10 hidden h-fit w-3/5 dark:block"
                  >
                    <g clipPath="url(#clip0_2004_70)">
                      <path
                        d="M308.5 834.5C478.88 834.5 617 810.1 617 780C617 749.9 478.88 725.5 308.5 725.5C138.12 725.5 0 749.9 0 780C0 810.1 138.12 834.5 308.5 834.5Z"
                        fill="#222222"
                      />
                      <path
                        d="M496 603C662.514 603 797.5 468.014 797.5 301.5C797.5 134.986 662.514 0 496 0C329.486 0 194.5 134.986 194.5 301.5C194.5 468.014 329.486 603 496 603Z"
                        fill="#222222"
                      />
                      <path
                        opacity="0.05"
                        d="M496 550.398C633.462 550.398 744.898 438.962 744.898 301.5C744.898 164.037 633.462 52.6021 496 52.6021C358.537 52.6021 247.102 164.037 247.102 301.5C247.102 438.962 358.537 550.398 496 550.398Z"
                        fill="black"
                      />
                      <path
                        opacity="0.05"
                        d="M496 505.494C608.663 505.494 699.994 414.163 699.994 301.5C699.994 188.837 608.663 97.5063 496 97.5063C383.337 97.5063 292.006 188.837 292.006 301.5C292.006 414.163 383.337 505.494 496 505.494Z"
                        fill="black"
                      />
                      <path
                        opacity="0.05"
                        d="M496 447.759C576.777 447.759 642.26 382.277 642.26 301.5C642.26 220.723 576.777 155.24 496 155.24C415.223 155.24 349.74 220.723 349.74 301.5C349.74 382.277 415.223 447.759 496 447.759Z"
                        fill="black"
                      />
                      <path
                        d="M197.17 328.482C197.17 328.482 173.466 395.205 184.001 418.909C194.536 442.613 211.217 465.439 211.217 465.439C211.217 465.439 205.071 332.872 197.17 328.482Z"
                        fill="#CCCCCC"
                      />
                      <path
                        opacity="0.1"
                        d="M196.868 329C196.868 329 173.164 395.722 183.699 419.426C194.234 443.13 210.915 465.956 210.915 465.956C210.915 465.956 204.769 333.39 196.868 329Z"
                        fill="black"
                      />
                      <path
                        d="M213.851 482.997C213.851 482.997 212.095 499.678 211.217 500.555C210.339 501.433 212.095 503.189 211.217 505.823C210.339 508.457 209.461 511.968 211.217 512.846C212.973 513.724 201.56 590.982 201.56 590.982C201.56 590.982 173.466 627.854 184.879 685.797L188.391 744.618C188.391 744.618 215.607 746.374 215.607 736.717C215.607 736.717 213.851 725.304 213.851 720.036C213.851 714.769 218.24 714.769 215.607 712.135C212.973 709.501 212.973 707.745 212.973 707.745C212.973 707.745 217.362 704.234 216.485 703.356C215.607 702.478 224.386 640.145 224.386 640.145C224.386 640.145 234.043 630.488 234.043 625.221V619.953C234.043 619.953 238.433 608.54 238.433 607.662C238.433 606.784 262.137 553.231 262.137 553.231L271.794 591.86L282.329 647.169C282.329 647.169 287.596 697.21 298.131 716.525C298.131 716.525 316.568 779.735 316.568 777.979C316.568 776.224 347.295 771.834 346.417 763.933C345.539 756.031 327.981 645.413 327.981 645.413L332.37 481.241L213.851 482.997Z"
                        fill="#717171"
                      />
                      <path
                        d="M190.147 740.228C190.147 740.228 166.443 786.758 182.246 788.514C198.048 790.27 204.194 790.27 211.217 783.247C215.057 779.407 222.832 774.255 229.093 770.374C232.802 768.111 235.799 764.849 237.739 760.961C239.679 757.073 240.484 752.717 240.062 748.392C239.599 744.097 237.994 740.558 234.043 740.228C223.508 739.351 211.217 729.693 211.217 729.693L190.147 740.228Z"
                        fill="#717171"
                      />
                      <path
                        d="M320.957 774.468C320.957 774.468 297.254 820.998 313.056 822.754C328.859 824.509 335.004 824.509 342.028 817.486C345.867 813.646 353.643 808.495 359.903 804.613C363.613 802.35 366.609 799.088 368.549 795.2C370.489 791.312 371.295 786.956 370.872 782.631C370.409 778.336 368.804 774.797 364.854 774.468C354.319 773.59 342.028 763.933 342.028 763.933L320.957 774.468Z"
                        fill="#717171"
                      />
                      <path
                        d="M295.905 252.337C316.287 252.337 332.809 235.814 332.809 215.432C332.809 195.051 316.287 178.528 295.905 178.528C275.523 178.528 259 195.051 259 215.432C259 235.814 275.523 252.337 295.905 252.337Z"
                        fill="#FFB8B8"
                      />
                      <path
                        d="M272.18 227.558C272.18 227.558 245.82 276.061 243.711 276.061C241.602 276.061 291.16 291.878 291.16 291.878C291.16 291.878 304.867 245.483 306.976 241.266L272.18 227.558Z"
                        fill="#FFB8B8"
                      />
                      <path
                        d="M312.617 280.636C312.617 280.636 259.942 251.664 254.674 252.542C249.407 253.42 193.22 302.584 194.098 322.776C194.976 342.968 201.999 376.329 201.999 376.329C201.999 376.329 204.633 469.389 209.9 470.267C215.168 471.145 209.022 486.948 210.778 486.948C212.534 486.948 333.687 486.948 334.565 484.314C335.443 481.68 312.617 280.636 312.617 280.636Z"
                        fill="#CCCCCC"
                      />
                      <path
                        d="M342.028 489.142C342.028 489.142 358.708 540.062 344.661 538.306C330.615 536.55 324.469 494.41 324.469 494.41L342.028 489.142Z"
                        fill="#FFB8B8"
                      />
                      <path
                        d="M297.254 277.562C297.254 277.562 264.77 284.586 270.038 328.482C275.306 372.378 284.963 416.274 284.963 416.274L317.446 487.386L320.958 500.555L344.662 494.41L327.103 392.57C327.103 392.57 320.958 283.708 313.056 280.196C308.074 278.072 302.656 277.169 297.254 277.562Z"
                        fill="#CCCCCC"
                      />
                      <path
                        opacity="0.1"
                        d="M277.5 414.958L317.885 486.947L283.86 411.09L277.5 414.958Z"
                        fill="black"
                      />
                      <path
                        d="M332.646 204.566L332.768 201.746L338.378 203.142C338.318 202.237 338.062 201.355 337.628 200.558C337.194 199.761 336.592 199.068 335.864 198.527L341.84 198.193C336.826 191.067 330.419 185.032 323.007 180.451C315.595 175.87 307.332 172.839 298.716 171.541C285.79 169.668 271.397 172.379 262.534 181.972C258.234 186.625 255.533 192.542 253.611 198.579C250.072 209.697 249.351 222.951 256.731 231.988C264.232 241.173 277.333 242.972 289.137 244.109C293.29 244.509 297.643 244.881 301.491 243.27C301.92 238.855 301.355 234.401 299.838 230.233C299.206 228.943 298.904 227.516 298.959 226.081C299.483 222.569 304.168 221.684 307.686 222.159C311.205 222.633 315.436 223.359 317.748 220.664C319.341 218.808 319.247 216.105 319.458 213.669C320.033 207.035 332.586 205.956 332.646 204.566Z"
                        fill="#717171"
                      />
                      <path
                        d="M559 787.5C582.748 787.5 602 768.248 602 744.5C602 720.752 582.748 701.5 559 701.5C535.252 701.5 516 720.752 516 744.5C516 768.248 535.252 787.5 559 787.5Z"
                        fill="#809966"
                      />
                      <path
                        d="M54 772.5C77.7482 772.5 97 753.248 97 729.5C97 705.752 77.7482 686.5 54 686.5C30.2518 686.5 11 705.752 11 729.5C11 753.248 30.2518 772.5 54 772.5Z"
                        fill="#809966"
                      />
                      <path
                        d="M54 703.5C71.1208 703.5 85 689.621 85 672.5C85 655.379 71.1208 641.5 54 641.5C36.8792 641.5 23 655.379 23 672.5C23 689.621 36.8792 703.5 54 703.5Z"
                        fill="#809966"
                      />
                      <path
                        d="M54 646.5C66.1503 646.5 76 636.65 76 624.5C76 612.35 66.1503 602.5 54 602.5C41.8497 602.5 32 612.35 32 624.5C32 636.65 41.8497 646.5 54 646.5Z"
                        fill="#809966"
                      />
                    </g>
                    <defs>
                      <clipPath id="clip0_2004_70">
                        <rect width="797.5" height="834.5" fill="white" />
                      </clipPath>
                    </defs>
                  </svg>
                </div>
              )}
            </section>
          </TabsContent>
        );
      })}

      <BrowserWindow
        ref={browserWindowRef}
        onClose={() => {}}
        customActionButton={{
          text: 'Applied',
          onClick: () => markSelectedJobAsApplied(),
          tooltip: 'Mark this job as applied',
        }}
      ></BrowserWindow>
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
      ></BrowserWindow>
    </>
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

