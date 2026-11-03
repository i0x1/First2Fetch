import { parseGlassDoorJobs } from '../jobListParser.ts';

// Card markup taken from a real page dump after Glassdoor changed its hashed class names.
const CARD = `
  <li class="JobsList_jobListItem__wjTHv" data-jobid="1010305417592" data-test="jobListing">
    <div class="JobCard_jobCardWrapper___NFY7">
      <div class="jobCard JobCard_jobCardContent__Bbij_">
        <div class="EmployerProfile_profileContainer__FbmWc" id="job-employer-1010305417592">
          <div class="avatar_AvatarContainer__Bosk5"><img src="https://media.glassdoor.com/logo.png" alt="ATA Services Logo" /></div>
          <div class="EmployerProfile_employerNameContainer__Wt7K9">
            <span class="EmployerProfile_compactEmployerName__hAn5f">ATA Services</span>
            <span class="rating-single-star_RatingText__iRO_0">3.5</span>
          </div>
        </div>
        <a data-test="job-title" href="https://www.glassdoor.com/job-listing/data-analyst.htm?jl=1010305417592" id="job-title-1010305417592">Data Analyst</a>
        <div id="job-location-1010305417592">Kaneohe, HI</div>
      </div>
    </div>
  </li>`;

Deno.test('parseGlassDoorJobs parses cards regardless of hashed class suffixes', () => {
  const result = parseGlassDoorJobs({
    siteId: 1,
    html: `<ul class="JobsList_jobsList__lqjTr">${CARD}</ul>`,
  });

  const job = result.jobs[0];
  if (result.elementsCount !== 1 || !job) {
    throw new Error(`Glassdoor card was dropped: ${JSON.stringify(result)}`);
  }
  if (job.externalId !== '1010305417592' || job.title !== 'Data Analyst' || job.companyName !== 'ATA Services') {
    throw new Error(`Unexpected Glassdoor job: ${JSON.stringify(job)}`);
  }
  if (job.companyLogo !== 'https://media.glassdoor.com/logo.png' || job.location !== 'Kaneohe, HI') {
    throw new Error(`Unexpected Glassdoor metadata: ${JSON.stringify(job)}`);
  }
});
