import { CopyIcon, Pencil1Icon, QuestionMarkCircledIcon, TrashIcon } from '@radix-ui/react-icons';
import { useMemo, useState } from 'react';
import ReactTimeAgo from 'react-time-ago';

import { useSites } from '@/hooks/sites';
import { Link } from '@first2apply/core';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@first2apply/ui';
import { Button } from '@first2apply/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@first2apply/ui';
import { CompactDataTable, CompactDataTableHead, CompactTd, CompactTh } from '@/components/compact/compactDataTable';

import { EditLink } from './editLink';

const scrapeFailureThreshold = 3;

export function LinksList({
  links,
  onDeleteLink,
  onDebugLink,
  onUpdateLink,
}: {
  links: Link[];
  onDeleteLink: (linkId: number) => void;
  onDebugLink: (linkId: number) => void;
  onUpdateLink: (data: { linkId: number; title: string; url: string }) => Promise<void>;
}) {
  const { siteLogos, sites } = useSites();
  const sitesMap = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  const [editedLink, setEditedLink] = useState<Link | null>(null);

  const isInFailureState = (link: Link) => link.scrape_failure_count >= scrapeFailureThreshold;

  return (
    <>
      <CompactDataTable>
        <CompactDataTableHead>
          <CompactTh>Board</CompactTh>
          <CompactTh>Search title</CompactTh>
          <CompactTh className="whitespace-nowrap">Checked</CompactTh>
          <CompactTh className="whitespace-nowrap">Added</CompactTh>
          <CompactTh className="whitespace-nowrap">Jobs</CompactTh>
          <CompactTh className="whitespace-nowrap">Status</CompactTh>
          <CompactTh className="w-[124px] text-right">Actions</CompactTh>
        </CompactDataTableHead>
        <tbody>
        {links.map((link) => {
          const isFailure = isInFailureState(link);
          return (
            <tr
              key={link.id}
              className={cn(
                'group cursor-pointer transition-colors hover:bg-muted/30',
                isFailure ? 'bg-destructive/5 hover:bg-destructive/10' : ''
              )}
              onClick={() => {
                onDebugLink(link.id);
              }}
            >
              <CompactTd>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6 shrink-0 rounded">
                  <AvatarImage src={siteLogos[link.site_id]} />
                    <AvatarFallback className="rounded text-[10px]">LI</AvatarFallback>
                </Avatar>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {sitesMap.get(link.site_id)?.name}
                  </span>
                </div>
              </CompactTd>
              <CompactTd className="max-w-[340px]">
                <span className="line-clamp-2 text-xs font-medium leading-tight text-foreground">{link.title}</span>
              </CompactTd>
              <CompactTd className="whitespace-nowrap text-[10px] text-muted-foreground">
                <ReactTimeAgo date={new Date(link.last_scraped_at)} locale="en-US" />
              </CompactTd>
              <CompactTd className="whitespace-nowrap text-[10px] text-muted-foreground">
                <ReactTimeAgo date={new Date(link.created_at)} locale="en-US" />
              </CompactTd>
              <CompactTd className="whitespace-nowrap text-[11px] text-muted-foreground">—</CompactTd>
              <CompactTd className="whitespace-nowrap">
                <span className={cn('text-[11px] font-medium', isFailure ? 'text-destructive' : 'text-foreground')}>
                  {isFailure ? 'Needs attention' : 'OK'}
                </span>
              </CompactTd>
              <CompactTd>
                <div className="flex items-center justify-end gap-0.5">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'h-6 w-6 text-muted-foreground hover:text-foreground',
                            isFailure ? 'text-destructive hover:bg-destructive/10 hover:text-destructive' : ''
                          )}
                          onClick={(evt) => {
                            evt.stopPropagation();
                            onDebugLink(link.id);
                          }}
                        >
                          <QuestionMarkCircledIcon className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{isFailure ? 'Troubleshoot' : 'Test'}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={(evt) => {
                            evt.stopPropagation();
                            setEditedLink(link);
                          }}
                        >
                          <Pencil1Icon className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={(evt) => {
                            evt.stopPropagation();
                            navigator.clipboard.writeText(link.url);
                          }}
                        >
                          <CopyIcon className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy URL</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={(evt) => {
                            evt.stopPropagation();
                            onDeleteLink(link.id);
                          }}
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CompactTd>
            </tr>
          );
        })}
        </tbody>
      </CompactDataTable>
      <EditLink
        isOpen={!!editedLink}
        link={editedLink}
        onUpdateLink={async (data) => {
          if (!editedLink) {
            return;
          }

          await onUpdateLink({ linkId: editedLink.id, title: data.title, url: data.url });
          setEditedLink(null);
        }}
        onCancel={() => {
          setEditedLink(null);
        }}
      />
    </>
  );
}
