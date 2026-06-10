import { createContext, useContext, useEffect, useState } from 'react';

import { listSites } from '@/lib/electronMainSdk';
import { getStoredProviderIconPath } from '@/lib/providerIcons';
import type { JobSite } from '@first2apply/core';

import { useError } from './error';
import { useSession } from './session';

/**
 * Context that stores supported sites.
 */
export const SitesContext = createContext<{
  isLoading: boolean;
  sites: JobSite[];
  siteLogos: Record<number, string | undefined>;
  siteMap: Record<number, JobSite>;
}>({ isLoading: true, sites: [], siteLogos: {}, siteMap: {} });

/**
 * Global hook used to access the supported sites.
 */
export const useSites = () => {
  const sites = useContext(SitesContext);
  if (sites === undefined) {
    throw new Error('useSites must be used within a SitesProvider');
  }
  return sites;
};

// Create a provider for the sites
export const SitesProvider = ({ children }: React.PropsWithChildren<{}>) => {
  const { handleError } = useError();
  const { isLoggedIn } = useSession();

  const [isLoading, setIsLoading] = useState(true);
  const [sites, setSites] = useState<JobSite[]>([]);

  // Load the job sites list on mount (only when logged in - RLS requires authenticated user)
  useEffect(() => {
    const asyncLoad = async () => {
      try {
        if (!isLoggedIn) {
          setSites([]);
          setIsLoading(false);
          return;
        }
        setSites(await listSites());
      } catch (error) {
        handleError({ error });
        setSites([]);
      } finally {
        setIsLoading(false);
      }
    };

    asyncLoad();
  }, [isLoggedIn]);

  const sanitizeLogoUrl = (url?: string | null) => {
    if (!url) {
      return undefined;
    }

    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : undefined;
    } catch {
      return undefined;
    }
  };

  const siteLogos = Object.fromEntries(
    sites.map((site) => [site.id, getStoredProviderIconPath(site) ?? sanitizeLogoUrl(site.logo_url)]),
  );
  const siteMap = Object.fromEntries(sites.map((site) => [site.id, site]));

  return (
    <SitesContext.Provider
      value={{
        isLoading,
        sites,
        siteLogos,
        siteMap,
      }}
    >
      {children}
    </SitesContext.Provider>
  );
};
