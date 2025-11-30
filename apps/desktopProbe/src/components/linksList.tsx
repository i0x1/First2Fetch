import { CopyIcon, Pencil1Icon, QuestionMarkCircledIcon, TrashIcon } from '@radix-ui/react-icons';
import { useMemo, useState } from 'react';
import ReactTimeAgo from 'react-time-ago';

import { useSites } from '@/hooks/sites';
import { Link } from '@first2apply/core';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@first2apply/ui';
import { Button } from '@first2apply/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@first2apply/ui';

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
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {links.map((link) => {
          return (
            <li
              key={link.id}
              className={cn(
                "group relative flex flex-col justify-between gap-4 rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md cursor-pointer",
                isInFailureState(link) ? "border-destructive/50 bg-destructive/5" : "hover:border-primary/20"
              )}
              onClick={() => {
                onDebugLink(link.id);
              }}
            >
              <div className="flex items-start gap-3">
                <Avatar
                  className="h-10 w-10 shrink-0 rounded-lg"
                >
                  <AvatarImage src={siteLogos[link.site_id]} />
                  <AvatarFallback className="text-sm rounded-lg">LI</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {sitesMap.get(link.site_id)?.name}
                  </p>
                  <p className="text-base font-medium leading-tight text-foreground line-clamp-2">
                    {link.title}
                  </p>
                </div>
              </div>

              <div className="flex items-end justify-between pt-2">
                <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Checked <ReactTimeAgo date={new Date(link.last_scraped_at)} locale="en-US" />
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Added <ReactTimeAgo date={new Date(link.created_at)} locale="en-US" />
                    </p>
                </div>

                {/* actions */}
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  {isInFailureState(link) && (
                    <TooltipProvider delayDuration={200}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={(evt) => {
                                    evt.stopPropagation();
                                    onDebugLink(link.id);
                                }}
                                >
                                <QuestionMarkCircledIcon className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Troubleshoot</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                  )}

                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={(evt) => {
                            evt.stopPropagation();
                            navigator.clipboard.writeText(link.url);
                          }}
                        >
                          <CopyIcon className="h-4 w-4" />
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
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={(evt) => {
                            evt.stopPropagation();
                            setEditedLink(link);
                          }}
                        >
                          <Pencil1Icon className="h-4 w-4" />
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
                          className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={(evt) => {
                            evt.stopPropagation();
                            onDeleteLink(link.id);
                          }}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
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
