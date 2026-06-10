import { cn } from '@/lib/utils';

export type JobViewMode = 'list-focus' | 'split' | 'detail-focus';

const VIEW_ITEMS: { value: JobViewMode; label: string }[] = [
  { value: 'list-focus', label: 'Table' },
  { value: 'split', label: 'Split' },
  { value: 'detail-focus', label: 'Detail' },
];

export function JobViewModeSeg({
  viewMode,
  onChange,
}: {
  viewMode: JobViewMode;
  onChange: (mode: JobViewMode) => void;
}) {
  return (
    <div
      className="inline-flex shrink-0 gap-0.5 rounded-md border border-border bg-card p-0.5"
      data-testid="job-view-mode-seg"
    >
      {VIEW_ITEMS.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            'rounded px-2 py-[5px] text-[11px] font-semibold leading-none transition-colors',
            viewMode === item.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function jobViewGridClass(viewMode: JobViewMode): string {
  switch (viewMode) {
    case 'list-focus':
      return 'lg:grid-cols-[minmax(420px,1.65fr)_minmax(280px,1fr)]';
    case 'detail-focus':
      return 'lg:grid-cols-[minmax(280px,0.55fr)_minmax(380px,1.45fr)]';
    default:
      return 'lg:grid-cols-[minmax(320px,1fr)_minmax(320px,1fr)]';
  }
}
