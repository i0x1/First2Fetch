import { getCompanyInitials } from '@/lib/jobDisplayUtils';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@first2apply/ui';

/** Company logo + job-board source badge, matching the mock table layout. */
export function JobLogos({
  companyName,
  companyLogo,
  siteLogo,
  siteCode,
  size = 'sm',
}: {
  companyName?: string | null;
  companyLogo?: string | null;
  siteLogo?: string;
  siteCode?: string;
  size?: 'sm' | 'md';
}) {
  const isSm = size === 'sm';

  return (
    <div className={cn('relative shrink-0', isSm ? 'h-[30px] w-[30px]' : 'h-9 w-9')}>
      <div
        className={cn(
          'overflow-hidden rounded-md border border-border bg-muted/30',
          isSm ? 'h-[26px] w-[26px]' : 'h-8 w-8',
        )}
      >
        {companyLogo ? (
          <Avatar className="h-full w-full rounded-md">
            <AvatarImage src={companyLogo} alt={companyName ?? 'Company'} className="object-cover" />
            <AvatarFallback className="rounded-md text-[9px] font-bold">{getCompanyInitials(companyName)}</AvatarFallback>
          </Avatar>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[9px] font-bold text-foreground">
            {getCompanyInitials(companyName)}
          </div>
        )}
      </div>
      <div
        className={cn(
          'absolute bottom-0 right-0 overflow-hidden rounded border border-border bg-background',
          isSm ? 'h-3 w-3' : 'h-3.5 w-3.5',
        )}
        title={siteCode}
      >
        {siteLogo ? (
          <img src={siteLogo} alt="" className="h-full w-full object-contain p-[1px]" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[6px] font-black text-primary">
            {(siteCode ?? 'JB').slice(0, 2)}
          </span>
        )}
      </div>
    </div>
  );
}
