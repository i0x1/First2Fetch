import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ScannerStatusPage } from './scannerStatus';
import { getScannerStatus, scanLinkedInNow, scanOtherSitesNow } from '@/lib/electronMainSdk';

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

vi.mock('@/hooks/error', () => ({ useError: () => ({ handleError: vi.fn() }) }));

vi.mock('@/lib/electronMainSdk', () => ({
  getScannerStatus: vi.fn(async () => ({
    isScanning: false,
    nextScanTime: null,
    nextLinkedinScanTime: null,
    cronRule: undefined,
    linkedinCronRule: undefined,
    linkedinEnabled: false,
    linkedinAccessBlocked: false,
    isLinkedinScanning: false,
    isOtherScanning: false,
    lastLinkedinScanTime: null,
    lastOtherScanTime: null,
    currentJobs: [],
    logs: ['Scanner healthy'],
  })),
  scanLinkedInNow: vi.fn(async () => {}),
  scanOtherSitesNow: vi.fn(async () => {}),
}));

describe('ScannerStatusPage', () => {
  it('renders scanner logs after loading without crashing', async () => {
    render(<ScannerStatusPage />);

    await waitFor(() => {
      expect(screen.getByText('Scanner Status')).toBeInTheDocument();
    });

    expect(screen.getByText('Boards Health')).toBeInTheDocument();
    expect(screen.getAllByText('LinkedIn')).toHaveLength(2);
    expect(screen.getByText('Scanner healthy')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Scan other sites now' }));
    expect(scanOtherSitesNow).toHaveBeenCalledOnce();
  });

  it('shows a separate LinkedIn action when enabled', async () => {
    vi.mocked(getScannerStatus).mockResolvedValue({
      isScanning: false,
      nextScanTime: null,
      nextLinkedinScanTime: new Date(Date.now() + 120 * 60_000).toISOString(),
      cronRule: undefined,
      linkedinCronRule: 'Every 120 minutes',
      linkedinEnabled: true,
      linkedinAccessBlocked: false,
      isLinkedinScanning: false,
      isOtherScanning: false,
      lastLinkedinScanTime: null,
      lastOtherScanTime: null,
      currentJobs: [],
      logs: [],
    });
    render(<ScannerStatusPage />);

    const action = await screen.findByRole('button', { name: 'Scan LinkedIn now' });
    fireEvent.click(action);
    expect(scanLinkedInNow).toHaveBeenCalledOnce();
  });

  it('disables the LinkedIn action after an access challenge', async () => {
    vi.mocked(getScannerStatus).mockResolvedValue({
      isScanning: false,
      nextScanTime: null,
      nextLinkedinScanTime: null,
      cronRule: undefined,
      linkedinCronRule: 'Every 120 minutes',
      linkedinEnabled: true,
      linkedinAccessBlocked: true,
      isLinkedinScanning: false,
      isOtherScanning: false,
      lastLinkedinScanTime: null,
      lastOtherScanTime: null,
      currentJobs: [],
      logs: [],
    });
    render(<ScannerStatusPage />);

    expect(await screen.findByRole('button', { name: 'Scan LinkedIn now' })).toBeDisabled();
  });
});
