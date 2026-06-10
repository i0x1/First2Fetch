import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@first2apply/ui';

/** Compact square icon button used in the job detail action bar. */
export function DetailIconButton({
  title,
  onClick,
  disabled,
  active,
  destructive,
  children,
}: {
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            title={title}
            disabled={disabled}
            onClick={onClick}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-[5px] border border-border bg-card text-muted-foreground transition-colors',
              'hover:border-primary hover:text-primary disabled:opacity-50',
              active && 'border-rose-500/35 bg-rose-500/10 text-rose-500 hover:border-rose-500/35 hover:text-rose-500',
              destructive && 'hover:border-destructive hover:text-destructive',
            )}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {title}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
