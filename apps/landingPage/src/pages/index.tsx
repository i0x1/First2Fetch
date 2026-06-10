import type { ReactNode } from 'react';

import { DefaultLayout } from '@/components/defaultLayout';
import { F2aHead } from '@/components/head';
import { DashboardMockup, MatchingMockup, SearchesMockup } from '@/components/productShowcase';

const workflow = [
  ['01', 'Save the searches you already use', 'Paste a supported job-board search URL or add a custom source.'],
  ['02', 'Check automatically', 'Choose an interval and let the desktop scanner work quietly in the background.'],
  ['03', 'Filter the noise', 'Use normal filters or optional AI rules to hide jobs that do not fit.'],
  ['04', 'Review and apply', 'Open details, add notes and labels, then move jobs through your workflow.'],
];

const sources = [
  'LinkedIn',
  'Indeed',
  'Dice',
  'Glassdoor',
  'Hiring Cafe',
  'Built In',
  'Remote OK',
  'Remotive',
  'We Work Remotely',
  'USAJobs',
  'FlexJobs',
  'Custom sources',
];

const stack = ['TypeScript', 'React', 'Electron', 'Supabase', 'PostgreSQL', 'Nx', 'Playwright'];

export default function Home() {
  return (
    <>
      <F2aHead
        title="First 2 Fetch - Open-source job search monitor"
        description="Monitor job searches, filter new listings, and organize every opportunity from one open-source desktop app."
        path="/"
      />

      <DefaultLayout>
        <section className="overflow-hidden bg-white px-5 pb-20 pt-16 sm:px-8 sm:pt-20 lg:pb-28 lg:pt-24">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[.78fr_1.22fr]">
            <div>
              <h1 className="max-w-xl text-balance text-5xl font-black leading-[1.02] tracking-[-0.045em] text-[#102744] sm:text-6xl lg:text-7xl">
                Catch new roles before they get crowded<span className="text-[#81966b]">.</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">
                First 2 Fetch checks the job searches you already use, filters the noise, and keeps every opportunity
                organized in one desktop workspace.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <PrimaryLink href="https://github.com/i0x1/First2Fetch">
                  <GitHubIcon />
                  View on GitHub
                </PrimaryLink>
                <SecondaryLink href="#features">
                  Explore features
                  <ArrowIcon />
                </SecondaryLink>
              </div>
              <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-6 text-sm">
                <Value title="Local scanner" text="Browser sessions and page checks run on your computer." />
                <Value title="Scheduled checks" text="Monitor each saved search at the interval you choose." />
                <Value title="Optional AI rules" text="Use your configured provider to refine matching." />
                <Value title="Focused workflow" text="Track new, applied, archived, and filtered jobs." />
              </div>
            </div>

            <div className="relative lg:translate-x-8">
              <div className="absolute -inset-12 -z-10 bg-[radial-gradient(circle_at_center,rgba(129,150,107,.18),transparent_65%)]" />
              <DashboardMockup id="showcase-dashboard" />
              <p className="mt-3 text-center text-xs text-slate-400">
                Product preview uses fictional demonstration data.
              </p>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="scroll-mt-20 border-y border-slate-200 bg-[#f8fafc] px-5 py-20 sm:px-8 lg:py-28"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-balance text-4xl font-black tracking-[-0.035em] text-[#102744] sm:text-5xl">
                From saved search to short list.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Keep the useful parts of each job board while replacing tab refreshing and scattered spreadsheets with
                one repeatable process.
              </p>
            </div>

            <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 md:grid-cols-4">
              {workflow.map(([number, title, text]) => (
                <div key={number} className="bg-white p-6">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[#81966b] text-xs font-black text-white">
                    {number}
                  </span>
                  <h3 className="mt-5 font-bold text-[#17324d]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-20 sm:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <FeatureRow
              title="One focused inbox"
              text="New jobs from every saved search land in one place. Search, open the full description, take notes, label results, archive noise, and mark applications without losing context."
            >
              <DashboardMockup id="showcase-dashboard-feature" />
            </FeatureRow>

            <FeatureRow
              reverse
              title="Flexible monitoring"
              text="Set a separate schedule for every search, pause scanning when needed, or run an immediate check. The desktop app keeps the browser work on your machine."
            >
              <SearchesMockup id="showcase-searches" />
            </FeatureRow>

            <FeatureRow
              title="Advanced matching"
              text="Describe what fits in plain language, maintain company include and exclude lists, and preview why a role matched. AI filtering is optional and provider settings remain configurable."
            >
              <MatchingMockup id="showcase-advanced-matching" />
            </FeatureRow>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-[#f8fafc] px-5 py-20 sm:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.7fr_1.3fr] lg:items-center">
            <div>
              <h2 className="text-4xl font-black tracking-[-0.035em] text-[#102744] sm:text-5xl">
                Bring your job boards together.
              </h2>
              <p className="mt-5 max-w-lg text-lg leading-8 text-slate-600">
                Use built-in parsers for popular sources or add a custom job-board URL when a site is not covered yet.
              </p>
            </div>
            <div className="grid grid-cols-2 border-l border-t border-slate-200 sm:grid-cols-3">
              {sources.map((source, index) => (
                <div
                  key={source}
                  className="flex min-h-20 items-center gap-3 border-b border-r border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#17324d]"
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-md text-[10px] font-black text-white ${index % 3 === 0 ? 'bg-[#17324d]' : index % 3 === 1 ? 'bg-[#81966b]' : 'bg-[#e76f35]'}`}
                  >
                    {source.slice(0, 2).toUpperCase()}
                  </span>
                  {source}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="architecture" className="scroll-mt-20 bg-white px-5 py-20 sm:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr] lg:items-center">
              <div>
                <h2 className="text-balance text-4xl font-black tracking-[-0.035em] text-[#102744] sm:text-5xl">
                  Local scanning, cloud-backed organization.
                </h2>
                <p className="mt-5 text-lg leading-8 text-slate-600">
                  Browser sessions and page scanning run inside the Electron desktop app. Supabase handles accounts,
                  saved searches, structured job data, database security, and server-side workflows.
                </p>
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  Optional AI providers only receive the content needed for enabled parsing or matching features.
                </p>
                <SecondaryLink href="https://github.com/i0x1/First2Fetch/blob/main/docs/architecture.md">
                  Read the architecture guide
                  <ArrowIcon />
                </SecondaryLink>
              </div>
              <ArchitectureDiagram />
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-[#f8fafc] px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[.6fr_1.4fr] lg:items-end">
              <div>
                <h2 className="text-4xl font-black tracking-[-0.035em] text-[#102744] sm:text-5xl">
                  Built in the open.
                </h2>
                <p className="mt-5 text-lg leading-8 text-slate-600">
                  The app, backend migrations, edge functions, tests, and website live together in one documented
                  monorepo.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {stack.map((item) => (
                  <span
                    key={item}
                    className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#17324d]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-10 grid gap-3 md:grid-cols-3">
              <ResourceLink
                href="https://github.com/i0x1/First2Fetch#quick-start"
                title="Read the docs"
                text="Install, configure, and run the project locally."
              />
              <ResourceLink
                href="https://github.com/i0x1/First2Fetch/blob/main/docs/architecture.md"
                title="View architecture"
                text="Understand the desktop, database, and edge-function flow."
              />
              <ResourceLink
                href="https://github.com/i0x1/First2Fetch"
                title="Browse the source"
                text="Review the code, report issues, or contribute."
              />
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-20 sm:px-8 lg:py-28">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 rounded-2xl bg-[#e76f35] px-7 py-10 text-white sm:px-12 sm:py-14 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="max-w-3xl text-balance text-3xl font-black tracking-[-0.03em] sm:text-5xl">
                Run your job search from one focused place.
              </h2>
              <p className="mt-4 text-white/80">Open source, configurable, and built for a real daily workflow.</p>
            </div>
            <a
              href="https://github.com/i0x1/First2Fetch"
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-white px-5 py-3 font-bold text-[#17324d]"
            >
              <GitHubIcon />
              View on GitHub
            </a>
          </div>
        </section>
      </DefaultLayout>
    </>
  );
}

function Value({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="font-bold text-[#17324d]">{title}</p>
      <p className="mt-1 leading-5 text-slate-500">{text}</p>
    </div>
  );
}

function FeatureRow({
  title,
  text,
  children,
  reverse = false,
}: {
  title: string;
  text: string;
  children: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div
      className={`grid items-center gap-10 py-14 first:pt-0 last:pb-0 lg:grid-cols-[.72fr_1.28fr] lg:gap-16 ${reverse ? 'lg:grid-cols-[1.28fr_.72fr]' : ''}`}
    >
      <div className={reverse ? 'lg:order-2' : ''}>
        <h2 className="text-3xl font-black tracking-[-0.03em] text-[#102744] sm:text-4xl">{title}</h2>
        <p className="mt-4 text-lg leading-8 text-slate-600">{text}</p>
      </div>
      <div className={reverse ? 'lg:order-1' : ''}>{children}</div>
    </div>
  );
}

function ArchitectureDiagram() {
  return (
    <div className="rounded-xl border border-slate-200 bg-[#f8fafc] p-4 sm:p-7">
      <div className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1.25fr_auto_1fr]">
        <DiagramNode
          title="Electron app"
          text="Browser sessions, scanning, filters, notifications"
          color="border-[#81966b]"
        />
        <DiagramArrow />
        <DiagramNode
          title="Supabase"
          text="Auth, Postgres, RLS, edge functions, email workflows"
          color="border-[#2dba73]"
        />
        <DiagramArrow />
        <DiagramNode title="Job sources" text="Built-in parsers and custom search URLs" color="border-[#e76f35]" />
      </div>
      <div className="mx-auto mt-4 max-w-sm border-l border-dashed border-slate-300 pl-4">
        <DiagramNode
          title="Optional AI provider"
          text="Parsing and matching only when configured"
          color="border-slate-300"
        />
      </div>
    </div>
  );
}

function DiagramNode({ title, text, color }: { title: string; text: string; color: string }) {
  return (
    <div className={`rounded-lg border-2 bg-white p-4 ${color}`}>
      <p className="font-bold text-[#17324d]">{title}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}

function DiagramArrow() {
  return (
    <div className="hidden items-center text-slate-300 md:flex" aria-hidden="true">
      <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
        <path
          d="M1 6h24m0 0-5-5m5 5-5 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function ResourceLink({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <a
      href={href}
      className="group rounded-xl border border-slate-200 bg-white p-6 transition-transform hover:-translate-y-1"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[#17324d]">{title}</h3>
        <ArrowIcon />
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </a>
  );
}

function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noreferrer' : undefined}
      className="inline-flex items-center justify-center gap-2 rounded-md bg-[#81966b] px-5 py-3 font-bold text-white transition-colors hover:bg-[#6f835b]"
    >
      {children}
    </a>
  );
}

function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noreferrer' : undefined}
      className="mt-0 inline-flex items-center justify-center gap-2 rounded-md border border-[#81966b] px-5 py-3 font-bold text-[#5f744c] transition-colors hover:bg-[#f7f8f2]"
    >
      {children}
    </a>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M4 9h10m0 0-4-4m4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.4c.58.1.79-.25.79-.56v-2.02c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.19 1.78 1.19 1.04 1.78 2.72 1.27 3.39.97.1-.75.4-1.27.74-1.56-2.57-.3-5.28-1.29-5.28-5.75 0-1.27.45-2.3 1.2-3.12-.12-.3-.52-1.48.11-3.08 0 0 .98-.31 3.2 1.2a11.08 11.08 0 0 1 5.82 0c2.22-1.51 3.2-1.2 3.2-1.2.63 1.6.23 2.78.11 3.08.75.82 1.2 1.85 1.2 3.12 0 4.47-2.72 5.45-5.3 5.74.42.36.79 1.07.79 2.15v3.04c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
    </svg>
  );
}
