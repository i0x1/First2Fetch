import { DefaultLayout } from '@/components/defaultLayout';
import { F2aHead } from '@/components/head';

const sections = [
  [
    'Open-source software',
    'First 2 Fetch is provided under the MIT License. You may use, modify, and distribute the software subject to that license.',
  ],
  [
    'No employment guarantee',
    'The app helps collect and organize public job listings. It does not guarantee listing accuracy, interviews, employment, or any specific outcome. Verify every role with the original employer.',
  ],
  [
    'Third-party websites',
    'You are responsible for following the terms, rate limits, access rules, and applicable laws for every job board or website you monitor. A supported parser is not permission to ignore a site’s rules.',
  ],
  [
    'Your configuration',
    'You are responsible for protecting your credentials, API keys, Supabase project, optional AI provider settings, signing certificates, and local environment files.',
  ],
  [
    'Availability and changes',
    'Features, parsers, and integrations may change or stop working when third-party websites change. The software is provided as-is without warranties, to the extent allowed by law.',
  ],
  [
    'Project support',
    'Use GitHub Issues for reproducible bugs and feature requests. Report security problems through the private process described in SECURITY.md.',
  ],
];

export default function TermsOfService() {
  return (
    <>
      <F2aHead
        title="Terms - First 2 Fetch"
        description="Important usage terms and limitations for the First 2 Fetch open-source project."
        path="/terms-of-service"
      />
      <DefaultLayout>
        <section className="mx-auto max-w-3xl px-5 py-20 sm:px-8 lg:py-28">
          <h1 className="text-balance text-5xl font-black tracking-[-0.04em] text-[#102744] sm:text-6xl">
            Terms of use
          </h1>
          <p className="mt-3 text-sm text-slate-400">Last updated: June 10, 2026</p>
          <div className="mt-12 space-y-9">
            {sections.map(([title, text]) => (
              <section key={title}>
                <h2 className="text-xl font-bold text-[#17324d]">{title}</h2>
                <p className="mt-3 leading-7 text-slate-600">{text}</p>
              </section>
            ))}
          </div>
        </section>
      </DefaultLayout>
    </>
  );
}
