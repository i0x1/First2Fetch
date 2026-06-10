import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { JobsTable } from './jobsTable';

const baseJob = {
  id: 1,
  title: 'Product Designer',
  companyName: 'Northstar Labs',
  location: 'Remote',
  created_at: new Date().toISOString(),
  posted_at_raw: '2h ago',
  link_id: 1,
  siteId: 1,
  status: 'new' as const,
  externalUrl: 'https://example.com',
  description: '',
};

describe('JobsTable', () => {
  it('renders dense table rows with job metadata', () => {
    const { container } = render(
      <JobsTable
        label="Today"
        totalCount={1}
        jobs={[{ ...baseJob, companyLogo: 'https://logo.clearbit.com/northstar.com', user_id: 'u1', externalId: 'ext', updated_at: baseJob.created_at } as never]}
        selectedJobId={1}
        onSelect={vi.fn()}
        onArchive={vi.fn()}
        onRequestDelete={vi.fn()}
        siteLogos={{ 1: 'linkedin.png' }}
        siteMap={{ 1: { name: 'LinkedIn' } }}
        linksMap={new Map([[1, { id: 1, title: 'Remote Product Designer' } as never]])}
        isFavoriteCompany={() => true}
        isWatchedCompany={() => false}
      />,
    );

    expect(screen.getByText('Job / company')).toBeInTheDocument();
    expect(screen.getByText('Product Designer')).toBeInTheDocument();
    expect(screen.getByText('Northstar Labs')).toBeInTheDocument();
    expect(screen.getByText('Remote Product Designer')).toBeInTheDocument();
    expect(screen.getByTestId('job-row-1')).toBeInTheDocument();
    const images = [...container.querySelectorAll('img')];
    expect(images.some((image) => image.getAttribute('src') === 'linkedin.png')).toBe(true);
  });
});
