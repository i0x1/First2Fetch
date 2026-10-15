import { DOMParser, Element } from 'https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts';

import { JobSiteParseResult, ParsedJob } from '../parsers/parserTypes.ts';

const POSTED_AT_REGEX = /^(today|yesterday|just posted|\d+\s*[a-z]{1,8}\.?(?:\s*ago)?)$/i;
const SALARY_REGEX = /(?:[$€£]\s?\d|\d[\dkK]?\s?(?:-|to)\s?[$€£]?\d|per\s+(?:hour|year|month))/i;

function isSalaryText(text: string): boolean {
  return SALARY_REGEX.test(text);
}

/**
 * Method used to parse a dice job page.
 */
export function parseDiceJobs({ siteId, html }: { siteId: number; html: string }): JobSiteParseResult {
  const document = new DOMParser().parseFromString(html, 'text/html');
  if (!document) throw new Error('Could not parse html');

  // check if the list is empty first
  const noResultsNode =
    document.querySelector('.no-jobs-message') ?? document.querySelector("div[data-testid='job-search-no-results']");
  if (noResultsNode) {
    return {
      jobs: [],
      listFound: true,
      elementsCount: 0,
    };
  }

  const jobsList =
    document.querySelector('div[data-testid="job-search-split-view-card-list-scroll"] [role="list"]') ??
    document.querySelector('[role="list"][aria-label="Job search results"]') ??
    document.querySelector('[role="list"], [aria-label="Job search results"]');
  if (!jobsList) {
    return {
      jobs: [],
      listFound: false,
      elementsCount: 0,
    };
  }

  const jobElements = Array.from(jobsList.querySelectorAll('div[data-testid="job-card"]')) as Element[];

  const parseJob = (el: Element): ParsedJob | null => {
    const externalId = el.getAttribute('data-id')?.trim();
    if (!externalId) return null;

    const jobGuid = el.getAttribute('data-job-guid')?.trim();
    if (!jobGuid) return null;
    const externalUrl = `https://www.dice.com/job-detail/${jobGuid}`.trim();

    const title =
      el.querySelector('a[data-testid="job-search-job-detail-link"]')?.textContent?.trim() ??
      el.querySelector('.content > div')?.textContent?.trim();
    if (!title) return null;

    const companyLogo =
      el.querySelector('a[aria-label="Company Logo"] img')?.getAttribute('src')?.trim() ??
      el.querySelector('.header > span > a img')?.getAttribute('src')?.trim();

    const companyName =
      el.querySelector('p[data-testid="job-card-company-name"]')?.textContent?.trim() ??
      (companyLogo
        ? el.querySelector('.header > span > a:nth-child(2)')?.textContent?.trim()
        : el.querySelector('.header > span > p')?.textContent?.trim());
    if (!companyName) return null;

    const isModernCard = !!el.querySelector('a[data-testid="job-search-job-detail-link"]');
    const metaText = isModernCard
      ? (Array.from(el.querySelectorAll('p')) as Element[])
          .filter((p) => !p.getAttribute('id') && p.getAttribute('data-testid') !== 'job-card-company-name')
          .map((p) => p.textContent?.trim() || '')
          .find(Boolean)
      : undefined;
    const metaParts = (metaText?.split('•') ?? []).map((part) => part.trim()).filter(Boolean);
    const postedAtFromMeta = POSTED_AT_REGEX.test(metaParts.at(-1) ?? '') ? metaParts.pop() : undefined;
    const location =
      metaParts.join(' • ') || el.querySelector('.content > span > div > div')?.textContent?.trim() || undefined;
    const locationLower = location?.toLowerCase() ?? '';
    const jobType = locationLower.includes('remote') ? 'remote' : locationLower.includes('hybrid') ? 'hybrid' : 'onsite';

    const tags: string[] = [];
    const postedAt = el
      .querySelector('.content > span > div > div:nth-child(2) > div:nth-child(2)')
      ?.textContent.trim();
    if (postedAtFromMeta || postedAt) {
      tags.push(postedAtFromMeta || postedAt || '');
    }

    const otherTags = Array.from(el.querySelectorAll('div[aria-labelledby] > p, .content > div.box'))
      .map((el) => el.textContent?.trim() || '')
      .filter((t) => !!t);
    tags.push(...otherTags);

    const salaryTag =
      el.querySelector('div[aria-labelledby="salary-label"] > p')?.textContent?.trim() || tags.find(isSalaryText);
    if (salaryTag) {
      const salaryIndex = tags.indexOf(salaryTag);
      if (salaryIndex >= 0) tags.splice(salaryIndex, 1);
    }

    return {
      siteId,
      externalId,
      externalUrl,
      title,
      companyName,
      companyLogo,
      location,
      jobType,
      salary: salaryTag,
      labels: [],
      tags,
    };
  };

  const jobs = jobElements.map(parseJob);
  const validJobs = jobs.filter((job): job is ParsedJob => !!job);

  return {
    jobs: validJobs,
    listFound: true,
    elementsCount: jobElements.length,
  };
}
