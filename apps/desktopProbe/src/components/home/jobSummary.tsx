import {
  ArchiveIcon,
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  HeartFilledIcon,
  InfoCircledIcon,
  MinusCircledIcon,
  ResetIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import React, { useMemo } from 'react';

import { Icons } from '@/components/icons';
import { useLinks } from '@/hooks/links';
import { useSites } from '@/hooks/sites';
import { formatShortPostedWithFallback, formatShortRelativeTime } from '@/lib/jobDisplayUtils';
import { LABEL_COLOR_CLASSES } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { JOB_LABELS, Job, JobLabel, JobStatus } from '@first2apply/core';
import { Button } from '@first2apply/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@first2apply/ui';
import { toast } from '@first2apply/ui';

import { DetailIconButton } from './detailIconButton';
import { DeleteJobDialog } from './deleteJobDialog';
import { JobLogos } from './jobLogos';

function isJobLabel(value: JobLabel): value is JobLabel {
  return Object.values(JOB_LABELS).includes(value);
}

function siteCode(siteName?: string) {
  return (siteName ?? 'JB').slice(0, 2).toUpperCase();
}

export function JobSummary({
  job,
  onView,
  onUpdateJobStatus,
  onUpdateLabels,
  onOpenUrl,
  isFavoriteCompany = false,
  isWatchedCompany = false,
  isBlacklistedCompany = false,
  onToggleFavorite,
  onToggleBlacklist,
  favoriteActionPending = false,
  blacklistActionPending = false,
  isCompanyPreferencesLoaded = false,
}: {
  job: Job;
  onView: (job: Job) => void;
  onUpdateJobStatus: (jobId: number, status: JobStatus) => void;
  onUpdateLabels: (jobId: number, labels: JobLabel[]) => void;
  onOpenUrl: (url: string) => void;
  isFavoriteCompany?: boolean;
  isWatchedCompany?: boolean;
  isBlacklistedCompany?: boolean;
  onToggleFavorite?: (companyName?: string | null) => void | Promise<void>;
  onToggleBlacklist?: (companyName?: string | null) => void | Promise<void>;
  favoriteActionPending?: boolean;
  blacklistActionPending?: boolean;
  isCompanyPreferencesLoaded?: boolean;
}) {
  const { siteLogos, siteMap } = useSites();
  const { links } = useLinks();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const usedLink = useMemo(() => links.find((l) => l.id === job.link_id), [links, job.link_id]);
  const boardName = siteMap[job.siteId]?.name ?? 'Job board';
  const postedText = formatShortPostedWithFallback(job.posted_at_raw, job.created_at);

  return (
    <div className="shrink-0 border-b border-border">
      <div className="flex gap-2 px-2.5 py-2">
        <JobLogos
          size="md"
          companyName={job.companyName}
          companyLogo={job.companyLogo}
          siteLogo={siteLogos[job.siteId]}
          siteCode={siteCode(siteMap[job.siteId]?.name)}
        />
        <div className="min-w-0 flex-1">
          <h2 className="mb-1 text-[15px] font-semibold leading-tight text-foreground">{job.title}</h2>
          <div className="mb-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
            <span
              className={cn(
                'truncate font-medium',
                isFavoriteCompany && 'text-rose-500',
                !isFavoriteCompany && isWatchedCompany && 'text-blue-500',
                !isFavoriteCompany && !isWatchedCompany && 'text-foreground',
              )}
            >
              {job.companyName}
            </span>
            <span className="truncate">{job.location || '—'}</span>
            <span>
              found <strong className="text-foreground">{formatShortRelativeTime(new Date(job.created_at))}</strong>
            </span>
            <span>
              posted
              <strong
                className="ml-1 text-foreground"
                title={
                  job.posted_at_raw
                    ? `Posted ${job.posted_at_raw}`
                    : 'Exact posted date was not captured; showing the oldest confirmed age from when this job was found.'
                }
              >
                {postedText}
              </strong>
            </span>
          </div>
          {usedLink && (
            <button
              type="button"
              className="flex min-w-0 items-center gap-1 text-left text-[10px] text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.preventDefault();
                onOpenUrl(usedLink.url);
              }}
            >
              <span className="rounded-[3px] border border-border bg-muted px-1 text-[8px] font-extrabold text-primary">
                {siteCode(siteMap[job.siteId]?.name)}
              </span>
              <span className="truncate">
                {usedLink.title} · {boardName}
              </span>
            </button>
          )}
        </div>
      </div>

      {job.status === 'excluded_by_advanced_matching' && job.exclude_reason && (
        <div className="mx-2.5 mb-2 rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1.5 text-[11px] text-muted-foreground">
          <div className="mb-0.5 flex items-center gap-1 font-semibold text-foreground">
            <InfoCircledIcon className="h-3.5 w-3.5 text-destructive" />
            Why excluded
          </div>
          {job.exclude_reason}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-0.5 border-t border-border px-2.5 py-1.5">
        <Button size="sm" className="h-7 rounded-md px-3 text-xs font-semibold" onClick={() => onView(job)}>
          Open
        </Button>

        {job.status !== 'applied' && (
          <DetailIconButton title="Applied" onClick={() => onUpdateJobStatus(job.id, 'applied')}>
            <CheckIcon className="h-3.5 w-3.5" />
          </DetailIconButton>
        )}

        {job.status !== 'new' && (
          <DetailIconButton title="Move to New" onClick={() => onUpdateJobStatus(job.id, 'new')}>
            <ResetIcon className="h-3.5 w-3.5" />
          </DetailIconButton>
        )}

        {job.status !== 'archived' && (
          <DetailIconButton title="Archive" onClick={() => onUpdateJobStatus(job.id, 'archived')}>
            <ArchiveIcon className="h-3.5 w-3.5" />
          </DetailIconButton>
        )}

        <DetailIconButton
          title="Copy URL"
          onClick={() => {
            navigator.clipboard.writeText(job.externalUrl);
            toast({ title: 'Job URL copied', variant: 'success' });
          }}
        >
          <CopyIcon className="h-3.5 w-3.5" />
        </DetailIconButton>

        <DetailIconButton
          title="Copy details"
          onClick={() => {
            const jobDetails = [
              `Title: ${job.title}`,
              `Company: ${job.companyName}`,
              job.location ? `Location: ${job.location}` : null,
              job.description ? `\nJob Description:\n${job.description}` : null,
            ]
              .filter(Boolean)
              .join('\n');
            navigator.clipboard.writeText(jobDetails);
            toast({ title: 'Job details copied', variant: 'success' });
          }}
        >
          <FileTextIcon className="h-3.5 w-3.5" />
        </DetailIconButton>

        <DetailIconButton title="Delete" destructive onClick={() => setIsDeleteDialogOpen(true)}>
          <TrashIcon className="h-3.5 w-3.5" />
        </DetailIconButton>

        {onToggleFavorite && job.companyName && (
          <DetailIconButton
            title={isFavoriteCompany ? 'Remove favorite' : isWatchedCompany ? 'Promote to favorite' : 'Watch company'}
            active={isFavoriteCompany}
            disabled={!isCompanyPreferencesLoaded || favoriteActionPending}
            onClick={() => onToggleFavorite(job.companyName)}
          >
            {favoriteActionPending ? (
              <Icons.spinner2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <HeartFilledIcon className={cn('h-3.5 w-3.5', isWatchedCompany && !isFavoriteCompany && 'text-blue-500')} />
            )}
          </DetailIconButton>
        )}

        {onToggleBlacklist && job.companyName && (
          <DetailIconButton
            title={isBlacklistedCompany ? 'Unblock company' : 'Block company'}
            destructive={isBlacklistedCompany}
            disabled={!isCompanyPreferencesLoaded || blacklistActionPending}
            onClick={() => onToggleBlacklist(job.companyName)}
          >
            {blacklistActionPending ? (
              <Icons.spinner2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <MinusCircledIcon className="h-3.5 w-3.5" />
            )}
          </DetailIconButton>
        )}

        <div className="ml-auto">
          <JobLabelSelector job={job} onUpdateLabels={onUpdateLabels} />
        </div>
      </div>

      <DeleteJobDialog
        isOpen={isDeleteDialogOpen}
        job={job}
        onClose={() => setIsDeleteDialogOpen(false)}
        onDelete={() => onUpdateJobStatus(job.id, 'deleted')}
      />
    </div>
  );
}

function JobLabelSelector({
  job,
  onUpdateLabels,
}: {
  job: Job;
  onUpdateLabels: (jobId: number, labels: JobLabel[]) => void;
}) {
  const label = job.labels[0] ?? '';

  return (
    <Select
      value={label}
      onValueChange={(labelValue: JobLabel) => {
        onUpdateLabels(job.id, isJobLabel(labelValue) ? [labelValue] : []);
      }}
    >
      <SelectTrigger className="h-7 w-[110px] rounded-md border-border text-[11px]">
        <SelectValue placeholder="Label…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="None">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-background ring-1 ring-border" />
            None
          </div>
        </SelectItem>
        {Object.values(JOB_LABELS).map((jobLabel) => (
          <SelectItem key={jobLabel} value={jobLabel}>
            <div className="flex items-center gap-2">
              <div className={cn('h-2.5 w-2.5 rounded-full', LABEL_COLOR_CLASSES[jobLabel])} />
              {jobLabel}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
