import { describe, expect, it } from 'vitest';

import { mergeUniqueCompanies, normalizeCompanyList, parseCompanyInput } from './companyListUtils';

describe('parseCompanyInput', () => {
  it('returns a single trimmed company', () => {
    expect(parseCompanyInput('  Google  ')).toEqual(['Google']);
  });

  it('splits comma-separated values', () => {
    expect(parseCompanyInput('Google, Microsoft, Apple')).toEqual(['Google', 'Microsoft', 'Apple']);
  });

  it('splits newline-separated values', () => {
    expect(parseCompanyInput('Google\nMicrosoft\nApple')).toEqual(['Google', 'Microsoft', 'Apple']);
  });

  it('splits mixed separators and list markers', () => {
    expect(parseCompanyInput('- Google\n- Microsoft; Apple|Meta')).toEqual(['Google', 'Microsoft', 'Apple', 'Meta']);
  });

  it('ignores empty segments', () => {
    expect(parseCompanyInput('Google,, , Microsoft')).toEqual(['Google', 'Microsoft']);
  });
});

describe('mergeUniqueCompanies', () => {
  it('deduplicates case-insensitively', () => {
    expect(mergeUniqueCompanies(['Google'], ['google', 'Microsoft'])).toEqual(['Google', 'Microsoft']);
  });

  it('splits combined strings before merging', () => {
    expect(mergeUniqueCompanies(['Google'], ['Microsoft, Apple'])).toEqual(['Google', 'Microsoft', 'Apple']);
  });
});

describe('normalizeCompanyList', () => {
  it('flattens combined entries in stored arrays', () => {
    expect(normalizeCompanyList(['Google, Microsoft', 'Apple'])).toEqual(['Google', 'Microsoft', 'Apple']);
  });
});
