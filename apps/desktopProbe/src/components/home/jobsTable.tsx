import { Fragment } from 'react';
import {
  ArchiveIcon,
  CheckIcon,
  EyeOpenIcon,
  HeartFilledIcon,
  TrashIcon,
} from '@radix-ui/react-icons';

import {
  CompactDataTable,
  CompactDataTableHead,
  CompactSectionRow,
  CompactTd,
  CompactTh,
} from '@/components/compact/compactDataTable';
import { formatShortPostedWithFallback, formatShortRelativeTime } from '@/lib/jobDisplayUtils';
import { cn } from '@/lib/utils';
import { Job, Link } from '@first2apply/core';
import { Button } from '@first2apply/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@first2apply/ui';

import { JobLogos } from './jobLogos';

type SiteMap = Record<number, { name?: string } | undefined>;

export type JobsDateGroup = {
  dateKey: string;
  label: string;
  jobs: Job[];
  totalCount: number;
  hasMore: boolean;
  isLoading: boolean;
};

function siteCode(siteMap: SiteMap, siteId: number) {
  return (siteMap[siteId]?.name ?? 'JB').slice(0, 2).toUpperCase();
}

function JobRow({
  job,
  selected,
  siteLogos,
  siteMap,
  linksMap,
  isFavoriteCompany,
  isWatchedCompany,
  onSelect,
  onApplied,
  onArchive,
  onRequestDelete,
  showAppliedAction,
}: {
  job: Job;
  selected: boolean;
  siteLogos: Record<number, string>;
  siteMap: SiteMap;
  linksMap: Map<number, Link>;
  isFavoriteCompany: (companyName?: string | null) => boolean;
  isWatchedCompany: (companyName?: string | null) => boolean;
  onSelect: (job: Job) => void;
  onApplied?: (job: Job) => void;
  onArchive: (job: Job) => void;
  onRequestDelete: (job: Job) => void;
  showAppliedAction?: boolean;
}) {
  const fromLink = linksMap.get(job.link_id)?.title;
  const favorite = isFavoriteCompany(job.companyName);
  const watched = isWatchedCompany(job.companyName);

  return (
    <tr
      data-testid={`job-row-${job.id}`}
      data-job-row-id={job.id}
      className={cn(
        'cursor-pointer border-l-2 border-transparent hover:bg-muted/40',
        selected && 'border-l-primary bg-primary/10',
      )}
      onClick={() => onSelect(job)}
    >
      <CompactTd className="w-[38px]">
        <JobLogos
          companyName={job.companyName}
          companyLogo={job.companyLogo}
          siteLogo={siteLogos[job.siteId]}
          siteCode={siteCode(siteMap, job.siteId)}
        />
      </CompactTd>
      <CompactTd>
        <div data-testid="job-row">
          <div className="truncate text-xs font-semibold leading-tight text-foreground">{job.title}</div>
          <div
            className={cn(
              'truncate text-[10px] leading-tight',
              favorite && 'font-semibold text-rose-500',
              !favorite && watched && 'font-semibold text-blue-500',
              !favorite && !watched && 'text-muted-foreground',
            )}
          >
            {job.companyName}
          </div>
        </div>
      </CompactTd>
      <CompactTd className="text-[10px] text-muted-foreground">{job.location || '-'}</CompactTd>
      <CompactTd className="text-[10px] text-muted-foreground">
        {formatShortRelativeTime(new Date(job.created_at))}
      </CompactTd>
      <CompactTd
        className="text-[10px] text-muted-foreground"
        title={
          job.posted_at_raw
            ? `Posted ${job.posted_at_raw}`
            : 'Exact posted date was not captured; showing the oldest confirmed age from when this job was found.'
        }
      >
        {formatShortPostedWithFallback(job.posted_at_raw, job.created_at)}
      </CompactTd>
      <CompactTd>
        <div className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
          {siteLogos[job.siteId] ? (
            <span className="grid h-4 w-4 shrink-0 place-items-center overflow-hidden rounded border border-border bg-background p-[1px]">
              <img src={siteLogos[job.siteId]} alt="" className="h-full w-full object-contain" />
            </span>
          ) : (
            <span className="shrink-0 rounded-[3px] border border-border bg-muted px-1 text-[8px] font-extrabold text-primary">
              {siteCode(siteMap, job.siteId)}
            </span>
          )}
          <span className="truncate">{fromLink ?? siteMap[job.siteId]?.name ?? 'Search'}</span>
        </div>
      </CompactTd>
      <CompactTd className="text-center">
        {favorite ? (
          <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded bg-rose-500/10 text-rose-500">
            <HeartFilledIcon className="h-3 w-3" />
          </span>
        ) : watched ? (
          <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded bg-blue-500/10 text-blue-500">
            <EyeOpenIcon className="h-3 w-3" />
          </span>
        ) : null}
      </CompactTd>
      <CompactTd>
        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          {showAppliedAction && job.status !== 'applied' && onApplied && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-[22px] w-[22px] rounded border border-border bg-card p-0 text-muted-foreground hover:border-primary hover:text-primary"
                    onClick={() => onApplied(job)}
                    aria-label="Mark applied"
                  >
                    <CheckIcon className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Applied</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {job.status !== 'archived' && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-[22px] w-[22px] rounded border border-border bg-card p-0 text-muted-foreground hover:border-primary hover:text-primary"
                    onClick={() => onArchive(job)}
                    aria-label="Archive job"
                  >
                    <ArchiveIcon className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Archive</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-[22px] w-[22px] rounded border border-border bg-card p-0 text-destructive hover:text-destructive"
                  onClick={() => onRequestDelete(job)}
                  aria-label="Delete job"
                >
                  <TrashIcon className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CompactTd>
    </tr>
  );
}

/** Single unified jobs table with sticky header and date section rows. */
export function JobsBoardTable({
  dateGroups,
  selectedJobId,
  onSelect,
  onApplied,
  onArchive,
  onRequestDelete,
  siteLogos,
  siteMap,
  linksMap,
  isFavoriteCompany,
  isWatchedCompany,
  showAppliedAction,
}: {
  dateGroups: JobsDateGroup[];
  selectedJobId?: number | null;
  onSelect: (job: Job) => void;
  onApplied?: (job: Job) => void;
  onArchive: (job: Job) => void;
  onRequestDelete: (job: Job) => void;
  siteLogos: Record<number, string>;
  siteMap: SiteMap;
  linksMap: Map<number, Link>;
  isFavoriteCompany: (companyName?: string | null) => boolean;
  isWatchedCompany: (companyName?: string | null) => boolean;
  showAppliedAction?: boolean;
}) {
  return (
    <CompactDataTable className="mb-0 border-0 shadow-none" data-testid="jobs-table">
      <CompactDataTableHead sticky>
        <CompactTh className="w-10" />
        <CompactTh className="min-w-[180px]">Job / company</CompactTh>
        <CompactTh className="w-24">Location</CompactTh>
        <CompactTh className="w-14">Found</CompactTh>
        <CompactTh className="w-14">Posted</CompactTh>
        <CompactTh className="min-w-[120px]">Search</CompactTh>
        <CompactTh className="w-8" />
        <CompactTh className="w-[88px]" />
      </CompactDataTableHead>
      <tbody>
        {dateGroups.map((group) => (
          <Fragment key={group.dateKey}>
            <CompactSectionRow colSpan={8} sticky id={`date-section-${group.dateKey}`}>
              {group.label} · {group.totalCount} {group.totalCount === 1 ? 'job' : 'jobs'}
            </CompactSectionRow>
            {group.jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                selected={selectedJobId === job.id}
                siteLogos={siteLogos}
                siteMap={siteMap}
                linksMap={linksMap}
                isFavoriteCompany={isFavoriteCompany}
                isWatchedCompany={isWatchedCompany}
                onSelect={onSelect}
                onApplied={onApplied}
                onArchive={onArchive}
                onRequestDelete={onRequestDelete}
                showAppliedAction={showAppliedAction}
              />
            ))}
          </Fragment>
        ))}
      </tbody>
    </CompactDataTable>
  );
}

/** @deprecated Use JobsBoardTable — kept for tests */
export function JobsTable({
  label,
  totalCount,
  jobs,
  ...rest
}: {
  label: string;
  totalCount: number;
  jobs: Job[];
  selectedJobId?: number | null;
  onSelect: (job: Job) => void;
  onArchive: (job: Job) => void;
  onRequestDelete: (job: Job) => void;
  siteLogos: Record<number, string>;
  siteMap: SiteMap;
  linksMap: Map<number, Link>;
  isFavoriteCompany: (companyName?: string | null) => boolean;
  isWatchedCompany: (companyName?: string | null) => boolean;
}) {
  return (
    <JobsBoardTable
      dateGroups={[{ dateKey: 'today', label, jobs, totalCount, hasMore: false, isLoading: false }]}
      {...rest}
    />
  );
}
