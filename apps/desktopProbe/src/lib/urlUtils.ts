/**
 * Utility functions for URL manipulation and query parameter handling
 */

export interface QueryParam {
  key: string;
  value: string;
  originalKey: string; // Store original key for reference
}

/**
 * Parse URL and extract query parameters
 */
export function parseUrlQueryParams(url: string): {
  baseUrl: string;
  queryParams: QueryParam[];
  hash: string;
} {
  try {
    const urlObj = new URL(url);
    const queryParams: QueryParam[] = [];
    
    // Extract query parameters
    urlObj.searchParams.forEach((value, key) => {
      queryParams.push({
        key,
        value,
        originalKey: key,
      });
    });

    // Get base URL without query params and hash
    const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    const hash = urlObj.hash;

    return {
      baseUrl,
      queryParams,
      hash,
    };
  } catch (error) {
    // If URL parsing fails, return the original URL as base
    return {
      baseUrl: url,
      queryParams: [],
      hash: '',
    };
  }
}

/**
 * Reconstruct URL from base URL and query parameters
 */
export function buildUrlFromParams(
  baseUrl: string,
  queryParams: QueryParam[],
  hash: string = ''
): string {
  try {
    const urlObj = new URL(baseUrl);
    
    // Clear existing search params
    urlObj.search = '';
    
    // Add new query parameters
    queryParams.forEach(param => {
      if (param.key.trim() && param.value.trim()) {
        urlObj.searchParams.set(param.key.trim(), param.value.trim());
      }
    });

    // Add hash if present
    if (hash) {
      urlObj.hash = hash;
    }

    return urlObj.toString();
  } catch (error) {
    console.error('Error building URL:', error);
    return baseUrl;
  }
}

/**
 * Validate if URL is properly formatted
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get common job search query parameter names with user-friendly labels
 */
export function getCommonJobSearchParams(): Record<string, string> {
  return {
    'q': 'Search Query',
    'query': 'Search Query',
    'keywords': 'Keywords',
    'search': 'Search Terms',
    'title': 'Job Title',
    'location': 'Location',
    'l': 'Location',
    'where': 'Location',
    'city': 'City',
    'country': 'Country',
    'remote': 'Remote Work',
    'distance': 'Distance',
    'radius': 'Search Radius',
    'experience': 'Experience Level',
    'level': 'Experience Level',
    'seniority': 'Seniority Level',
    'salary': 'Salary',
    'pay': 'Pay Range',
    'compensation': 'Compensation',
    'company': 'Company',
    'employer': 'Employer',
    'industry': 'Industry',
    'sector': 'Sector',
    'department': 'Department',
    'category': 'Job Category',
    'type': 'Job Type',
    'employment_type': 'Employment Type',
    'contract': 'Contract Type',
    'fulltime': 'Full Time',
    'parttime': 'Part Time',
    'internship': 'Internship',
    'freelance': 'Freelance',
    'sort': 'Sort By',
    'sortby': 'Sort By',
    'order': 'Sort Order',
    'page': 'Page Number',
    'limit': 'Results Per Page',
    'per_page': 'Results Per Page',
    'offset': 'Results Offset',
    'start': 'Start Index',
    'posted': 'Date Posted',
    'date': 'Date Range',
    'age': 'Job Age',
    'since': 'Posted Since',
    'filter': 'Filter',
    'filters': 'Filters',
    'facet': 'Facet',
    'skill': 'Required Skills',
    'skills': 'Required Skills',
    'technology': 'Technology',
    'tech': 'Technology Stack',
    'language': 'Programming Language',
    'framework': 'Framework',
    'tool': 'Tools',
    'certification': 'Certifications',
    'degree': 'Education Level',
    'education': 'Education Requirements',
  };
}

/**
 * Get user-friendly label for a query parameter key
 */
export function getParamLabel(key: string): string {
  const commonParams = getCommonJobSearchParams();
  const lowerKey = key.toLowerCase();
  
  // Check for exact match first
  if (commonParams[lowerKey]) {
    return commonParams[lowerKey];
  }
  
  // Check for partial matches
  for (const [paramKey, label] of Object.entries(commonParams)) {
    if (lowerKey.includes(paramKey) || paramKey.includes(lowerKey)) {
      return label;
    }
  }
  
  // If no match found, return a formatted version of the key
  return key
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Suggest common query parameter keys based on input
 */
export function suggestParamKeys(input: string): string[] {
  const commonParams = getCommonJobSearchParams();
  const lowerInput = input.toLowerCase();
  
  if (!input.trim()) {
    // Return most common parameters when no input
    return ['q', 'location', 'experience', 'type', 'remote', 'salary'];
  }
  
  return Object.keys(commonParams)
    .filter(key => 
      key.toLowerCase().includes(lowerInput) || 
      commonParams[key].toLowerCase().includes(lowerInput)
    )
    .slice(0, 6); // Limit to 6 suggestions
}
