import {
  ArchiveIcon,
  BackpackIcon,
  CheckIcon,
  CookieIcon,
  CopyIcon,
  FileTextIcon,
  HeartFilledIcon,
  InfoCircledIcon,
  ListBulletIcon,
  MinusCircledIcon,
  ResetIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import React, { useMemo } from 'react';

import { Icons } from '@/components/icons';
import { useLinks } from '@/hooks/links';
import { useSites } from '@/hooks/sites';
import { LABEL_COLOR_CLASSES } from '@/lib/labels';
import { JOB_LABELS, Job, JobLabel, JobStatus } from '@first2apply/core';
import { Avatar, AvatarImage } from '@first2apply/ui';
import { Button } from '@first2apply/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@first2apply/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@first2apply/ui';
import { toast } from '@first2apply/ui';

import { DeleteJobDialog } from './deleteJobDialog';

function isJobLabel(value: JobLabel): value is JobLabel {
  return Object.values(JOB_LABELS).includes(value);
}

/**
 * Job summary component.
 */
export function JobSummary({
  job,
  onView,
  onUpdateJobStatus,
  onUpdateLabels,
  onOpenUrl,
  isFavoriteCompany = false,
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
  isBlacklistedCompany?: boolean;
  onToggleFavorite?: (companyName?: string | null) => void | Promise<void>;
  onToggleBlacklist?: (companyName?: string | null) => void | Promise<void>;
  favoriteActionPending?: boolean;
  blacklistActionPending?: boolean;
  isCompanyPreferencesLoaded?: boolean;
}) {
  const { siteLogos } = useSites();
  const { links } = useLinks();

  const usedLink = useMemo(() => {
    return links.find((l) => l.id === job.link_id);
  }, [links, job.link_id]);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 p-6 shadow-sm lg:p-8">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          {/* search site */}
          {usedLink && (
            <a
              className="mb-4 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground/80 transition-colors hover:text-foreground"
              href="#"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onOpenUrl(usedLink.url);
              }}
            >
              <img src={siteLogos[usedLink.site_id]} alt={usedLink.title} className="h-4 w-4" />
              <span>via {usedLink.title}</span>
            </a>
          )}

          {/* Job title */}
          <h1 className="mb-3 text-2xl font-semibold leading-tight tracking-tight text-foreground lg:text-3xl">
            {job.title}
          </h1>

          {/* Company name & location */}
          <div className="mb-6 flex items-center gap-2">
            <p className="text-base font-medium text-foreground/90">
              {job.companyName}
            </p>
            {isFavoriteCompany && (
              <HeartFilledIcon className="h-4 w-4 text-rose-500" />
            )}
            {job.location && (
              <span className="text-base text-muted-foreground/80">
                · {job.location}
              </span>
            )}
          </div>

          {/* Job details */}
          <div className="space-y-2.5">
            {job.jobType && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground/80">
                <BackpackIcon className="h-4 w-4 flex-shrink-0" />
                <span className="capitalize">{job.jobType}</span>
              </div>
            )}
            {job.salary && (
              <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground/90">
                <CookieIcon className="h-4 w-4 flex-shrink-0" />
                <span>{job.salary}</span>
              </div>
            )}
            {job.tags.length > 0 && (
              <div className="flex items-start gap-3 text-sm text-muted-foreground/80">
                <ListBulletIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="flex-1">{job.tags?.slice(0, 5).join(', ')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Company logo */}
        {job.companyLogo && (
          <Avatar className="h-20 w-20 flex-shrink-0 ring-2 ring-border/30 lg:h-24 lg:w-24">
            <AvatarImage src={job.companyLogo} />
          </Avatar>
        )}
      </div>

      {/* Filtered out job explainer */}
      {job.status === 'excluded_by_advanced_matching' && job.exclude_reason && (
        <div className="mt-6 rounded-xl bg-destructive/10 border border-destructive/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <InfoCircledIcon className="h-4 w-4 text-destructive" />
            <p className="text-sm font-semibold text-foreground">Why was this job excluded?</p>
          </div>
          <p className="text-sm text-muted-foreground/90">{job.exclude_reason}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className={`mt-8 flex flex-wrap items-center gap-2 ${job.status !== 'excluded_by_advanced_matching' && 'lg:mt-10'}`}>
        {/* Open button */}
        <Button
          size="lg"
          className="h-10 rounded-xl px-6 text-sm font-medium shadow-sm transition-all duration-200 hover:shadow-md"
          onClick={() => {
            onView(job);
          }}
        >
          Open
        </Button>

        {/* Apply button */}
        {job.status !== 'applied' && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 rounded-xl transition-all duration-200 hover:bg-muted"
                  onClick={() => onUpdateJobStatus(job.id, 'applied')}
                >
                  <CheckIcon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-sm">
                Mark job as Applied
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Back to new button */}
        {job.status !== 'new' && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 rounded-xl transition-all duration-200 hover:bg-muted"
                  onClick={() => onUpdateJobStatus(job.id, 'new')}
                >
                  <ResetIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-sm">
                Move job back to New
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Archive button */}
        {job.status !== 'archived' && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 rounded-xl transition-all duration-200 hover:bg-muted"
                  onClick={() => onUpdateJobStatus(job.id, 'archived')}
                >
                  <ArchiveIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-sm">
                Archive
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Copy url button */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-xl transition-all duration-200 hover:bg-muted"
                onClick={(evt) => {
                  evt.stopPropagation();
                  navigator.clipboard.writeText(job.externalUrl);
                  toast({
                    title: 'Job URL copied to clipboard',
                    description: 'You can now paste it anywhere.',
                    variant: 'success',
                  });
                }}
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-sm">
              Copy URL
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Copy job details button */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-xl transition-all duration-200 hover:bg-muted"
                onClick={(evt) => {
                  evt.stopPropagation();
                  const jobDetails = [
                    `Title: ${job.title}`,
                    `Company: ${job.companyName}`,
                    job.location ? `Location: ${job.location}` : null,
                    job.description ? `\nJob Description:\n${job.description}` : null,
                  ]
                    .filter(Boolean)
                    .join('\n');
                  
                  navigator.clipboard.writeText(jobDetails);
                  toast({
                    title: 'Job details copied to clipboard',
                    description: 'Title, company, location, and description have been copied.',
                    variant: 'success',
                  });
                }}
              >
                <FileTextIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-sm">
              Copy Job Details
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Delete button */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-xl transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-sm">
              Delete
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Favorite company button */}
        {onToggleFavorite && job.companyName && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={`h-10 w-10 rounded-xl transition-all duration-200 ${
                    isFavoriteCompany
                      ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'
                      : 'hover:bg-muted'
                  }`}
                  disabled={!isCompanyPreferencesLoaded || favoriteActionPending}
                  onClick={() => onToggleFavorite(job.companyName)}
                >
                  {favoriteActionPending ? (
                    <Icons.spinner2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <HeartFilledIcon className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-sm">
                {isFavoriteCompany ? 'Remove from favorites' : 'Add to favorites'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Block company button */}
        {onToggleBlacklist && job.companyName && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={`h-10 w-10 rounded-xl transition-all duration-200 ${
                    isBlacklistedCompany
                      ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                      : 'hover:bg-muted'
                  }`}
                  disabled={!isCompanyPreferencesLoaded || blacklistActionPending}
                  onClick={() => onToggleBlacklist(job.companyName)}
                >
                  {blacklistActionPending ? (
                    <Icons.spinner2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <MinusCircledIcon className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-sm">
                {isBlacklistedCompany ? 'Remove from blacklist' : 'Block company'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <DeleteJobDialog
          isOpen={isDeleteDialogOpen}
          job={job}
          onClose={() => setIsDeleteDialogOpen(false)}
          onDelete={() => onUpdateJobStatus(job.id, 'deleted')}
        />

        {/* Label selector */}
        <div className="ml-auto">
          <JobLabelSelector job={job} onUpdateLabels={onUpdateLabels} />
        </div>
      </div>
    </div>
  );
}

/**
 * Label selector component. For now we only allow setting one label per job.
 */
function JobLabelSelector({
  job,
  onUpdateLabels,
}: {
  job: Job;
  onUpdateLabels: (jobId: number, labels: JobLabel[]) => void;
}) {
  const label = job.labels[0] ?? '';

  const LabelOptionWithColor = ({ jobLabel, colorClass }: { jobLabel: string; colorClass: string }) => (
    <SelectItem value={jobLabel}>
      <div className="flex items-center">
        <div className={`h-3 w-3 rounded-full ${colorClass}`}></div>
        <div className="ml-2 flex-1">{jobLabel}</div>
      </div>
    </SelectItem>
  );

  return (
    <Select
      value={label}
      onValueChange={(labelValue: JobLabel) => {
        const newLabels = isJobLabel(labelValue) ? [labelValue] : [];
        onUpdateLabels(job.id, newLabels);
      }}
    >
      <SelectTrigger className="h-10 w-[148px] rounded-xl border-border/50">
        <SelectValue placeholder="Add Label" />
      </SelectTrigger>
      <SelectContent>
        {/* no label */}
        <LabelOptionWithColor jobLabel="None" colorClass="bg-background" />

        {/* labels with colors */}
        {Object.values(JOB_LABELS).map((jobLabel) => (
          <LabelOptionWithColor key={jobLabel} jobLabel={jobLabel} colorClass={LABEL_COLOR_CLASSES[jobLabel]} />
        ))}
      </SelectContent>
    </Select>
  );
}
