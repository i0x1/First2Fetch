import { WebPageRuntimeData, getExceptionMessage } from '@first2apply/core';
import { BrowserWindow } from 'electron';
import { backOff } from 'exponential-backoff';

import { consumeRuntimeData, getLinkedinReactContextBuilder, installLinkedInCapture } from './browserHelpers';
import { sleep } from './helpers';
import { ILogger } from './logger';
import { WorkerQueue } from './workerQueue';

const KNOWN_AUTHWALLS = ['/authwall', '/login', '/checkpoint/'];
// A LinkedIn access challenge pauses LinkedIn scans for a cooldown instead of
// until the app restarts. Repeated challenges back off: 1h, 2h, 4h, capped at 8h.
const LINKEDIN_BLOCK_BASE_MS = 60 * 60 * 1000;
const LINKEDIN_BLOCK_MAX_MS = 8 * 60 * 60 * 1000;
let linkedInBlockedUntil = 0;
let linkedInBlockStrikes = 0;

function markLinkedInAccessBlocked() {
  // concurrent LinkedIn pages can hit the same challenge; count it once
  if (isLinkedInAccessBlocked()) return;
  linkedInBlockStrikes++;
  const cooldownMs = Math.min(LINKEDIN_BLOCK_BASE_MS * 2 ** (linkedInBlockStrikes - 1), LINKEDIN_BLOCK_MAX_MS);
  linkedInBlockedUntil = Date.now() + cooldownMs;
}

function markLinkedInAccessOk() {
  linkedInBlockStrikes = 0;
}

export function isLinkedInUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'linkedin.com' || host.endsWith('.linkedin.com');
  } catch {
    return false;
  }
}

export function isLinkedInAccessBlocked(now = Date.now()): boolean {
  return now < linkedInBlockedUntil;
}

/** When the current LinkedIn cooldown ends, or null when LinkedIn is not paused. */
export function getLinkedInAccessBlockedUntil(): Date | null {
  return isLinkedInAccessBlocked() ? new Date(linkedInBlockedUntil) : null;
}

/** Lift the cooldown for a user-requested scan. The backoff level is kept until a scan succeeds. */
export function clearLinkedInAccessBlock() {
  linkedInBlockedUntil = 0;
}

const CHALLENGE_TITLE_PATTERNS = [
  'just a moment',
  'security check',
  'attention required',
  'access denied',
  'verify you are human',
  'are you a robot',
  'captcha',
];

/**
 * Bot-protection interstitials (Cloudflare and similar) return a page with no job list.
 * Detect them by title so they are reported as an access challenge instead of a parser failure.
 */
export function isAccessChallengeTitle(title: string | undefined | null): boolean {
  const normalized = title?.toLowerCase().trim();
  if (!normalized) return false;
  return CHALLENGE_TITLE_PATTERNS.some((pattern) => normalized.startsWith(pattern) || normalized.includes(pattern));
}

export function isGlassdoorUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'glassdoor.com' || host.endsWith('.glassdoor.com');
  } catch {
    return false;
  }
}

// Glassdoor renders 30 cards per page and loads 30 more on each "Show more jobs" click.
const GLASSDOOR_MAX_LOAD_MORE_CLICKS = 5;

function getGlassdoorLoadMoreScript() {
  return `
    (async () => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const countCards = () => document.querySelectorAll('[data-test="jobListing"]').length;
      let clicks = 0;
      for (let i = 0; i < ${GLASSDOOR_MAX_LOAD_MORE_CLICKS}; i++) {
        const button = Array.from(document.querySelectorAll('button'))
          .find((b) => /^show more jobs$/i.test((b.innerText || '').trim()));
        if (!button) break;
        const before = countCards();
        button.scrollIntoView({ block: 'center' });
        button.click();
        // wait for new cards; stop if nothing arrives (end of results or a login wall)
        let waited = 0;
        while (countCards() <= before && waited < 8000) {
          await sleep(500);
          waited += 500;
        }
        if (countCards() <= before) break;
        clicks++;
        await sleep(800 + Math.floor(Math.random() * 700));
      }
      return clicks;
    })()
  `;
}

// compared against Error.message: getExceptionMessage returns the stack trace, which never matches
const NON_RETRYABLE_LOAD_ERRORS = ['rate limit exceeded', 'authwall', 'LinkedIn scanning is off'];

function isAuthwallUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return KNOWN_AUTHWALLS.some((authwall) => path.includes(authwall));
  } catch {
    return false;
  }
}

function getUrlSummary(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      path: parsed.pathname,
    };
  } catch {
    return {
      host: 'unknown',
      path: '',
    };
  }
}

/**
 * Wrapper over a headless window that can be used to download HTML.
 */
export class HtmlDownloader {
  private _isRunning = false;
  private _shutdownController = new AbortController();
  private _pool: BrowserWindowPool | undefined;
  private _logger: ILogger;
  private _numInstances: number;
  private _incognitoMode: boolean;
  private _linkedInEnabled = false;

