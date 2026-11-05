import { parseIndeedJobs, parseNaukriJobs } from '../jobListParser.ts';

Deno.test('parseIndeedJobs reads company and location from data-testid without wrapper classes', () => {
  const result = parseIndeedJobs({
    siteId: 1,
    html: `<div id="mosaic-provider-jobcards"><ul>
      <li><h2 class="jobTitle"><a id="job_abc" data-jk="abc" href="/rc/clk?jk=abc"><span>Data Analyst</span></a></h2>
        <div class="css-xyz"><span data-testid="company-name">Acme</span><div data-testid="text-location">Remote in Austin, TX</div></div>
        <div class="salary-snippet-container">$80,000 - $100,000 a year</div></li>
      <li><h2 class="jobTitle"><a id="job_def" href="/rc/clk?jk=def"><span>Analyst</span></a></h2>
        <span data-testid="company-name">Beta</span><div class="salary-snippet-container">Competitive</div></li>
    </ul></div>`,
  });

  if (result.jobs.length !== 2 || result.elementsCount !== 2) {
    throw new Error(`Indeed cards were dropped: ${JSON.stringify(result)}`);
  }
  const [first, second] = result.jobs;
  if (first.externalId !== 'job_abc' || first.companyName !== 'Acme' || first.jobType !== 'remote') {
    throw new Error(`Unexpected Indeed job: ${JSON.stringify(first)}`);
  }
  if (first.salary !== '$80k - $100k') throw new Error(`Unexpected salary: ${first.salary}`);
  if (second.salary?.includes('NaN')) throw new Error(`Salary produced NaN: ${second.salary}`);
  if (first.externalUrl !== 'https://www.indeed.com/viewjob?jk=abc') throw new Error(`Unexpected URL: ${first.externalUrl}`);
  if (second.externalUrl !== 'https://www.indeed.com/viewjob?jk=def') throw new Error(`Unexpected URL: ${second.externalUrl}`);
});

Deno.test('parseIndeedJobs saves sponsored cards as the plain job page and keeps the job ID', () => {
  const result = parseIndeedJobs({
    siteId: 1,
    html: `<div id="mosaic-provider-jobcards"><ul>
      <li><h2 class="jobTitle"><a id="sj_9f8e" data-jk="xyz123" href="/pagead/clk?mo=r&ad=-6NYlbfk"><span>AI Engineer</span></a></h2>
        <span data-testid="company-name">Gamma</span></li>
      <li><h2 class="jobTitle"><a id="job_nokey" href="/company/acme/jobs/AI-Engineer-123"><span>AI Engineer</span></a></h2>
        <span data-testid="company-name">Acme</span></li>
    </ul></div>`,
  });
  const [sponsored, noKey] = result.jobs;
  if (sponsored.externalId !== 'sj_9f8e') throw new Error(`Job ID changed: ${sponsored.externalId}`);
  if (sponsored.externalUrl !== 'https://www.indeed.com/viewjob?jk=xyz123') {
    throw new Error(`Unexpected sponsored URL: ${sponsored.externalUrl}`);
  }
  if (noKey.externalUrl !== 'https://www.indeed.com/company/acme/jobs/AI-Engineer-123') {
    throw new Error(`Link without a job key should be kept: ${noKey.externalUrl}`);
  }
});

Deno.test('parseNaukriJobs detects the no-results state regardless of the hashed class suffix', () => {
  const result = parseNaukriJobs({
    siteId: 1,
    html: '<div class="styles_no-result-container__AbCd1">No jobs</div>',
  });
  if (!result.listFound || result.jobs.length !== 0) throw new Error(JSON.stringify(result));
});
