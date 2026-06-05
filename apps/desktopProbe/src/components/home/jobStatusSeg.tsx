import { cn } from '@/lib/utils';
import { JobStatus } from '@first2apply/core';

const STATUS_ITEMS: { value: JobStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'applied', label: 'Applied' },
  { value: 'archived', label: 'Archived' },
  { value: 'excluded_by_advanced_matching', label: 'Skipped' },
];

/** Compact segmented status control — replaces the full-width tab bar. */
export function JobStatusSeg({
  status,
  counts,
  onChange,
}: {
  status: JobStatus;
  counts: { new: number; applied: number; archived: number; filtered: number };
  onChange: (status: JobStatus) => void;
}) {
  const countFor = (value: JobStatus) => {
    switch (value) {
      case 'new':
        return counts.new;
      case 'applied':
        return counts.applied;
      case 'archived':
        return counts.archived;
      case 'excluded_by_advanced_matching':
        return counts.filtered;
      default:
        return 0;
    }
  };

  return (
    <div
      className="inline-flex shrink-0 gap-0.5 rounded-md border border-border bg-card p-0.5"
      data-testid="job-status-seg"
    >
      {STATUS_ITEMS.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            'rounded px-2 py-[5px] text-[11px] font-semibold leading-none transition-colors',
            status === item.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {item.label} {countFor(item.value)}
        </button>
      ))}
    </div>
  );
}
