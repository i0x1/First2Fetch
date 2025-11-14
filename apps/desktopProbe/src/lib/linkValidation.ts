/**
 * Validation utilities for job search links
 */

import { JobSite } from '@first2apply/core';
import { isValidUrl } from './urlUtils';

export interface LinkValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestedSite?: JobSite;
}

/**
 * Validate a job search URL against available job sites
 */
export function validateJobSearchUrl(
  url: string,
  availableSites: JobSite[],
  currentSiteId?: number
): LinkValidationResult {
  const result: LinkValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  // Basic URL validation
  if (!url || !url.trim()) {
    result.isValid = false;
    result.errors.push('URL is required');
    return result;
  }

  if (!isValidUrl(url)) {
    result.isValid = false;
    result.errors.push('Invalid URL format');
    return result;
  }

  try {
    const urlObj = new URL(url);
    
    // Check if URL uses HTTPS (recommended for security)
    if (urlObj.protocol !== 'https:') {
      result.warnings.push('Consider using HTTPS for better security');
    }

    // Find matching job site
    const matchingSites = availableSites.filter(site => 
      site.urls.some(siteUrl => {
        try {
          const siteUrlObj = new URL(siteUrl);
          return urlObj.hostname.toLowerCase().includes(siteUrlObj.hostname.toLowerCase()) ||
                 siteUrlObj.hostname.toLowerCase().includes(urlObj.hostname.toLowerCase());
        } catch {
          return false;
        }
      })
    );

    if (matchingSites.length === 0) {
      result.warnings.push(
        'This URL doesn\'t match any known job sites. Custom parsing may be required.'
      );
    } else if (matchingSites.length === 1) {
      const matchingSite = matchingSites[0];
      result.suggestedSite = matchingSite;
      
      // Check if site is deprecated
      if (matchingSite.deprecated) {
        result.isValid = false;
        result.errors.push(`${matchingSite.name} is deprecated and no longer supported`);
      }
      
      // Check if this is a different site than current
      if (currentSiteId && matchingSite.id !== currentSiteId) {
        result.warnings.push(
          `This URL appears to be from ${matchingSite.name}, which is different from the current site`
        );
      }
    } else {
      // Multiple matching sites
      result.warnings.push(
        `This URL matches multiple job sites: ${matchingSites.map(s => s.name).join(', ')}`
      );
      result.suggestedSite = matchingSites[0]; // Use the first match
    }

    // Check for common URL issues
    if (urlObj.pathname === '/' && urlObj.search === '') {
      result.warnings.push('This appears to be a homepage URL. Consider using a specific job search URL.');
    }

    // Check for search parameters
    if (urlObj.searchParams.size === 0) {
      result.warnings.push('No search parameters found. This may return very broad results.');
    }

    // Validate common search parameters
    const searchParams = Array.from(urlObj.searchParams.entries());
    const emptyParams = searchParams.filter(([key, value]) => !value.trim());
    
    if (emptyParams.length > 0) {
      result.warnings.push(
        `Empty search parameters found: ${emptyParams.map(([key]) => key).join(', ')}`
      );
    }

  } catch (error) {
    result.isValid = false;
    result.errors.push('Failed to parse URL');
  }

  return result;
}

/**
 * Get suggestions for improving a job search URL
 */
export function getUrlImprovementSuggestions(url: string): string[] {
  const suggestions: string[] = [];
  
  try {
    const urlObj = new URL(url);
    
    // Suggest adding common search parameters if missing
    const commonParams = ['q', 'query', 'keywords', 'location', 'l'];
    const hasSearchParam = commonParams.some(param => urlObj.searchParams.has(param));
    
    if (!hasSearchParam) {
      suggestions.push('Consider adding search keywords using parameters like "q" or "keywords"');
    }
    
    if (!urlObj.searchParams.has('location') && !urlObj.searchParams.has('l')) {
      suggestions.push('Consider adding a location parameter to narrow down results');
    }
    
    // Check for overly broad searches
    const queryParam = urlObj.searchParams.get('q') || urlObj.searchParams.get('query') || '';
    if (queryParam.length < 3) {
      suggestions.push('Consider using more specific search terms for better results');
    }
    
  } catch {
    // URL parsing failed, no suggestions
  }
  
  return suggestions;
}

/**
 * Clean and normalize a job search URL
 */
export function cleanJobSearchUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Remove common tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'fbclid', 'gclid', 'msclkid', '_ga', '_gid',
      'ref', 'referrer', 'source'
    ];
    
    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    // Sort parameters for consistency
    const sortedParams = new URLSearchParams();
    const paramEntries = Array.from(urlObj.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b));
    paramEntries.forEach(([key, value]) => {
      sortedParams.set(key, value);
    });
    
    urlObj.search = sortedParams.toString();
    
    return urlObj.toString();
  } catch {
    return url; // Return original if parsing fails
  }
}
