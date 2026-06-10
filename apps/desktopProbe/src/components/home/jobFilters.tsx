import { useEffect, useMemo, useRef, useState } from 'react';

import { debounce } from 'lodash';
import { JobStatus } from '@first2apply/core';

import { JobStatusSeg } from './jobStatusSeg';
import { JobViewMode, JobViewModeSeg } from './jobViewModeSeg';
import { JobFilterChips } from './jobFilters/jobFilterChips';
import { JobFiltersMenu, JobFiltersType } from './jobFilters/jobFiltersMenu';
import { SearchBox } from './jobFilters/searchBox';

function filtersEqual(a: JobFiltersType, b: JobFiltersType) {
  return (
    a.hideReposted === b.hideReposted &&
    a.sites.length === b.sites.length &&
    a.links.length === b.links.length &&
    a.labels.length === b.labels.length &&
    a.sites.every((id, index) => id === b.sites[index]) &&
    a.links.every((id, index) => id === b.links[index]) &&
    a.labels.every((label, index) => label === b.labels[index])
  );
}

export function JobFilters({
  search,
  siteIds,
  linkIds,
  labels,
  hideReposted,
  status,
  listingCounts,
  onStatusChange,
  onSearchJobs,
  viewMode,
  onViewModeChange,
}: {
  search: string;
  siteIds: number[];
  linkIds: number[];
  labels: string[];
  hideReposted: boolean;
  status: JobStatus;
  listingCounts: { new: number; applied: number; archived: number; filtered: number };
  onStatusChange: (status: JobStatus) => void;
  onSearchJobs: (_: { search: string; filters: JobFiltersType }) => void;
  viewMode: JobViewMode;
  onViewModeChange: (mode: JobViewMode) => void;
}) {
  const [inputValue, setInputValue] = useState(search);
  const [filters, setFilters] = useState<JobFiltersType>({
    sites: siteIds ?? [],
    links: linkIds ?? [],
    labels: labels ?? [],
    hideReposted: hideReposted || false,
  });

  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const onSearchJobsRef = useRef(onSearchJobs);
  onSearchJobsRef.current = onSearchJobs;
  const didMountRef = useRef(false);

  useEffect(() => {
    setInputValue(search);
  }, [search]);

  useEffect(() => {
    const nextFilters = {
      sites: siteIds ?? [],
      links: linkIds ?? [],
      labels: labels ?? [],
      hideReposted: hideReposted || false,
    };
    setFilters((prev) => (filtersEqual(prev, nextFilters) ? prev : nextFilters));
  }, [siteIds, linkIds, labels, hideReposted]);

  const emitDebouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        onSearchJobsRef.current({ search: value, filters: filtersRef.current });
      }, 350),
    [],
  );

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    emitDebouncedSearch(inputValue);
    return () => emitDebouncedSearch.cancel();
  }, [inputValue, emitDebouncedSearch]);

  useEffect(() => {
    return () => emitDebouncedSearch.cancel();
  }, [emitDebouncedSearch]);

  const applyFilters = (nextFilters: JobFiltersType) => {
    setFilters(nextFilters);
    onSearchJobs({ search: inputValue, filters: nextFilters });
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        <div className="min-w-[180px] flex-1">
          <SearchBox inputValue={inputValue} setInputValue={setInputValue} />
        </div>
        <JobStatusSeg status={status} counts={listingCounts} onChange={onStatusChange} />
        <JobViewModeSeg viewMode={viewMode} onChange={onViewModeChange} />
        <JobFiltersMenu
          selectedSites={siteIds || []}
          selectedLinks={linkIds || []}
          selectedLabels={labels || []}
          hideReposted={hideReposted}
          onApplyFilters={applyFilters}
        />
      </div>
      <JobFilterChips
        siteIds={siteIds}
        linkIds={linkIds}
        labels={labels}
        hideReposted={hideReposted}
        onApplyFilters={applyFilters}
      />
    </div>
  );
}
