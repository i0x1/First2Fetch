import { describe, expect, it } from 'vitest';

import { getJobDescriptionQuality, normalizeJobDescription } from '@first2apply/core';

describe('job description preservation', () => {
  it('normalizes line endings and excess blank lines without changing JD content', () => {
    expect(normalizeJobDescription('  Requirements\r\n\r\n\r\n- C++\r\n  ')).toBe('Requirements\n\n- C++');
  });

  it('does not remove negation, numbers, salary, or technical symbols', () => {
    const description = 'Do not require C# or .NET. Pay: $150,000–$180,000. 5+ years.';
    expect(normalizeJobDescription(description)).toBe(description);
  });

  it('marks absent, blocked, short, and usable descriptions separately', () => {
    expect(getJobDescriptionQuality('  ')).toBe('missing');
    expect(getJobDescriptionQuality('Please sign in to view this role.')).toBe('access_blocked');
    expect(getJobDescriptionQuality('Short but real JD.')).toBe('partial');
    expect(getJobDescriptionQuality('x'.repeat(300))).toBe('usable');
  });
});
