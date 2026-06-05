import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JobFilters } from './jobFilters';

vi.mock('@/hooks/sites', () => ({
  useSites: () => ({
    siteLogos: {},
    sites: [] as Array<{ id: number; name: string }>,
  }),
}));

vi.mock('@/hooks/links', () => ({
  useLinks: () => ({
    links: [] as Array<{ id: number; site_id: number; title: string }>,
  }),
}));

const defaultProps = {
  search: '',
  siteIds: [] as number[],
  linkIds: [] as number[],
  labels: [] as string[],
  hideReposted: false,
  listingCounts: { new: 10, applied: 2, archived: 1, filtered: 3 },
  onStatusChange: vi.fn(),
  onSearchJobs: vi.fn(),
  viewMode: 'split' as const,
  onViewModeChange: vi.fn(),
};

describe('JobFilters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not emit a debounced search when only the status tab changes', () => {
    const appliedSearch = vi.fn();
    const archivedSearch = vi.fn();
    const { rerender } = render(
      <JobFilters {...defaultProps} status="applied" onSearchJobs={appliedSearch} />,
    );

    rerender(<JobFilters {...defaultProps} status="archived" onSearchJobs={archivedSearch} />);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(appliedSearch).not.toHaveBeenCalled();
    expect(archivedSearch).not.toHaveBeenCalled();
  });

  it('still emits a debounced search when the user types', () => {
    const onSearchJobs = vi.fn();
    render(<JobFilters {...defaultProps} status="new" onSearchJobs={onSearchJobs} />);

    fireEvent.change(screen.getByPlaceholderText('Search title or company...'), {
      target: { value: 'designer' },
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onSearchJobs).toHaveBeenCalledWith({
      search: 'designer',
      filters: { sites: [], links: [], labels: [], hideReposted: false },
    });
  });
});
