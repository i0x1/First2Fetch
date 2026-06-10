import type { ReactNode } from 'react';

const jobs = [
  ['Northstar Labs', 'Senior Frontend Engineer', 'Remote · United States', '18m ago', 'N', 'bg-[#17324d]'],
  ['Acme Systems', 'Data Engineer, Analytics', 'Remote · United States', '32m ago', 'A', 'bg-[#81966b]'],
  ['Vertex Innovations', 'Product Analyst', 'Austin, TX · Hybrid', '1h ago', 'V', 'bg-[#e76f35]'],
  ['Blueprint Tech', 'UX Designer', 'Seattle, WA · Remote', '2h ago', 'B', 'bg-[#536b85]'],
];

const searches = [
  ['LinkedIn', 'Frontend Engineer · Remote US', 'Every 30 min', 'Weekdays'],
  ['Indeed', 'Data Engineer · Remote', 'Every 60 min', 'Every day'],
  ['Dice', 'DevOps Engineer · United States', 'Every 2 hours', 'Weekdays'],
  ['We Work Remotely', 'Frontend Developer', 'Every 2 hours', 'Weekdays'],
];

function DesktopFrame({
  children,
  className = '',
  id,
  showcase,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  showcase: string;
}) {
  return (
    <div
      id={id}
      data-showcase={showcase}
      className={`scroll-mt-24 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(23,50,77,0.14)] ${className}`}
    >
      <div className="flex h-9 items-center border-b border-slate-200 bg-slate-50 px-3">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b5f]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd45]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
        </div>
        <span className="mx-auto pr-10 text-[10px] font-semibold text-slate-500">First 2 Fetch</span>
      </div>
      {children}
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="hidden w-14 shrink-0 flex-col items-center bg-[#17324d] py-4 text-white sm:flex">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e76f35] text-[10px] font-black">F2</span>
      <div className="mt-9 flex flex-col gap-4 text-xs">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-white/15">01</span>
        <span className="grid h-7 w-7 place-items-center text-white/60">02</span>
        <span className="grid h-7 w-7 place-items-center text-white/60">03</span>
        <span className="grid h-7 w-7 place-items-center text-white/60">04</span>
      </div>
    </aside>
  );
}

