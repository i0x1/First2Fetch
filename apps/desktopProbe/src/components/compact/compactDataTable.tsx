import { cn } from '@/lib/utils';

export function CompactDataTable({
  children,
  className,
  minWidthClassName = 'min-w-[720px]',
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  minWidthClassName?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('overflow-x-auto rounded-md border border-border bg-card', className)} {...props}>
      <table className={cn('w-full table-fixed border-collapse text-[11px] leading-tight', minWidthClassName)}>
        {children}
      </table>
    </div>
  );
}

export function CompactDataTableHead({
  children,
  sticky = false,
}: {
  children: React.ReactNode;
  sticky?: boolean;
}) {
  return (
    <thead>
      <tr
        className={cn(
          'border-b border-border bg-muted text-[9px] uppercase tracking-wide text-muted-foreground',
          sticky && 'sticky top-0 z-[2]',
        )}
      >
        {children}
      </tr>
    </thead>
  );
}

export function CompactTh({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <th className={cn('px-[5px] py-[5px] text-left font-bold', className)}>{children}</th>;
}

export function CompactTd({
  children,
  className,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
} & React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('border-b border-border px-[5px] py-[3px] align-middle', className)} {...props}>
      {children}
    </td>
  );
}

export function CompactSectionRow({
  children,
  colSpan = 8,
  sticky = false,
  id,
}: {
  children: React.ReactNode;
  colSpan?: number;
  sticky?: boolean;
  id?: string;
}) {
  return (
    <tr
      id={id}
      className={cn('bg-card/95 text-[10px] font-bold text-muted-foreground', sticky && 'sticky top-6 z-[1]')}
    >
      <td colSpan={colSpan} className="border-b border-border px-1.5 py-1">
        {children}
      </td>
    </tr>
  );
}
