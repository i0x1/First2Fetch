const COMPANY_INPUT_SEPARATORS = /[,;\n\r|]+|\t+/;

const LIST_MARKER_RE = /^[\s•\-–—*]+|^\d+[.)]\s*/;

export const MAX_COMPANY_NAME_LENGTH = 100;

/**
 * Split pasted or typed text into individual company names.
 * Supports commas, semicolons, newlines, pipes, and tabs.
 */
export function parseCompanyInput(input: string): string[] {
  return input
    .split(COMPANY_INPUT_SEPARATORS)
    .map((part) => part.replace(LIST_MARKER_RE, '').trim())
    .filter((part) => part.length > 0)
    .map((part) => (part.length > MAX_COMPANY_NAME_LENGTH ? part.slice(0, MAX_COMPANY_NAME_LENGTH) : part));
}

export function companyListHas(companies: string[], candidate: string): boolean {
  const key = candidate.toLowerCase();
  return companies.some((company) => company.toLowerCase() === key);
}

export function filterCompanyFromList(companies: string[], candidate: string): string[] {
  const key = candidate.toLowerCase();
  return companies.filter((company) => company.toLowerCase() !== key);
}

/**
 * Merge new company names into a list without duplicates (case-insensitive).
 */
export function mergeUniqueCompanies(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing.map((company) => company.toLowerCase()));
  const merged = [...existing];

  for (const raw of incoming) {
    for (const company of parseCompanyInput(raw)) {
      const key = company.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(company);
      }
    }
  }

  return merged;
}

/**
 * Normalize an array that may contain combined multi-value strings.
 */
export function normalizeCompanyList(companies: string[]): string[] {
  return mergeUniqueCompanies([], companies);
}
