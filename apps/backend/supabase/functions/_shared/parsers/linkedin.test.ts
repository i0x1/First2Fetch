import { SiteProvider, WebPageRuntimeData } from '@first2apply/core';

import { ILogger } from '../logger.ts';
import { parseLinkedInJobs } from './linkedin.ts';

const logger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  addMeta: () => {},
  flush: () => {},
};

const uuid = '11111111-2222-3333-4444-555555555555';

function jobCard({
  componentKey,
  reactContext,
  trackingScope = false,
}: {
  componentKey: string;
  reactContext?: string;
  trackingScope?: boolean;
}) {
  const contextAttr = reactContext ? ` f2a-react-context='${reactContext}'` : '';

  return `
    <div role="button" componentkey="${componentKey}">
      <div componentkey="${componentKey}"${contextAttr}>
        <div>
          <div>
            <div>
              <div>
                <div>
                  <div>
                    <p><span aria-hidden="true">Senior Engineer (Verified job)</span></p>
                  </div>
                  <div><p>Acme</p></div>
                  <p>Remote</p>
                </div>
              </div>
            </div>
            <div><div><p>$120k/yr</p></div></div>
            ${trackingScope ? '<div data-view-tracking-scope="[]"></div>' : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

function htmlForSearchResults({
  card,
  rehydrationScript,
}: {
  card: string;
  rehydrationScript?: string;
}) {
  return `
    <html>
      <body>
        ${rehydrationScript ? `<script id="rehydrate-data">${rehydrationScript}</script>` : ''}
        <div componentkey="SearchResultsMainContent">${card}</div>
      </body>
    </html>
  `;
}

function rehydrationScript({ componentKey, jobId }: { componentKey: string; jobId: string }) {
  return `window.__como_rehydration__ = ['{"componentKey":"${componentKey}"} JobCardFrameworkImplDismissedState_${jobId}'];`;
}

Deno.test('parseLinkedInJobs parses V5 AI result cards', () => {
  const result = parseLinkedInJobs({
    siteId: 10,
    html: htmlForSearchResults({
      card: jobCard({ componentKey: 'job-card-component-ref-12345' }),
    }),
    logger,
  });

  if (!result.listFound) throw new Error('Expected list to be found');
  if (result.jobs[0]?.externalId !== '12345') throw new Error(`Unexpected externalId: ${result.jobs[0]?.externalId}`);
  if (result.jobs[0]?.title !== 'Senior Engineer') throw new Error(`Unexpected title: ${result.jobs[0]?.title}`);
});

Deno.test('parseLinkedInJobs parses logged-in LinkedIn cards with title text fallback', () => {
  const result = parseLinkedInJobs({
    siteId: 10,
    html: `
      <html>
        <body>
          <ul>
            <li data-occludable-job-id="4415178113">
              <div data-job-id="4415178113">
                <a class="job-card-list__title--link" href="/jobs/view/4415178113/" aria-label="Frontend Developer with verification">
                  Frontend Developer
                </a>
                <div class="artdeco-entity-lockup__subtitle"><span>Acme</span></div>
                <div class="artdeco-entity-lockup__caption">San Francisco Bay Area (Hybrid)</div>
              </div>
            </li>
          </ul>
        </body>
      </html>
    `,
    logger,
  });

  if (!result.listFound) throw new Error('Expected list to be found');
  if (result.jobs[0]?.externalId !== '4415178113') {
    throw new Error(`Unexpected externalId: ${result.jobs[0]?.externalId}`);
  }
  if (result.jobs[0]?.title !== 'Frontend Developer') throw new Error(`Unexpected title: ${result.jobs[0]?.title}`);
  if (result.jobs[0]?.companyName !== 'Acme') throw new Error(`Unexpected company: ${result.jobs[0]?.companyName}`);
});

Deno.test('parseLinkedInJobs prefers V5 cards over broad tracking-scope nodes', () => {
  const result = parseLinkedInJobs({
    siteId: 10,
    html: htmlForSearchResults({
      card: jobCard({ componentKey: 'job-card-component-ref-12345', trackingScope: true }),
    }),
    logger,
  });

  if (!result.listFound) throw new Error('Expected list to be found');
  if (result.jobs[0]?.externalId !== '12345') throw new Error(`Unexpected externalId: ${result.jobs[0]?.externalId}`);
  if (result.jobs[0]?.title !== 'Senior Engineer') throw new Error(`Unexpected title: ${result.jobs[0]?.title}`);
});

Deno.test('parseLinkedInJobs maps V6 cards from DOM rehydration data', () => {
  const result = parseLinkedInJobs({
    siteId: 10,
    html: htmlForSearchResults({
      card: jobCard({ componentKey: uuid }),
      rehydrationScript: rehydrationScript({ componentKey: uuid, jobId: '45678' }),
    }),
    logger,
  });

  if (!result.listFound) throw new Error('Expected list to be found');
  if (result.jobs[0]?.externalId !== '45678') throw new Error(`Unexpected externalId: ${result.jobs[0]?.externalId}`);
});

Deno.test('parseLinkedInJobs maps V6 cards from runtime rehydration data', () => {
  const webPageRuntimeData: WebPageRuntimeData = {
    linkedin: {
      type: SiteProvider.linkedin,
      comoRehydration: rehydrationScript({ componentKey: uuid, jobId: '56789' }),
    },
  };

  const result = parseLinkedInJobs({
    siteId: 10,
    html: htmlForSearchResults({ card: jobCard({ componentKey: uuid }) }),
    webPageRuntimeData,
    logger,
  });

  if (!result.listFound) throw new Error('Expected list to be found');
  if (result.jobs[0]?.externalId !== '56789') throw new Error(`Unexpected externalId: ${result.jobs[0]?.externalId}`);
});

Deno.test('parseLinkedInJobs maps V6 cards from React context fallback', () => {
  const result = parseLinkedInJobs({
    siteId: 10,
    html: htmlForSearchResults({
      card: jobCard({
        componentKey: uuid,
        reactContext: '[{"value":"JobCardFrameworkImplFooterState_67890"}]',
        trackingScope: true,
      }),
    }),
    logger,
  });

  if (!result.listFound) throw new Error('Expected list to be found');
  if (result.jobs[0]?.externalId !== '67890') throw new Error(`Unexpected externalId: ${result.jobs[0]?.externalId}`);
});

Deno.test('parseLinkedInJobs parses currentJobId anchor cards', () => {
  const result = parseLinkedInJobs({
    siteId: 10,
    html: `
      <html>
        <body>
          <a href="https://www.linkedin.com/jobs/search/?currentJobId=4415178113">More</a>
          <a href="https://www.linkedin.com/jobs/search-results/?keywords=Software+Engineer&currentJobId=4397453584">
            <p>
              <span>Software Engineer II (Verified job)</span>
              <span aria-hidden="true">Software Engineer II</span>
            </p>
            <p>Microsoft</p>
            <p>•</p>
            <p>United States (Remote)</p>
            <p>14 connections work here</p>
            <p>Promoted</p>
          </a>
        </body>
      </html>
    `,
    logger,
  });

  if (!result.listFound) throw new Error('Expected list to be found');
  if (result.elementsCount !== 1) throw new Error(`Unexpected element count: ${result.elementsCount}`);
  if (result.jobs[0]?.externalId !== '4397453584') {
    throw new Error(`Unexpected externalId: ${result.jobs[0]?.externalId}`);
  }
  if (result.jobs[0]?.externalUrl !== 'https://www.linkedin.com/jobs/view/4397453584') {
    throw new Error(`Unexpected externalUrl: ${result.jobs[0]?.externalUrl}`);
  }
  if (result.jobs[0]?.title !== 'Software Engineer II') throw new Error(`Unexpected title: ${result.jobs[0]?.title}`);
  if (result.jobs[0]?.companyName !== 'Microsoft') {
    throw new Error(`Unexpected company: ${result.jobs[0]?.companyName}`);
  }
  if (result.jobs[0]?.location !== 'United States') {
    throw new Error(`Unexpected location: ${result.jobs[0]?.location}`);
  }
  if (result.jobs[0]?.jobType !== 'remote') throw new Error(`Unexpected job type: ${result.jobs[0]?.jobType}`);
});

Deno.test('parseLinkedInJobs skips non-job scaffold list items and falls back to generic job view anchors', () => {
  const result = parseLinkedInJobs({
    siteId: 10,
    html: `
      <html>
        <body>
          <div class="scaffold-layout__list">
            <ul>
              <li>Filter chip</li>
              <li>
                <div class="new-card-wrapper">
                  <a href="/jobs/view/4415178113/?refId=abc" aria-label="Product Engineer with verification">
                    Product Engineer
                  </a>
                  <div class="job-card-container__primary-description">Acme</div>
                  <div class="job-card-container__metadata-item">United States (Remote)</div>
                  <div>Promoted</div>
                </div>
              </li>
            </ul>
          </div>
        </body>
      </html>
    `,
    logger,
  });

  if (!result.listFound) throw new Error('Expected list to be found');
  if (result.elementsCount !== 1) throw new Error(`Unexpected element count: ${result.elementsCount}`);
  if (result.jobs[0]?.externalId !== '4415178113') {
    throw new Error(`Unexpected externalId: ${result.jobs[0]?.externalId}`);
  }
  if (result.jobs[0]?.title !== 'Product Engineer') throw new Error(`Unexpected title: ${result.jobs[0]?.title}`);
  if (result.jobs[0]?.companyName !== 'Acme') {
    throw new Error(`Unexpected company: ${result.jobs[0]?.companyName}`);
  }
  if (result.jobs[0]?.location !== 'United States') {
    throw new Error(`Unexpected location: ${result.jobs[0]?.location}`);
  }
  if (result.jobs[0]?.jobType !== 'remote') throw new Error(`Unexpected job type: ${result.jobs[0]?.jobType}`);
});
