import { DefaultLayout } from '@/components/defaultLayout';
import { F2aHead } from '@/components/head';

export default function PrivacyPolicy() {
  return (
    <>
      <F2aHead
        title="Privacy - First 2 Fetch"
        description="How the First 2 Fetch website and desktop application handle data."
        path="/privacy-policy"
      />
      <DefaultLayout>
        <PolicyPage title="Privacy" updated="June 10, 2026">
          <PolicySection title="Website">
            This static showcase website does not include account forms, advertising trackers, or analytics scripts.
            GitHub Pages and your browser may still create normal hosting and network logs outside this project&apos;s
            control.
          </PolicySection>
          <PolicySection title="Desktop application">
            The app uses an email address for account access and stores saved search URLs, settings, structured job
            records, notes, and labels in the configured Supabase backend. Row Level Security is used to separate user
            data.
          </PolicySection>
          <PolicySection title="Local browser activity">
            Browser sessions and page scanning run inside the Electron app on your computer. First 2 Fetch stores the
            structured results needed for the product workflow, not a copy of your entire browsing history.
          </PolicySection>
          <PolicySection title="Optional services">
            AI providers, remote logging, analytics, and email delivery are optional or deployment-specific. When
            enabled, the minimum relevant data is sent to the configured provider according to that provider&apos;s
            terms and privacy policy.
          </PolicySection>
          <PolicySection title="Your choices">
            You can remove saved searches and job records from the app. For account deletion or a security concern, open
            a private security report or repository issue using the links in the project&apos;s SECURITY.md file.
          </PolicySection>
        </PolicyPage>
      </DefaultLayout>
    </>
  );
}

function PolicyPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-3xl px-5 py-20 sm:px-8 lg:py-28">
      <h1 className="text-5xl font-black tracking-[-0.04em] text-[#102744] sm:text-6xl">{title}</h1>
      <p className="mt-3 text-sm text-slate-400">Last updated: {updated}</p>
      <div className="mt-12 space-y-9">{children}</div>
    </section>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-[#17324d]">{title}</h2>
      <p className="mt-3 leading-7 text-slate-600">{children}</p>
    </section>
  );
}
