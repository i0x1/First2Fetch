import fs from 'fs';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const settingsDir = `/tmp/first2fetch-scanner-test-${process.pid}`;

vi.mock('electron', () => ({
  app: { getPath: () => `/tmp/first2fetch-scanner-test-${process.pid}` },
  powerSaveBlocker: { start: () => 1, stop: vi.fn() },
  Notification: class {},
}));

vi.mock('node-cron', () => ({ schedule: () => ({ stop: vi.fn() }) }));

vi.mock('./helpers', async (importOriginal) => ({
  ...await importOriginal<typeof import('./helpers')>(),
  waitRandomBetween: async () => {},
}));

import { JobScanner } from './jobScanner';

const sites = [
  { id: 1, provider: 'linkedin', incognito_support: false },
  { id: 2, provider: 'other', incognito_support: false },
];
const links = [
  { id: 11, site_id: 1, title: 'LinkedIn', url: 'https://www.linkedin.com/jobs/search/', scrape_failure_count: 0 },
  { id: 22, site_id: 2, title: 'Other', url: 'https://jobs.example.com/search', scrape_failure_count: 0 },
];
const jobs = [
  { id: 111, siteId: 1, title: 'LinkedIn job', externalUrl: 'https://www.linkedin.com/jobs/view/111', status: 'processing' },
  { id: 222, siteId: 2, title: 'Other job', externalUrl: 'https://jobs.example.com/222', status: 'processing' },
];

const scanners: JobScanner[] = [];
beforeAll(() => fs.mkdirSync(settingsDir, { recursive: true }));
afterEach(() => {
  for (const scanner of scanners.splice(0)) scanner.close();
  fs.rmSync(`${settingsDir}/settings.json`, { force: true });
});
afterAll(() => fs.rmSync(settingsDir, { recursive: true, force: true }));

function createScanner() {
  const loadUrl = vi.fn(async (_request: { url: string }) => jobs[1]);
  const downloader = { loadUrl, setLinkedInEnabled: vi.fn() };
  const api = {
    listLinks: vi.fn(async () => links),
    listSites: vi.fn(async () => sites),
    listJobs: vi.fn(async (_args?: { after?: string }) => ({ jobs, nextPageToken: undefined as string | undefined })),
    runPostScanHook: vi.fn(async () => {}),
    increaseScrapeFailureCount: vi.fn(async () => {}),
  };
  const scanner = new JobScanner({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    supabaseApi: api as never,
    normalHtmlDownloader: downloader as never,
    incognitoHtmlDownloader: downloader as never,
    onNavigate: vi.fn(),
    analytics: { trackEvent: vi.fn() } as never,
  });
  scanners.push(scanner);
  return { scanner, loadUrl, downloader, api };
}

describe('LinkedIn scan isolation', () => {
  it('keeps LinkedIn off in the normal scan and pending description queue', async () => {
    const { scanner, loadUrl } = createScanner();

    await scanner.scanAllLinks();

    expect(loadUrl.mock.calls.map(([request]) => request.url)).toEqual([
      'https://jobs.example.com/search',
      'https://jobs.example.com/222',
    ]);
    expect(scanner.getScannerStatus().linkedinEnabled).toBe(false);
    await expect(scanner.scanLink({ linkId: 11 })).rejects.toThrow('LinkedIn scanning is off');
  });

  it('scans LinkedIn only on its own schedule and excludes other descriptions', async () => {
    const { scanner, loadUrl, downloader } = createScanner();
    scanner.updateSettings({ ...scanner.getSettings(), linkedinScanIntervalMinutes: 120 });

    await scanner.scanLinkedInLinks();

    expect(loadUrl.mock.calls.map(([request]) => request.url)).toEqual([
      'https://www.linkedin.com/jobs/search/',
      'https://www.linkedin.com/jobs/view/111',
    ]);
    expect(downloader.setLinkedInEnabled).toHaveBeenCalledWith(true);
    expect(scanner.getScannerStatus().nextLinkedinScanTime).not.toBeNull();

    loadUrl.mockClear();
    await scanner.scanAllLinks();
    expect(loadUrl.mock.calls.map(([request]) => request.url)).toEqual([
      'https://jobs.example.com/search',
      'https://jobs.example.com/222',
    ]);
  });

  it('stops LinkedIn after selecting Off while other sites continue', async () => {
    const { scanner, loadUrl, downloader } = createScanner();
    scanner.updateSettings({ ...scanner.getSettings(), linkedinScanIntervalMinutes: 120 });
    scanner.updateSettings({ ...scanner.getSettings(), linkedinScanIntervalMinutes: undefined });

    await scanner.scanLinkedInLinks();
    await scanner.scanAllLinks();

    expect(loadUrl.mock.calls.map(([request]) => request.url)).toEqual([
      'https://jobs.example.com/search',
      'https://jobs.example.com/222',
    ]);
    expect(downloader.setLinkedInEnabled).toHaveBeenLastCalledWith(false);
    expect(scanner.getScannerStatus().nextLinkedinScanTime).toBeNull();
  });
});

it('pages through pending jobs and drains recent and older non-LinkedIn work', async () => {
  const { scanner, loadUrl, api } = createScanner();
  api.listJobs.mockImplementation(async ({ after }: { after?: string }) => after
    ? { jobs: [{ id: 333, siteId: 2, title: 'Older job', externalUrl: 'https://jobs.example.com/333', status: 'processing' }], nextPageToken: undefined }
    : { jobs, nextPageToken: 'next' });

  await scanner.drainPendingDescriptions();

  expect(api.listJobs).toHaveBeenCalledTimes(2);
  expect(loadUrl.mock.calls.map(([request]) => request.url)).toEqual([
    'https://jobs.example.com/222',
    'https://jobs.example.com/333',
  ]);
});

it('reserves half of each drain batch for old pending jobs', async () => {
  const { scanner, loadUrl, api } = createScanner();
  const pending = Array.from({ length: 60 }, (_, index) => ({
    id: 1000 + index,
    siteId: 2,
    title: `Job ${index}`,
    externalUrl: `https://jobs.example.com/${index}`,
    status: 'processing',
  }));
  api.listJobs.mockResolvedValue({ jobs: pending, nextPageToken: undefined });

  await scanner.drainPendingDescriptions();

  const urls = loadUrl.mock.calls.map(([request]) => request.url);
  expect(urls).toHaveLength(50);
  expect(urls).toContain('https://jobs.example.com/0');
  expect(urls).toContain('https://jobs.example.com/59');
  expect(urls).not.toContain('https://jobs.example.com/30');
});

it('marks a clicked description as high priority', async () => {
  const { scanner, loadUrl } = createScanner();
  await scanner.scanJobs([jobs[1] as never], undefined, 'high');
  expect(loadUrl).toHaveBeenCalledWith(expect.objectContaining({ priority: 'high' }));
});

it('shares one active description scan across background and clicked requests', async () => {
  const { scanner, loadUrl } = createScanner();
  let finish!: (job: typeof jobs[number]) => void;
  loadUrl.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));

  const background = scanner.scanJobs([jobs[1] as never]);
  const selected = scanner.scanJobs([jobs[1] as never], undefined, 'high');
  await vi.waitFor(() => expect(loadUrl).toHaveBeenCalledTimes(1));
  finish(jobs[1]);

  await Promise.all([background, selected]);
  expect(loadUrl).toHaveBeenCalledTimes(1);
});
