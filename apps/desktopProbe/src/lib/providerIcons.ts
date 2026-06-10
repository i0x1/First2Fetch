import type { JobSite } from '@first2apply/core';

import bestjobsIcon from '@/assets/provider-icons/bestjobs.png';
import builtinIcon from '@/assets/provider-icons/builtin.png';
import diceIcon from '@/assets/provider-icons/dice.png';
import echojobsIcon from '@/assets/provider-icons/echojobs.png';
import flexjobsIcon from '@/assets/provider-icons/flexjobs.png';
import glassdoorIcon from '@/assets/provider-icons/glassdoor.png';
import hiringCafeIcon from '@/assets/provider-icons/hiringcafe.png';
import indeedIcon from '@/assets/provider-icons/indeed.png';
import linkedinIcon from '@/assets/provider-icons/linkedin.png';
import naukriIcon from '@/assets/provider-icons/naukri.png';
import remoteioIcon from '@/assets/provider-icons/remoteio.png';
import remoteokIcon from '@/assets/provider-icons/remoteok.png';
import remotiveIcon from '@/assets/provider-icons/remotive.png';
import robertHalfIcon from '@/assets/provider-icons/roberthalf.png';
import talentIcon from '@/assets/provider-icons/talent.png';
import usaJobsIcon from '@/assets/provider-icons/usajobs.png';
import weworkremotelyIcon from '@/assets/provider-icons/weworkremotely.png';
import zipRecruiterIcon from '@/assets/provider-icons/ziprecruiter.png';

const PROVIDER_ICON_PATHS: Record<string, string> = {
  linkedin: linkedinIcon,
  indeed: indeedIcon,
  glassdoor: glassdoorIcon,
  remoteok: remoteokIcon,
  weworkremotely: weworkremotelyIcon,
  dice: diceIcon,
  flexjobs: flexjobsIcon,
  bestjobs: bestjobsIcon,
  echojobs: echojobsIcon,
  remotive: remotiveIcon,
  remoteio: remoteioIcon,
  builtin: builtinIcon,
  naukri: naukriIcon,
  robertHalf: robertHalfIcon,
  zipRecruiter: zipRecruiterIcon,
  usaJobs: usaJobsIcon,
  talent: talentIcon,
  hiringCafe: hiringCafeIcon,
};

export function getStoredProviderIconPath(site: Pick<JobSite, 'provider'>) {
  return PROVIDER_ICON_PATHS[site.provider];
}