  /**
   * Class constructor.
   */
  constructor({
    logger,
    numInstances,
    incognitoMode,
  }: {
    logger: ILogger;
    numInstances: number;
    incognitoMode: boolean;
  }) {
    this._logger = logger;
    this._numInstances = numInstances;
    this._incognitoMode = incognitoMode;
  }

  /**
   * Initialize the headless window.
   */
  init() {
    this._pool = new BrowserWindowPool(this._numInstances, this._incognitoMode, this._logger);
    this._shutdownController = new AbortController();
    this._isRunning = true;
  }

  getSession() {
    if (!this._pool) throw new Error('Pool not initialized');
    return this._pool.getSession();
  }

  setLinkedInEnabled(enabled: boolean) {
    this._linkedInEnabled = enabled;
  }

  private _checkLinkedInAccess(url: string) {
    if (!isLinkedInUrl(url)) return;
    if (!this._linkedInEnabled) throw new Error('LinkedIn scanning is off');
    if (isLinkedInAccessBlocked()) throw new Error('LinkedIn access challenge; scans paused until the cooldown ends');
  }

  /**
   * Load the HTML of a given URL with concurrency support.
   *
   * Capture HTML in a browser worker, then release the worker before calling
   * the parser. A failed parser callback can retry with the captured HTML.
   */
  async loadUrl<T>({
    url,
    scrollTimes = 3,
    callback,
    priority = 'normal',
  }: {
    url: string;
    scrollTimes?: number;
    priority?: 'normal' | 'high';
    callback: (_: {
      html: string;
      webPageRuntimeData: WebPageRuntimeData;
      maxRetries: number;
      retryCount: number;
    }) => Promise<T>;
  }): Promise<T> {
    if (!this._pool) throw new Error('Pool not initialized');
    this._checkLinkedInAccess(url);

    const captured = await this._pool.useBrowserWindow(async (window) => {
      this._checkLinkedInAccess(url);
      await this._loadUrl(window, url, scrollTimes);
      this._checkLinkedInAccess(url);
      if (isLinkedInUrl(window.webContents.getURL())) {
        await window.webContents.executeJavaScript(getLinkedinReactContextBuilder()).catch((error) => {
          this._logger.error(`Failed to inject LinkedIn React context fallback: ${getExceptionMessage(error)}`);
        });
      }
      const html: string = await window.webContents.executeJavaScript('document.documentElement.innerHTML');
      const webPageRuntimeData = consumeRuntimeData(window.webContents.getURL());
      return { html, webPageRuntimeData };
    }, priority);

    // Parsing and API calls can take much longer than navigation. Release the
    // browser before them so queued pages and user clicks can proceed.
    const maxRetries = 1;
    let retryCount = 0;
    return backOff(
      () => {
        this._checkLinkedInAccess(url);
        return callback({ ...captured, maxRetries, retryCount: retryCount++ });
      },
      {
        jitter: 'full',
        numOfAttempts: 1 + maxRetries,
        maxDelay: 5_000,
        startingDelay: 1_000,
        retry: () => this._isRunning && !isLinkedInUrl(url),
      },
    );
  }

  /**
   * Close the headless window.
   */
  async close() {
    this._isRunning = false;
    this._shutdownController.abort();
    return this._pool?.close();
  }

