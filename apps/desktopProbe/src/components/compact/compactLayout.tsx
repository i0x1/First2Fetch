import { cn } from '@/lib/utils';

export function CompactPageHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-2 flex items-center justify-between gap-3', className)}>
      <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
      {action}
    </div>
  );
}

export function CompactPanel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('overflow-hidden rounded-md border border-border bg-card', className)}>
      <div className="border-b border-border bg-muted/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {children}
    </section>
  );
}

export function CompactKvTable({ children }: { children: React.ReactNode }) {
  return <table className="w-full border-collapse text-[11px] leading-tight">{children}</table>;
}

export function CompactKvRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="w-[38%] px-2 py-1 align-middle text-[10px] text-muted-foreground">
        <span className="block font-medium text-foreground/90">{label}</span>
        {hint ? <span className="block text-[9px] leading-tight text-muted-foreground">{hint}</span> : null}
      </td>
      <td className="px-2 py-1 text-right align-middle text-[11px]">{children}</td>
    </tr>
  );
}

export function CompactGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 }) {
  return (
    <div className={cn('grid gap-2', cols === 2 ? 'md:grid-cols-2' : 'grid-cols-1')}>{children}</div>
  );
}

export function CompactChipList({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1 px-2 py-1.5">{children}</div>;
}

export function CompactChip({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px]">
      {children}
      {onRemove ? (
        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={onRemove} aria-label="Remove">
          ×
        </button>
      ) : null}
    </span>
  );
}
