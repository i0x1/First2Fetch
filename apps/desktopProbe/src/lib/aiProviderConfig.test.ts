import { describe, expect, it } from 'vitest';

import { getProviderOptions, getProviderModels, resolveTaskAiConfig } from './aiProviderConfig';

describe('TypeSafe task selection', () => {
  it('shows Jev only for the JD filter and restores a saved Jev selection', () => {
    expect(getProviderOptions('jd_filter').some((provider) => provider.value === 'typesafe')).toBe(true);
    expect(getProviderOptions('job_list').some((provider) => provider.value === 'typesafe')).toBe(false);
    expect(getProviderOptions('jd_parse').some((provider) => provider.value === 'typesafe')).toBe(false);
    expect(Object.keys(getProviderModels('typesafe', 'job_list'))).toHaveLength(0);
    expect(resolveTaskAiConfig({ ai_jd_filter_provider: 'typesafe', ai_jd_filter_model: 'jev-1.13.0' }, 'jd_filter'))
      .toEqual({ provider: 'typesafe', model: 'jev-1.13.0' });
  });
});
