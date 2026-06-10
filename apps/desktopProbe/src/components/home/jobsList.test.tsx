import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { JobsList } from './jobsList';

vi.mock('@/hooks/sites', () => ({
  useSites: () => ({
    siteLogos: { 1: 'linkedin.png' },
    siteMap: { 1: { name: 'LinkedIn' } },
  }),
}));

vi.mock('@/hooks/links', () => ({
  useLinks: () => ({
    links: [{ id: 1, site_id: 1, title: 'Software Engineer search' }],
  }),
}));

const makeJob = (id: number, createdAt: string) =>
  ({
    id,
    title: `Software Engineer ${id}`,
    companyName: 'Acme',
    location: 'Remote',
    created_at: createdAt,
    posted_at_raw: '1h ago',
    link_id: 1,
    siteId: 1,
    status: 'new',
    externalUrl: 'https://example.com',
    description: 'Job description',
  }) as never;

describe('JobsList', () => {
  it('auto-opens and loads the newest available date', async () => {
    const onLoadMoreForDate = vi.fn();

    render(
      <JobsList
        dateSummaries={[
          { date_key: '2026-05-30', total_count: 2, favorite_count: 0 },
          { date_key: '2026-06-03', total_count: 1, favorite_count: 0 },
        ]}
        jobsByDate={{
          '2026-06-03': {
            jobs: [makeJob(1, '2026-06-03T12:00:00.000Z')],
            hasMore: false,
            isLoading: false,
          },
        }}
        selectedJobId={1}
        onLoadMoreForDate={onLoadMoreForDate}
        onSelect={vi.fn()}
        onArchive={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Software Engineer 1')).toBeInTheDocument();
    });
    expect(screen.queryByText('Select a date above to load jobs.')).not.toBeInTheDocument();
    expect(onLoadMoreForDate).not.toHaveBeenCalled();
  });

  it('resets to the newest date when tab summaries change', async () => {
    const onLoadMoreForDate = vi.fn();
    const { rerender } = render(
      <JobsList
        dateSummaries={[{ date_key: '2026-06-03', total_count: 1, favorite_count: 0 }]}
        jobsByDate={{
          '2026-06-03': {
            jobs: [makeJob(1, '2026-06-03T12:00:00.000Z')],
            hasMore: false,
            isLoading: false,
          },
        }}
        selectedJobId={1}
        onLoadMoreForDate={onLoadMoreForDate}
        onSelect={vi.fn()}
        onArchive={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Software Engineer 1')).toBeInTheDocument();
    });

    rerender(
      <JobsList
        dateSummaries={[{ date_key: '2026-05-22', total_count: 4, favorite_count: 0 }]}
        jobsByDate={{}}
        selectedJobId={null}
        onLoadMoreForDate={onLoadMoreForDate}
        onSelect={vi.fn()}
        onArchive={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(onLoadMoreForDate).toHaveBeenCalledWith('2026-05-22');
    });
    expect(screen.queryByText('Select a date above to load jobs.')).not.toBeInTheDocument();
  });
});
