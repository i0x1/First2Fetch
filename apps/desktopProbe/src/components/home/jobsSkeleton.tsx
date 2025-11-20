import { Skeleton } from '@first2apply/ui';

/**
 * Skeleton for the JobsList component.
 */
export function JobsListSkeleton() {
  return (
    <ul className="space-y-2 px-2 py-2">
      {Array.from({ length: 10 }).map((_, index) => (
        <li key={index} className="rounded-xl border border-border/40 bg-card/40 px-4 py-3">
          {/* Title Row */}
          <div className="mb-2 pr-8">
            <Skeleton className="h-4 w-3/4" />
          </div>

          {/* Company & Location Row */}
          <div className="mb-3 flex items-center gap-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-32" />
          </div>

          {/* Footer: Source & Timestamps */}
          <div className="flex items-center justify-between gap-4 border-t border-border/30 pt-2.5">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3.5 w-3.5 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Skeleton for the JobSummary component.
 */
export function JobSummarySkeleton() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 p-6 shadow-sm lg:p-8">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <Skeleton className="mb-4 h-3.5 w-32" />
          <Skeleton className="mb-3 h-8 w-full max-w-96 lg:h-10" />
          <Skeleton className="mb-6 h-5 w-48" />
        </div>

        <Skeleton className="h-20 w-20 rounded-full ring-2 ring-border/30 lg:h-24 lg:w-24" />
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>

        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-full max-w-72" />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2 lg:mt-10">
        <Skeleton className="h-10 w-24 rounded-xl" />
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="ml-auto h-10 w-[148px] rounded-xl" />
      </div>
    </div>
  );
}

/**
 * Skeleton for the JobDetails component.
 */
export function JobDetailsSkeleton() {
  return (
    <div className="space-y-1 pl-[25px] pr-2">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-6 w-2/3" />
      <div className="h-6" />
      <Skeleton className="h-6 w-[99%]" />
      <Skeleton className="h-6 w-[95%]" />
      <Skeleton className="h-6 w-[97%]" />
      <Skeleton className="h-6 w-[99%]" />
      <div className="h-6" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-6 w-[99%]" />
      <Skeleton className="h-6 w-[95%]" />
      <Skeleton className="h-6 w-[97%]" />
      <Skeleton className="h-6 w-[99%]" />
      <Skeleton className="h-6 w-[99%]" />
      <Skeleton className="h-6 w-[95%]" />
      <Skeleton className="h-6 w-[97%]" />
      <Skeleton className="h-6 w-[99%]" />
      <Skeleton className="h-6 w-[99%]" />
      <Skeleton className="h-6 w-[95%]" />
      <Skeleton className="h-6 w-[97%]" />
      <Skeleton className="h-6 w-[99%]" />
    </div>
  );
}
