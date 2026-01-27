import { Button } from '@first2apply/ui';
import Image from 'next/image';
import Link from 'next/link';

import trackBlackImage from '../../public/assets/track-black.png';
import trackWhiteImage from '../../public/assets/track-white.png';

export function ProductSection() {
  return (
    <section id="product">
      <div className="mx-auto flex h-[calc(55vh-56px)] w-full max-w-7xl flex-col items-start justify-end px-6 sm:px-10 md:h-[calc(50vh-64px)] md:flex-row md:items-end md:justify-between md:gap-10 lg:gap-20">

        <h1 className="z-10 text-3xl font-semibold sm:text-5xl md:text-nowrap lg:text-6xl">
          First 2 Fetch
        </h1>

        <h2 className="mt-2 text-sm text-foreground/70 md:hidden">
          Job board aggregator with performance optimizations and database improvements.
        </h2>

        <Link href="/download" passHref className="self-center md:self-end">
          <Button className="my-[calc(10vh-64px)] h-12 w-full max-w-72 text-xl md:my-0 lg:h-14 lg:max-w-96 lg:text-2xl">
            Try it&nbsp;
            <span className="md:hidden lg:inline-block">now&nbsp;</span>
            for free
          </Button>
        </Link>
      </div>

      <div className="relative hidden h-[50vh] bg-gradient-to-t from-muted to-background dark:from-card/60 md:block">
        <div className="mx-auto max-w-7xl px-6 pt-3 sm:px-10">
          <h2 className="text-md text-foreground/70 lg:text-lg">
            Job board aggregator with performance optimizations and database improvements.
          </h2>

          <Image
            src={trackBlackImage}
            alt="paperfly track black"
            priority={true}
            className="absolute top-2 z-10 h-auto max-h-[315px] w-96 dark:hidden md:left-1/2 md:ml-40 md:-translate-x-1/2 lg:ml-44 lg:h-[40vh] lg:w-auto"
          />
          <Image
            src={trackWhiteImage}
            alt="paperfly track white"
            priority={true}
            className="absolute top-2 z-10 hidden h-auto max-h-[315px] w-96 dark:block md:left-1/2 md:ml-40 md:-translate-x-1/2 lg:ml-44 lg:h-[40vh] lg:w-auto"
          />
        </div>
      </div>

      <div className="mx-auto min-h-fit max-w-5xl overflow-hidden px-6 md:relative md:-top-[20vh] md:px-10">
        <div
          style={{
            padding: '70.68% 0 0 0',
            position: 'relative',
          }}
        >
          <iframe
            src="https://player.vimeo.com/video/1134606780?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479"
            frameBorder="0"
            allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' }}
            title="How to Add Job Searches in First 2 Fetch"
          ></iframe>
        </div>
        <script src="https://player.vimeo.com/api/player.js"></script>
      </div>
    </section>
  );
}
