import { parseDiceJobs } from './dice.ts';

Deno.test('parseDiceJobs returns an empty result for the Dice no-results state', () => {
  const result = parseDiceJobs({
    siteId: 12,
    html: '<div data-testid="job-search-no-results">No jobs found</div>',
  });

  if (!result.listFound || result.elementsCount !== 0 || result.jobs.length !== 0) {
    throw new Error(`Unexpected no-results parse result: ${JSON.stringify(result)}`);
  }
});

Deno.test('parseDiceJobs reads modern Dice card fields and removes salary from tags', () => {
  const result = parseDiceJobs({
    siteId: 12,
    html: `
      <div data-testid="job-search-split-view-card-list-scroll">
        <div role="list">
          <div data-testid="job-card" data-id="abc" data-job-guid="guid-123">
            <a data-testid="job-search-job-detail-link">Senior Engineer</a>
            <p data-testid="job-card-company-name">Example Co</p>
            <a aria-label="Company Logo"><img src="https://example.test/logo.png" /></a>
            <p>Remote • 2d ago</p>
            <div aria-labelledby="salary-label"><p>$120,000 - $150,000 per year</p></div>
            <div aria-labelledby="employment-label"><p>Full-time</p></div>
          </div>
        </div>
      </div>
    `,
  });

  const job = result.jobs[0];
  if (!job || job.title !== 'Senior Engineer' || job.companyName !== 'Example Co') {
    throw new Error(`Modern Dice card was not parsed: ${JSON.stringify(result)}`);
  }
  if (job.jobType !== 'remote' || job.salary !== '$120,000 - $150,000 per year') {
    throw new Error(`Dice metadata was not parsed: ${JSON.stringify(job)}`);
  }
  if (job.tags.includes('$120,000 - $150,000 per year') || !job.tags.includes('Full-time')) {
    throw new Error(`Dice salary/tag separation failed: ${JSON.stringify(job.tags)}`);
  }
});
