import { describe, expect, it } from 'vitest';

import { formatScanInterval, parseCustomInterval } from './customBoardScanInterval';

describe('custom board interval input', () => {
  it('accepts whole minutes within range', () => {
    expect(parseCustomInterval(' 45 ')).toBe(45);
    expect(parseCustomInterval('15')).toBe(15);
    expect(parseCustomInterval('10080')).toBe(10080);
  });

  it('rejects blanks, fractions and out-of-range values', () => {
    expect(parseCustomInterval('')).toBeNull();
    expect(parseCustomInterval('7.5')).toBeNull();
    expect(parseCustomInterval('10')).toBeNull();
    expect(parseCustomInterval('20000')).toBeNull();
    expect(parseCustomInterval('abc')).toBeNull();
  });

  it('labels intervals readably', () => {
    expect(formatScanInterval(30)).toBe('Every 30 min');
    expect(formatScanInterval(60)).toBe('Every hour');
    expect(formatScanInterval(360)).toBe('Every 6 hours');
    expect(formatScanInterval(1440)).toBe('Every 24 hours');
    expect(formatScanInterval(90)).toBe('Every 90 min');
  });
});
