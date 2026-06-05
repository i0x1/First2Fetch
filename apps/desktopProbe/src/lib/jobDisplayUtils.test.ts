import { describe, expect, it } from 'vitest';

import {
  formatShortPosted,
  formatShortPostedWithFallback,
  formatShortRelativeTime,
  getCompanyInitials,
} from './jobDisplayUtils';

describe('getCompanyInitials', () => {
  it('returns two letters from multi-word company names', () => {
    expect(getCompanyInitials('Northstar Labs')).toBe('NL');
  });

  it('returns first two chars for single-word names', () => {
    expect(getCompanyInitials('CloudPeak')).toBe('CL');
  });

  it('returns ? for empty names', () => {
    expect(getCompanyInitials('')).toBe('?');
  });
});

describe('formatShortRelativeTime', () => {
  const now = new Date('2026-06-04T12:00:00Z');

  it('formats minutes', () => {
    expect(formatShortRelativeTime(new Date('2026-06-04T11:48:00Z'), now)).toBe('12m');
  });

  it('formats hours', () => {
    expect(formatShortRelativeTime(new Date('2026-06-04T08:00:00Z'), now)).toBe('4h');
  });

  it('formats days', () => {
    expect(formatShortRelativeTime(new Date('2026-06-01T12:00:00Z'), now)).toBe('3d');
  });
});

describe('formatShortPosted', () => {
  it('passes through short values', () => {
    expect(formatShortPosted('2h ago')).toBe('2h ago');
  });

  it('returns dash when missing', () => {
    expect(formatShortPosted(null)).toBe('—');
  });
});

describe('formatShortPostedWithFallback', () => {
  const now = new Date('2026-06-04T12:00:00Z');

  it('uses the captured posted text when available', () => {
    expect(formatShortPostedWithFallback('2h ago', '2026-06-03T12:00:00Z', now)).toBe('2h ago');
  });

  it('shows the found age as an older-than fallback when posted text is missing', () => {
    expect(formatShortPostedWithFallback(null, '2026-06-03T12:00:00Z', now)).toBe('1d+');
  });
});
