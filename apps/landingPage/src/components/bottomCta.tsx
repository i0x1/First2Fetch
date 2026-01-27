import { Button } from '@first2apply/ui';
import Link from 'next/link';

export function BottomCta() {
  return (
    <section id="bottom-cta" className="mx-auto max-w-7xl px-6 pt-[10vh] sm:px-10 md:pt-[20vh]">
      <h2 className="text-2xl font-semibold sm:text-4xl md:text-center lg:text-5xl">Get Started</h2>

      <p className="mt-2 w-fit max-w-[600px] sm:mt-6 md:mx-auto md:text-center lg:max-w-[800px]">
        Download the desktop application or clone from GitHub to run locally.
      </p>

      <div className="mt-6 flex flex-col items-center gap-4 md:mt-12 md:flex-row md:justify-center">
        <Link href="/download" className="w-full md:w-auto">
          <Button size="lg" className="w-full xs:w-fit">
            Download
          </Button>
        </Link>
        <Link href="https://github.com/i0x1/First2Fetch" target="_blank" rel="noreferrer" className="w-full md:w-auto">
          <Button size="lg" variant="outline" className="w-full xs:w-fit">
            View on GitHub
          </Button>
        </Link>
      </div>
    </section>
  );
}
