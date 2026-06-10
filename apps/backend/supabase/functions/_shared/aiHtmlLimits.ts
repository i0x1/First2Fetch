import { LLM_MAX_HTML_CHARS, LLM_MAX_JD_FILTER_DESCRIPTION_CHARS } from '@first2apply/core';

export type TruncateResult = {
  content: string;
  truncated: boolean;
  originalLength: number;
};

/**
 * Truncate HTML/markdown sent to the LLM to control cost and context limits on long runs.
 */
export function truncateHtmlForLlm(html: string, maxChars: number = LLM_MAX_HTML_CHARS): TruncateResult {
  const originalLength = html.length;
  if (originalLength <= maxChars) {
    return { content: html, truncated: false, originalLength };
  }

  const headChars = Math.floor(maxChars * 0.85);
  const tailChars = maxChars - headChars;
  const content =
    html.slice(0, headChars) +
    `\n\n<!-- [truncated ${originalLength - maxChars} characters for LLM context limit] -->\n\n` +
    html.slice(-tailChars);

  return { content, truncated: true, originalLength };
}

export function truncateJobDescriptionForFilter(description: string): TruncateResult {
  return truncateHtmlForLlm(description, LLM_MAX_JD_FILTER_DESCRIPTION_CHARS);
}
