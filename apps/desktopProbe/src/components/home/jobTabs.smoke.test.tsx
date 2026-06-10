import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { JobTabs } from './jobTabs';

vi.mock('./jobTabsContent', () => ({
  JobTabsContent: () => <div data-testid="job-tabs-content">Jobs content</div>,
}));

vi.mock('@/hooks/error', () => ({
  useError: () => ({ handleError: vi.fn() }),
}));

describe('JobTabs smoke', () => {
  it('renders without throwing when booting the jobs page shell', () => {
    expect(() =>
      render(
        <MemoryRouter initialEntries={['/']}>
          <JobTabs />
        </MemoryRouter>,
      ),
    ).not.toThrow();

    expect(screen.getByTestId('job-tabs-content')).toBeInTheDocument();
  });
});