  /**
   * Load an URL and make sure to wait for the page to load.
   */
  private async _loadUrl(window: BrowserWindow, url: string, scrollTimes: number) {
    if (!this._isRunning) return '<html></html>';
    const isLinkedIn = isLinkedInUrl(url);
    this._checkLinkedInAccess(url);

    this._logger.debug('page load started', getUrlSummary(url));
    await backOff(
      async () => {
        this._checkLinkedInAccess(url);
        let statusCode: number | undefined;
        window.webContents.once('did-navigate', (event, url, httpResponseCode) => {
          statusCode = httpResponseCode;
        });
        await window.loadURL(url);

        // handle rate limits
        const title = await window.webContents.executeJavaScript('document.title');
        if (
          statusCode === 429 ||
          (isLinkedIn && (statusCode === 403 || statusCode === 999)) ||
          isAccessChallengeTitle(title)
        ) {
          this._logger.warn('page access challenge detected', { ...getUrlSummary(url), statusCode });
          if (isLinkedIn) markLinkedInAccessBlocked();
          throw new Error('rate limit exceeded');
        }

        const loadedUrl = window.webContents.getURL();
        if (isLinkedIn && isAuthwallUrl(loadedUrl)) {
          this._logger.warn('page load authwall detected', getUrlSummary(loadedUrl));
          markLinkedInAccessBlocked();
          throw new Error('authwall');
        }

        // scroll to bottom a few times to trigger infinite loading with human-like behavior
        for (let i = 0; i < scrollTimes; i++) {
          this._checkLinkedInAccess(url);
          // Random mouse movement
          if (i > 0) {
            const x = Math.floor(Math.random() * 800);
            const y = Math.floor(Math.random() * 600);
            window.webContents.sendInputEvent({ type: 'mouseMove', x, y });
            await sleep(200 + Math.floor(Math.random() * 300), this._shutdownController.signal);
          }

          await window.webContents.executeJavaScript(
            `
              (async () => {
                const sleep = (ms) => new Promise(r => setTimeout(r, ms));
                const elements = Array.from(document.querySelectorAll('*'))
                  .filter(el => el.scrollHeight > el.clientHeight);
                
                for (const el of elements) {
                   // Scroll to bottom in steps to simulate reading/scanning
                   const target = el.scrollHeight;
                   let current = el.scrollTop;
                   
                   // Don't scroll if already at bottom
                   if (Math.abs(current + el.clientHeight - target) < 10) continue;

                   // Scroll in chunks
                   while (current + el.clientHeight < target) {
                      const step = 300 + Math.floor(Math.random() * 400);
                      current = Math.min(current + step, target - el.clientHeight);
                      el.scrollTo({ top: current, behavior: 'smooth' });
                      await sleep(100 + Math.floor(Math.random() * 150));
                      
                      // Occasional longer pause
                      if (Math.random() > 0.9) await sleep(500);
                   }
                }
              })();
            `,
          );

          await sleep(2_000 + Math.floor(Math.random() * 2000), this._shutdownController.signal);

          // check if page was redirected to a login page
          const finalUrl = window.webContents.getURL();
          if (isAuthwallUrl(finalUrl)) {
            this._logger.warn('page load authwall detected', getUrlSummary(finalUrl));
            if (isLinkedIn) markLinkedInAccessBlocked();
            throw new Error('authwall');
          }
        }
      },
      {
        jitter: 'full',
        numOfAttempts: isLinkedIn ? 2 : 20,
        maxDelay: 10_000,
        retry: (error) => {
          // Access challenges require user action. Repeating the request adds load.
          return this._isRunning && (!isLinkedIn || !isLinkedInAccessBlocked()) && !NON_RETRYABLE_LOAD_ERRORS.includes(error instanceof Error ? error.message : String(error));
        },
      },
    );

    if (isLinkedIn) markLinkedInAccessOk();

    if (isGlassdoorUrl(url)) {
      // best effort: a failure here must not discard the cards that already loaded
      try {
        const clicks: number = await window.webContents.executeJavaScript(getGlassdoorLoadMoreScript());
        this._logger.debug('glassdoor load more completed', { ...getUrlSummary(url), clicks });
      } catch (error) {
        this._logger.warn(`glassdoor load more failed: ${getExceptionMessage(error)}`);
      }
    }

    this._logger.debug('page load completed', getUrlSummary(url));
  }
}

/**
 * Class used to manage a pool of headless windows.
 */
class BrowserWindowPool {
  private _pool: Array<{
    id: number;
    window: BrowserWindow;
    isAvailable: boolean;
  }> = [];
  private _queue: WorkerQueue;

  /**
   * Class constructor.
   */
  constructor(instances: number, incognitoMode: boolean, logger: ILogger) {
    for (let i = 0; i < instances; i++) {
      const window = new BrowserWindow({
        show: false,
        // set the window size
        width: 1600,
        height: 1200,
        webPreferences: {
          webSecurity: true,
          partition: incognitoMode ? `incognito` : `persist:scraper`,
        },
      });

      logger.debug('browser worker ready', { workerId: i, incognitoMode });

      // Suppress DevTools protocol warnings
      window.webContents.on(
        'console-message',
        (details: Electron.Event<Electron.WebContentsConsoleMessageEventParams>) => {
          const { message } = details;
          // Suppress Autofill protocol warnings
          if (
            message.includes('Autofill.enable') ||
            message.includes('Autofill.setAddresses') ||
            message.includes("wasn't found")
          ) {
            details.preventDefault();
            return;
          }
        },
      );

      // Attach the debugger for LinkedIn response capture.
      try {
        if (!window.webContents.debugger.isAttached()) {
          window.webContents.debugger.attach('1.3');
        }
        if (!incognitoMode) installLinkedInCapture(window.webContents);
      } catch (err) {
        logger.error(`Failed to attach response capture to window ${i}`, err);
      }

      this._pool.push({
        id: i,
        window,
        isAvailable: true,
      });
    }

    this._queue = new WorkerQueue(instances);
  }

  /**
   * Get an available window and use it.
   */
  async useBrowserWindow<T>(fn: (window: BrowserWindow) => Promise<T>, priority: 'normal' | 'high' = 'normal') {
    return this._queue.enqueue(() => {
      const worker = this._pool.find((w) => w.isAvailable);
      if (!worker) throw new Error('No available window found');
      worker.isAvailable = false;

      return fn(worker.window).finally(() => {
        worker.isAvailable = true;
      });
    }, priority);
  }

  getSession() {
    const first = this._pool[0];
    if (!first) throw new Error('No browser windows in pool');
    return first.window.webContents.session;
  }

  /**
   * Stop queued work and destroy the windows immediately. Active Electron
   * navigation and renderer JavaScript promises do not always settle when a
   * BrowserWindow is destroyed, so waiting for the queue to become idle can
   * keep app shutdown blocked until the quit timeout.
   */
  close() {
    this._queue.close();
    this._pool.forEach(({ window }) => {
      if (!window.isDestroyed()) window.destroy();
    });
  }
}
