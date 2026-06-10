import { useEffect, useState } from 'react';

import Link from 'next/link';

import { BrandMark } from './brandMark';

function useScrollLock(lock: boolean) {
  useEffect(() => {
    document.body.style.overflow = lock ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [lock]);
}

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  useScrollLock(isOpen);

  useEffect(() => {
    const handleScroll = () => setHasScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors ${
        hasScrolled || isOpen ? 'border-slate-200 bg-white/95' : 'border-transparent bg-white/85'
      } backdrop-blur-xl`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-bold tracking-tight text-[#17324d]"
          onClick={() => setIsOpen(false)}
        >
          <BrandMark className="h-8 w-8 text-[#81966b]" />
          <span className="text-lg">First 2 Fetch</span>
        </Link>

        <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <Link href="/#features" className="transition-colors hover:text-[#17324d]">
            Features
          </Link>
          <Link href="/#architecture" className="transition-colors hover:text-[#17324d]">
            Architecture
          </Link>
          <a href="https://github.com/i0x1/First2Fetch#quick-start" className="transition-colors hover:text-[#17324d]">
            Docs
          </a>
          <a
            href="https://github.com/i0x1/First2Fetch"
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-[#81966b] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#6f835b]"
          >
            View on GitHub
          </a>
        </div>

        <button
          type="button"
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isOpen}
          className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 text-xl leading-none text-[#17324d] md:hidden"
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? '×' : '≡'}
        </button>
      </nav>

      {isOpen ? (
        <div className="border-t border-slate-200 bg-white px-5 py-5 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm font-semibold text-[#17324d]">
            <Link href="/#features" onClick={() => setIsOpen(false)}>
              Features
            </Link>
            <Link href="/#architecture" onClick={() => setIsOpen(false)}>
              Architecture
            </Link>
            <a href="https://github.com/i0x1/First2Fetch#quick-start">Docs</a>
            <a
              href="https://github.com/i0x1/First2Fetch"
              target="_blank"
              rel="noreferrer"
              className="mt-1 rounded-md bg-[#81966b] px-4 py-3 text-center text-white"
            >
              View on GitHub
            </a>
          </div>
        </div>
      ) : null}
    </header>
  );
}
