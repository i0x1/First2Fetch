import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ScannerStatusPage } from './scannerStatus';

vi.mock('./defaultLayout', () => ({
  DefaultLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/links', () => ({
  useLinks: () => ({
    links: [
      {
        id: 1,
        site_id: 10,
        title: 'Remote PM',
        url: 'https://example.com/jobs',
        user_id: 'user',
        created_at: '2026-06-04T00:00:00.000Z',
        last_scraped_at: '2026-06-04T10:00:00.000Z',
        scrape_failure_count: 0,
        scrape_failure_email_sent: false,
      },
    ],
  }),
}));

vi.mock('@/hooks/sites', () => ({
  useSites: () => ({
    siteLogos: { 10: '/provider-icons/linkedin.png' },
    siteMap: { 10: { id: 10, name: 'LinkedIn' } },
  }),
}));

vi.mock('@/lib/electronMainSdk', () => ({
  getScannerStatus: vi.fn(async () => ({
    isScanning: false,
    nextScanTime: null,
    nextLinkedinScanTime: null,
    cronRule: undefined,
    linkedinCronRule: undefined,
    currentJobs: [],
    logs: ['Scanner healthy'],
  })),
}));

describe('ScannerStatusPage', () => {
  it('renders scanner logs after loading without crashing', async () => {
    render(<ScannerStatusPage />);

    await waitFor(() => {
      expect(screen.getByText('Scanner Status')).toBeInTheDocument();
    });

    expect(screen.getByText('Boards Health')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
    expect(screen.getByText('Scanner healthy')).toBeInTheDocument();
  });
});
