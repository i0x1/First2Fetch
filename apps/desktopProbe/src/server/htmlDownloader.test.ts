import { expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ BrowserWindow: class {} }));

import { HtmlDownloader, isAccessChallengeTitle, isGlassdoorUrl, isLinkedInAccessBlocked, isLinkedInUrl } from './htmlDownloader';

it('checks LinkedIn Off again when a queued page gets a browser worker', async () => {
  const loadURL = vi.fn(async () => {});
  const window = {
    loadURL,
    webContents: {
      once: vi.fn(),
      executeJavaScript: vi.fn(async (script: string) => script === 'document.title' ? 'Jobs' : '<html></html>'),
      getURL: () => 'https://jobs.example.com/search',
    },
  };
  let releaseWorker!: () => void;
  const workerReady = new Promise<void>((resolve) => { releaseWorker = resolve; });
  const downloader = new HtmlDownloader({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
    numInstances: 1,
    incognitoMode: false,
  });
  (downloader as never as { _pool: unknown })._pool = {
    useBrowserWindow: async (useWindow: (window: unknown) => Promise<unknown>) => {
      await workerReady;
      return useWindow(window);
    },
  };
  (downloader as never as { _isRunning: boolean })._isRunning = true;

  downloader.setLinkedInEnabled(true);
  const queuedLinkedIn = downloader.loadUrl({
    url: 'https://www.linkedin.com/jobs/search/',
    scrollTimes: 0,
    callback: async () => 'LinkedIn loaded',
  });
  downloader.setLinkedInEnabled(false);
  releaseWorker();

  await expect(queuedLinkedIn).rejects.toThrow('LinkedIn scanning is off');
  expect(loadURL).not.toHaveBeenCalled();

  await expect(downloader.loadUrl({
    url: 'https://jobs.example.com/search',
    scrollTimes: 0,
    callback: async () => 'Other loaded',
  })).resolves.toBe('Other loaded');
  expect(loadURL).toHaveBeenCalledWith('https://jobs.example.com/search');
  expect(isLinkedInUrl('https://notlinkedin.com/jobs')).toBe(false);
});

it('stops LinkedIn after an access challenge and still loads another site', async () => {
  let currentUrl = '';
  const loadURL = vi.fn(async (url: string) => { currentUrl = url; });
  const window = {
    loadURL,
    webContents: {
      once: vi.fn(),
      executeJavaScript: vi.fn(async (script: string) => {
        if (script === 'document.title') return isLinkedInUrl(currentUrl) ? 'Just a Moment' : 'Jobs';
        return '<html></html>';
      }),
      getURL: () => currentUrl,
    },
  };
  const downloader = new HtmlDownloader({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
    numInstances: 1,
    incognitoMode: false,
  });
  (downloader as never as { _pool: unknown })._pool = {
    useBrowserWindow: async (useWindow: (window: unknown) => Promise<unknown>) => useWindow(window),
  };
  (downloader as never as { _isRunning: boolean })._isRunning = true;
  downloader.setLinkedInEnabled(true);

  await expect(downloader.loadUrl({
    url: 'https://www.linkedin.com/jobs/search/',
    scrollTimes: 0,
    callback: async () => 'LinkedIn loaded',
  })).rejects.toThrow('rate limit exceeded');
  expect(isLinkedInAccessBlocked()).toBe(true);

  await expect(downloader.loadUrl({
    url: 'https://jobs.example.com/search',
    scrollTimes: 0,
    callback: async () => 'Other loaded',
  })).resolves.toBe('Other loaded');
  expect(loadURL).toHaveBeenCalledTimes(2);
});

it('releases the browser worker before parsing the captured HTML', async () => {
  let workerBusy = false;
  const window = {
    loadURL: vi.fn(async () => {}),
    webContents: {
      once: vi.fn(),
      executeJavaScript: vi.fn(async (script: string) => script === 'document.title' ? 'Jobs' : '<html>Job</html>'),
      getURL: () => 'https://jobs.example.com/1',
    },
  };
  const downloader = new HtmlDownloader({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
    numInstances: 1,
    incognitoMode: false,
  });
  (downloader as never as { _pool: unknown })._pool = {
    useBrowserWindow: async (useWindow: (window: unknown) => Promise<unknown>) => {
      workerBusy = true;
      try { return await useWindow(window); } finally { workerBusy = false; }
    },
  };
  (downloader as never as { _isRunning: boolean })._isRunning = true;

  await downloader.loadUrl({
    url: 'https://jobs.example.com/1',
    scrollTimes: 0,
    callback: async ({ html }) => {
      expect(workerBusy).toBe(false);
      expect(html).toBe('<html>Job</html>');
    },
  });
});


it('recognises bot-protection challenge pages by title', () => {
  expect(isAccessChallengeTitle('Security Check - Indeed.com')).toBe(true);
  expect(isAccessChallengeTitle('Just a moment...')).toBe(true);
  expect(isAccessChallengeTitle('Attention Required! | Cloudflare')).toBe(true);
  expect(isAccessChallengeTitle('14,212 data analyst Jobs in United States | Glassdoor')).toBe(false);
  expect(isAccessChallengeTitle(undefined)).toBe(false);
});

it('loads more Glassdoor results and treats an Indeed challenge as a rate limit', async () => {
  expect(isGlassdoorUrl('https://www.glassdoor.com/Job/x.htm')).toBe(true);
  expect(isGlassdoorUrl('https://notglassdoor.com/')).toBe(false);

  const scripts: string[] = [];
  const window = {
    loadURL: vi.fn(async () => {}),
    webContents: {
      once: vi.fn(),
      executeJavaScript: vi.fn(async (script: string) => {
        scripts.push(script);
        if (script === 'document.title') return 'Jobs';
        if (script.includes('show more jobs')) return 2;
        return '<html></html>';
      }),
      getURL: () => 'https://www.glassdoor.com/Job/x.htm',
    },
  };
  const downloader = new HtmlDownloader({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
    numInstances: 1,
    incognitoMode: false,
  });
  (downloader as never as { _pool: unknown })._pool = {
    useBrowserWindow: async (use: (w: unknown) => Promise<unknown>) => use(window),
  };
  (downloader as never as { _isRunning: boolean })._isRunning = true;

  await downloader.loadUrl({ url: 'https://www.glassdoor.com/Job/x.htm', scrollTimes: 0, callback: async () => 'ok' });
  expect(scripts.some((s) => s.includes('show more jobs'))).toBe(true);

  (window.webContents.executeJavaScript as ReturnType<typeof vi.fn>).mockImplementation(async (script: string) =>
    script === 'document.title' ? 'Security Check - Indeed.com' : '<html></html>',
  );
  await expect(
    downloader.loadUrl({ url: 'https://www.indeed.com/jobs?q=x', scrollTimes: 0, callback: async () => 'ok' }),
  ).rejects.toThrow('rate limit exceeded');
});
