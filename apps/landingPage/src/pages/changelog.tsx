import { DefaultLayout } from '@/components/defaultLayout';
import { F2aHead } from '@/components/head';

const highlights = [
  [
    '2.3.0',
    'Current release',
    'Persistent user preferences, stronger job-query security, scanner reliability work, and dashboard improvements.',
  ],
  [
    '2.0.0',
    'Major workflow update',
    'Custom job-board support, in-app browsing, improved parsing, and a denser job-management experience.',
  ],
  [
    '1.x',
    'Foundation',
    'Multi-source monitoring, desktop notifications, notes, labels, CSV export, and advanced matching.',
  ],
];

export default function Changelog() {
  return (
    <>
      <F2aHead
        title="Changelog - First 2 Fetch"
        description="A concise release history for First 2 Fetch, with links to the full repository changelog."
        path="/changelog"
      />
      <DefaultLayout>
        <section className="mx-auto max-w-4xl px-5 py-20 sm:px-8 lg:py-28">
          <h1 className="text-5xl font-black tracking-[-0.04em] text-[#102744] sm:text-6xl">Changelog</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            The project keeps detailed release notes in the repository. This page summarizes the major milestones.
          </p>

          <div className="mt-12 border-t border-slate-200">
            {highlights.map(([version, label, text]) => (
              <article key={version} className="grid gap-3 border-b border-slate-200 py-8 sm:grid-cols-[130px_1fr]">
                <div>
                  <p className="text-2xl font-black text-[#17324d]">{version}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#81966b]">{label}</p>
                </div>
                <p className="leading-7 text-slate-600">{text}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a
              href="https://github.com/i0x1/First2Fetch/blob/main/CHANGELOG.md"
              className="rounded-md bg-[#81966b] px-5 py-3 text-center font-bold text-white"
            >
              Read the full changelog
            </a>
            <a
              href="https://github.com/i0x1/First2Fetch/releases"
              className="rounded-md border border-[#81966b] px-5 py-3 text-center font-bold text-[#5f744c]"
            >
              Browse releases
            </a>
          </div>
        </section>
      </DefaultLayout>
    </>
  );
}
