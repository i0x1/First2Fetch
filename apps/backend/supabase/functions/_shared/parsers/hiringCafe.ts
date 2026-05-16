import { DOMParser, Element } from 'https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts';

import { JobSiteParseResult, ParsedJob } from './parserTypes.ts';

/**
 * Method used to parse a hiring.cafe job page.
 */
export function parseHiringCafeJobs({ siteId, html }: { siteId: number; html: string }): JobSiteParseResult {
  const document = new DOMParser().parseFromString(html, 'text/html');
  if (!document) throw new Error('Could not parse html');

  // Find all job posting links - each card has exactly one "/viewjob/" link.
  const allJobLinks = Array.from(document.querySelectorAll('a[href^="/viewjob/"]')) as Element[];

  if (allJobLinks.length === 0) {
    // Detect if the page structure was recognized at all (app shell loaded).
    const hasAppShell = !!document.querySelector('a[href*="/company/"]');
    return {
      jobs: [],
      listFound: hasAppShell,
      elementsCount: 0,
    };
  }

  const seenHrefs = new Set<string>();
  const jobLinks = allJobLinks.filter((link) => {
    const href = link.getAttribute('href') ?? '';
    if (seenHrefs.has(href)) return false;
    seenHrefs.add(href);
    return true;
  });

  const jobs = jobLinks.map((link): ParsedJob | null => {
    const href = link.getAttribute('href')?.trim();
    if (!href) return null;

    const externalId = href.replace('/viewjob/', '').trim();
    if (!externalId) return null;

    const externalUrl = `https://hiring.cafe${href}`;
    const card = link.parentElement?.parentElement?.parentElement?.parentElement;
    if (!card) return null;

    const title = card.querySelector('span[class*="text-start"]')?.textContent?.trim();
    if (!title) return null;

    const companyName = card.querySelector('picture > img')?.getAttribute('alt')?.trim();
    if (!companyName) return null;

    const companyLogo = card.querySelector('picture > img')?.getAttribute('src')?.trim() || undefined;
    const location = card.querySelector('[class*="bg-gray-50"] span')?.textContent?.trim() || undefined;

    const tagElements = Array.from(card.querySelectorAll('[class*="gap-1"] > span')) as Element[];
    const salary = tagElements.find((el) => (el.getAttribute('class') ?? '').includes('green'))?.textContent?.trim();
    const workplaceTag = tagElements
      .find((el) => (el.getAttribute('class') ?? '').includes('cyan'))
      ?.textContent?.trim()
      ?.toLowerCase();

    const tags = tagElements
      .filter((el) => {
        const classes = el.getAttribute('class') ?? '';
        return !classes.includes('green') && !classes.includes('cyan');
      })
      .map((el) => el.textContent?.trim() || '')
      .filter(Boolean);

    let jobType: ParsedJob['jobType'];
    if (workplaceTag === 'remote') jobType = 'remote';
    else if (workplaceTag?.includes('hybrid')) jobType = 'hybrid';
    else if (workplaceTag) jobType = 'onsite';

    return {
      siteId,
      externalId,
      externalUrl,
      title,
      companyName,
      companyLogo,
      location,
      salary,
      jobType,
      labels: [],
      tags,
    };
  });

  const validJobs = jobs.filter((job): job is ParsedJob => !!job);

  return {
    jobs: validJobs,
    listFound: true,
    elementsCount: jobLinks.length,
  };
}
