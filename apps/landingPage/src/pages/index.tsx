import { Button } from '@first2apply/ui';
import Link from 'next/link';

import { DefaultLayout } from '@/components/defaultLayout';
import { F2aHead } from '@/components/head';

export default function Home() {
  return (
    <>
      <F2aHead
        title="First 2 Fetch - Job Board Aggregator"
        description="Aggregate job listings from LinkedIn, Indeed, Dice, and other platforms. Get instant alerts for new postings with our desktop app."
        path="/"
      />

      <DefaultLayout>
        <div className="mx-auto flex min-h-[calc(100vh-200px)] max-w-4xl flex-col items-center justify-center px-6 py-20 text-center sm:px-10">
          <h1 className="text-4xl font-bold sm:text-5xl md:text-6xl lg:text-7xl">
            First 2 Fetch
          </h1>
          
          <p className="mt-6 text-lg text-foreground/80 sm:text-xl md:text-2xl">
            Aggregate job listings from LinkedIn, Indeed, Dice, and other platforms in one place.
          </p>

          <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:gap-6">
            <Link href="/download" passHref>
              <Button className="h-12 px-8 text-lg sm:h-14 sm:px-10 sm:text-xl">
                Download Free
              </Button>
            </Link>
          </div>

          <div className="mt-16 grid gap-8 text-left sm:grid-cols-2 sm:gap-12 md:mt-20">
            <div>
              <h3 className="text-xl font-semibold sm:text-2xl">Automated Monitoring</h3>
              <p className="mt-2 text-foreground/70">
                Desktop app continuously monitors multiple job boards and alerts you instantly when new positions match your criteria.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold sm:text-2xl">Cross-Platform</h3>
              <p className="mt-2 text-foreground/70">
                Available for Windows, macOS, and Linux. Set up once and let it work in the background.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold sm:text-2xl">Customizable Alerts</h3>
              <p className="mt-2 text-foreground/70">
                Configure filters for specific job sites, keywords, and criteria. Get notified only about what matters to you.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold sm:text-2xl">Stay Ahead</h3>
              <p className="mt-2 text-foreground/70">
                Be the first to know about new opportunities. Get alerts faster than checking manually.
              </p>
            </div>
          </div>
        </div>
      </DefaultLayout>
    </>
  );
}
