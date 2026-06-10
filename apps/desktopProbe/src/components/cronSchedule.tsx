import { AVAILABLE_CRON_RULES } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@first2apply/ui';

/**
 * Component used to set the cron schedule of the probe.
 */
export function CronSchedule({
  cronRule,
  onCronRuleChange,
  className,
}: {
  cronRule?: string;
  onCronRuleChange: (cron: string | undefined) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-row items-center justify-end gap-2', className)}>
      <Select value={cronRule} onValueChange={onCronRuleChange}>
        <SelectTrigger className="h-6 w-[132px] text-[10px]">
          <SelectValue placeholder="Never" />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_CRON_RULES.map((rule) => (
            <SelectItem key={rule.value} value={rule.value}>
              {rule.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
