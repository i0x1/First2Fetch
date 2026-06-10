import Link from 'next/link';

import { BrandMark } from './brandMark';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white px-5 py-12 text-[#17324d] sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="flex items-center gap-2.5 font-bold">
            <BrandMark className="h-9 w-9 text-[#81966b]" />
            <span>First 2 Fetch</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-6 text-slate-500">
            An open-source desktop workspace for monitoring, filtering, and organizing job opportunities.
          </p>
        </div>

        <FooterColumn title="Project">
          <a href="https://github.com/i0x1/First2Fetch">Source code</a>
          <a href="https://github.com/i0x1/First2Fetch/releases">Releases</a>
          <Link href="/changelog">Changelog</Link>
        </FooterColumn>

        <FooterColumn title="Documentation">
          <a href="https://github.com/i0x1/First2Fetch#quick-start">Quick start</a>
          <a href="https://github.com/i0x1/First2Fetch/blob/main/docs/architecture.md">Architecture</a>
          <a href="https://github.com/i0x1/First2Fetch/blob/main/CONTRIBUTING.md">Contributing</a>
        </FooterColumn>

        <FooterColumn title="About">
          <a href="https://github.com/i0x1/First2Fetch#credits">Credits</a>
          <Link href="/privacy-policy">Privacy</Link>
          <Link href="/terms-of-service">Terms</Link>
        </FooterColumn>
      </div>

      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-2 border-t border-slate-200 pt-6 text-xs text-slate-400 sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} First 2 Fetch contributors.</p>
        <p>Released under the MIT License.</p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="text-sm">
      <p className="font-bold">{title}</p>
      <div className="mt-4 flex flex-col gap-3 text-slate-500">{children}</div>
    </div>
  );
}
