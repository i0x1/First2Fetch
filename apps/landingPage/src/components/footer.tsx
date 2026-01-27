import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-secondary dark:bg-card h-fit w-full px-6 pb-8 pt-20 sm:px-10">
      <div className="mx-auto h-fit max-w-7xl">
        <div className="xs:gap-6 mx-auto flex w-fit items-center gap-4">
          <a href="https://github.com/i0x1/First2Fetch" target="_blank" rel="noreferrer">
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[#809966]/80 transition-transform duration-200 hover:-translate-y-1">
              <svg
                className="dark:hidden"
                fill="#000000"
                height="24px"
                width="24px"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>

              <svg
                className="hidden dark:block"
                fill="#ffffff"
                height="24px"
                width="24px"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </button>
          </a>
        </div>

        <div className="mx-auto mt-4 flex w-fit flex-col items-center gap-2 text-center text-sm">
          <p>
            <span className="font-semibold">First 2 Fetch</span> - An upgraded and personalized job board aggregator
          </p>
          <p>
            Get the code on{' '}
            <a
              href="https://github.com/i0x1/First2Fetch"
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            . Clone or download from the repo to run the desktop app locally.
          </p>
          <div className="mt-2 flex gap-3">
            <Link href="/privacy-policy" className="underline">
              Privacy Policy
            </Link>
            <Link href="/terms-of-service" className="underline">
              Terms of Service
            </Link>
          </div>
          <p className="text-muted-foreground mt-3">
            © {new Date().getFullYear()} First 2 Fetch. All Rights Reserved.
          </p>
          <p className="text-muted-foreground mt-2 text-center text-xs">
            Inspired by{' '}
            <a href="https://first2apply.com" className="underline" target="_blank" rel="noreferrer">
              First 2 Apply
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
