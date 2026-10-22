export type JobDescriptionQuality = 'usable' | 'partial' | 'missing' | 'access_blocked' | 'failed';

/** Normalize only storage noise. Keep wording, punctuation, headings, lists, and code intact. */
export function normalizeJobDescription(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value
    .replace(/\r\n?/g, '\n')
    .replaceAll('\u0000', '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalized || undefined;
}

/** Mark short descriptions for review instead of treating them as a valid negative signal. */
export function getJobDescriptionQuality(value: string | null | undefined): JobDescriptionQuality {
  const normalized = normalizeJobDescription(value);
  if (!normalized) return 'missing';
  if (/captcha|verify you are human|sign in to view|log in to view/i.test(normalized)) return 'access_blocked';
  return new TextEncoder().encode(normalized).length < 300 ? 'partial' : 'usable';
}