export function DashboardMockup({ id }: { id?: string }) {
  return (
    <DesktopFrame id={id} showcase="dashboard">
      <div className="flex min-h-[370px] bg-[#f8fafc] text-[#17324d]">
        <Sidebar />
        <div className="min-w-0 flex-1 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold sm:text-base">Jobs</h3>
            <div className="flex rounded-md border border-slate-200 bg-white p-0.5 text-[9px] font-semibold">
              <span className="rounded bg-[#e76f35] px-2 py-1 text-white">New 24</span>
              <span className="px-2 py-1 text-slate-500">Applied 3</span>
              <span className="hidden px-2 py-1 text-slate-500 sm:inline">Archived 12</span>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1.02fr_.98fr]">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 p-2">
                <div className="rounded-md border border-slate-200 px-3 py-2 text-[10px] text-slate-400">
                  Search title or company...
                </div>
              </div>
              {jobs.map(([company, title, location, found, mark, color], index) => (
                <div
                  key={company}
                  className={`grid grid-cols-[30px_1fr_auto] gap-2 border-b border-slate-100 p-2.5 last:border-0 ${
                    index === 0 ? 'border-l-2 border-l-[#e76f35] bg-[#f7f8f2]' : ''
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-md text-[10px] font-bold text-white ${color}`}
                  >
                    {mark}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-bold">{title}</p>
                    <p className="truncate text-[9px] text-slate-500">{company}</p>
                    <p className="mt-1 truncate text-[8px] text-slate-400">{location}</p>
                  </div>
                  <div className="text-right">
                    <span className="rounded bg-[#dfe9d5] px-1.5 py-0.5 text-[8px] font-semibold text-[#4d653b]">
                      New
                    </span>
                    <p className="mt-2 text-[8px] text-slate-400">{found}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden rounded-lg border border-slate-200 bg-white p-4 sm:block">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">Senior Frontend Engineer</p>
                  <p className="mt-1 text-[10px] text-slate-500">Northstar Labs · Remote</p>
                </div>
                <span className="rounded bg-[#dfe9d5] px-2 py-1 text-[9px] font-semibold text-[#4d653b]">New</span>
              </div>
              <div className="mt-4 flex gap-2 text-[9px] font-semibold">
                <span className="rounded bg-[#81966b] px-3 py-1.5 text-white">Apply</span>
                <span className="rounded bg-slate-100 px-3 py-1.5">Archive</span>
                <span className="rounded border border-slate-200 px-3 py-1.5">Add label</span>
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-[10px] font-bold">About the role</p>
                <p className="mt-2 text-[9px] leading-4 text-slate-600">
                  Build accessible product experiences for a distributed analytics team. Partner with design and
                  platform engineers to ship reliable customer workflows.
                </p>
                <p className="mt-4 text-[10px] font-bold">What you will do</p>
                <ul className="mt-2 space-y-1 text-[9px] text-slate-600">
                  <li>• Build reusable React interfaces.</li>
                  <li>• Improve performance and accessibility.</li>
                  <li>• Collaborate across product and engineering.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DesktopFrame>
  );
}

export function SearchesMockup({ id }: { id?: string }) {
  return (
    <DesktopFrame id={id} showcase="searches">
      <div className="flex min-h-[330px] bg-[#f8fafc] text-[#17324d]">
        <Sidebar />
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold">Saved searches</h3>
              <p className="mt-1 text-[10px] text-slate-500">Choose when each source should be checked.</p>
            </div>
            <span className="rounded-md bg-[#81966b] px-3 py-2 text-[10px] font-semibold text-white">Add search</span>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="hidden grid-cols-[1.2fr_2fr_1fr_1fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[8px] font-bold uppercase tracking-wide text-slate-400 sm:grid">
              <span>Source</span>
              <span>Search</span>
              <span>Interval</span>
              <span>Days</span>
            </div>
            {searches.map(([source, search, interval, days], index) => (
              <div
                key={source}
                className="grid gap-1 border-b border-slate-100 px-4 py-3 text-[10px] last:border-0 sm:grid-cols-[1.2fr_2fr_1fr_1fr] sm:items-center sm:gap-3"
              >
                <span className="font-bold">
                  <span
                    className={`mr-2 inline-grid h-6 w-6 place-items-center rounded-md text-[8px] text-white ${
                      index === 0
                        ? 'bg-[#2877b5]'
                        : index === 1
                          ? 'bg-[#2445a6]'
                          : index === 2
                            ? 'bg-[#d23b2f]'
                            : 'bg-[#17324d]'
                    }`}
                  >
                    {source.slice(0, 2).toUpperCase()}
                  </span>
                  {source}
                </span>
                <span className="text-slate-600">{search}</span>
                <span className="text-slate-500">{interval}</span>
                <span className="text-slate-500">{days}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-[#dfe9d5] bg-[#f7f8f2] px-4 py-3 text-[9px]">
            <span>
              <strong>Scanner active</strong> · next check in 12 minutes
            </span>
            <span className="rounded border border-[#81966b] px-2 py-1 font-semibold text-[#4d653b]">Run now</span>
          </div>
        </div>
      </div>
    </DesktopFrame>
  );
}

export function MatchingMockup({ id }: { id?: string }) {
  const results: [string, string, string, boolean][] = [
    ['Strong match', 'Senior Frontend Engineer', 'Northstar Labs', true],
    ['Strong match', 'Product Engineer', 'Acme Systems', true],
    ['Hidden', 'Staff Platform Engineer', 'Vertex Innovations', false],
    ['Hidden', 'Traveling Solutions Lead', 'Example Staffing', false],
  ];

  return (
    <DesktopFrame id={id} showcase="advanced-matching">
      <div className="flex min-h-[350px] bg-[#f8fafc] text-[#17324d]">
        <Sidebar />
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <h3 className="text-base font-bold">Advanced matching</h3>
          <p className="mt-1 text-[10px] text-slate-500">Optional rules help rank or hide jobs after they are found.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1.15fr_.85fr]">
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Matching rules</p>
                <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-[10px] leading-4 text-slate-600">
                  Focus on frontend or product engineering roles. Prefer remote work and TypeScript. Avoid staff-level
                  titles and roles requiring weekly travel.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Company lists</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[9px]">
                  <span className="rounded bg-[#dfe9d5] px-2 py-1 text-[#4d653b]">Include: Northstar Labs</span>
                  <span className="rounded bg-[#fff0e8] px-2 py-1 text-[#a44618]">Exclude: Example Staffing</span>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Preview</p>
              <div className="mt-2 space-y-2">
                {results.map(([status, title, company, pass]) => (
                  <div key={title} className="flex items-start gap-2 rounded-md border border-slate-100 p-2.5">
                    <span
                      className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[8px] font-bold text-white ${
                        pass ? 'bg-[#81966b]' : 'bg-[#e76f35]'
                      }`}
                    >
                      {pass ? '✓' : '×'}
                    </span>
                    <div>
                      <p className="text-[9px] font-bold">{title}</p>
                      <p className="text-[8px] text-slate-400">
                        {company} · {status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DesktopFrame>
  );
}
