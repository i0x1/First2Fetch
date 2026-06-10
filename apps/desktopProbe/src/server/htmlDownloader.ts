import { WebPageRuntimeData, getExceptionMessage } from '@first2apply/core';
import { BrowserWindow } from 'electron';
import { backOff } from 'exponential-backoff';

import { consumeRuntimeData, getLinkedinReactContextBuilder } from './browserHelpers';
import { sleep, waitRandomBetween } from './helpers';
import { ILogger } from './logger';
import { WorkerQueue } from './workerQueue';

const KNOWN_AUTHWALLS = ['authwall', 'login'];

// Chrome User-Agents for anti-detection (safe change)
const CHROME_USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function getRandomUserAgent(): string {
  const isMac = process.platform === 'darwin';
  return isMac ? CHROME_USER_AGENTS[0] : CHROME_USER_AGENTS[1];
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
  private _pool: BrowserWindowPool | undefined;
  private _logger: ILogger;
  private _numInstances: number;
  private _incognitoMode: boolean;

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
    this._isRunning = true;
  }

  getSession() {
    if (!this._pool) throw new Error('Pool not initialized');
    return this._pool.getSession();
  }

  /**
   * Load the HTML of a given URL with concurrency support.
   *
   * Takes in a callback that will be called with the HTML content. Will be retried if it fails
   * with a new version of the window's HTML. Using a callback instead of returning the HTML directly
   * because we need to keep the window aquired until the callback is finished.
   */
  async loadUrl<T>({
    url,
    scrollTimes = 3,
    callback,
  }: {
    url: string;
    scrollTimes?: number;
    callback: (_: {
      html: string;
      webPageRuntimeData: WebPageRuntimeData;
      maxRetries: number;
      retryCount: number;
    }) => Promise<T>;
  }): Promise<T> {
    if (!this._pool) throw new Error('Pool not initialized');

    return this._pool.useBrowserWindow(async (window) => {
      await this._loadUrl(window, url, scrollTimes);

      const maxRetries = 1;
      let retryCount = 0;
      return backOff(
        async () => {
          if (window.webContents.getURL().includes('linkedin.com')) {
            await window.webContents.executeJavaScript(getLinkedinReactContextBuilder()).catch((error) => {
              this._logger.error(`Failed to inject LinkedIn React context fallback: ${getExceptionMessage(error)}`);
            });
          }

          const html: string = await window.webContents.executeJavaScript('document.documentElement.innerHTML');
          const finalUrl = window.webContents.getURL();
          const webPageRuntimeData = consumeRuntimeData(finalUrl);
          return callback({ html, webPageRuntimeData, maxRetries, retryCount: retryCount++ });
        },
        {
          jitter: 'full',
          numOfAttempts: 1 + maxRetries,
          maxDelay: 5_000,
          startingDelay: 1_000,
          retry: () => {
            // perform retries only if the window is still running
            return this._isRunning;
          },
        },
      );
    });
  }

  /**
   * Close the headless window.
   */
  async close() {
    this._isRunning = false;
    return this._pool?.close();
  }

  /**
   * Load an URL and make sure to wait for the page to load.
   */
  private async _loadUrl(window: BrowserWindow, url: string, scrollTimes: number) {
    if (!this._isRunning) return '<html></html>';

    this._logger.debug('page load started', getUrlSummary(url));
    await backOff(
      async () => {
        let statusCode: number | undefined;
        window.webContents.once('did-navigate', (event, url, httpResponseCode) => {
          statusCode = httpResponseCode;
        });
        await window.loadURL(url);

        // handle rate limits
        const title = await window.webContents.executeJavaScript('document.title');
        if (statusCode === 429 || title?.toLowerCase().startsWith('just a moment')) {
          this._logger.warn('page load rate limited', { ...getUrlSummary(url), statusCode });
          await waitRandomBetween(30_000, 60_000);
          throw new Error('rate limit exceeded');
        }

        // scroll to bottom a few times to trigger infinite loading with human-like behavior
        for (let i = 0; i < scrollTimes; i++) {
          // Random mouse movement
          if (i > 0) {
            const x = Math.floor(Math.random() * 800);
            const y = Math.floor(Math.random() * 600);
            window.webContents.sendInputEvent({ type: 'mouseMove', x, y });
            await sleep(200 + Math.floor(Math.random() * 300));
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

          await sleep(2_000 + Math.floor(Math.random() * 2000));

          // check if page was redirected to a login page
          const finalUrl = window.webContents.getURL();
          if (KNOWN_AUTHWALLS.some((authwall) => finalUrl?.includes(authwall))) {
            this._logger.warn('page load authwall detected', getUrlSummary(finalUrl));
            throw new Error('authwall');
          }
        }
      },
      {
        jitter: 'full',
        numOfAttempts: 20,
        maxDelay: 10_000,
        retry: () => {
          // perform retries only if the window is still running
          return this._isRunning;
        },
      },
    );

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

      // Set Chrome User-Agent instead of Electron default (safe anti-detection measure)
      const userAgent = getRandomUserAgent();
      window.webContents.setUserAgent(userAgent);
      logger.debug('browser worker ready', { workerId: i, incognitoMode });

      // Suppress DevTools protocol warnings
      window.webContents.on('console-message', (event, level, message) => {
        // Suppress Autofill protocol warnings
        if (
          message.includes('Autofill.enable') ||
          message.includes('Autofill.setAddresses') ||
          message.includes("wasn't found")
        ) {
          event.preventDefault();
          return;
        }
      });

      // Apply stealth scripts using debugger
      try {
        if (!window.webContents.debugger.isAttached()) {
          window.webContents.debugger.attach('1.3');
        }
        window.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
          source: `
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            if (!window.chrome) window.chrome = { runtime: {} };
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
              parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
            );
          `,
        });
      } catch (err) {
        logger.error(`Failed to apply stealth scripts to window ${i}`, err);
      }

      // disable LinkedIn's passkey request, because it triggers an annoying popup
      window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
        // if the request url matches the url which appears to be sending the passkey request
        if (details.url.includes('checkpoint/pk/initiateLogin')) {
          // never call the callback to block the request
        } else {
          callback({});
        }
      });

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
  async useBrowserWindow<T>(fn: (window: BrowserWindow) => Promise<T>) {
    return this._queue.enqueue(() => {
      const worker = this._pool.find((w) => w.isAvailable);
      if (!worker) throw new Error('No available window found');
      worker.isAvailable = false;

      return fn(worker.window).finally(() => {
        worker.isAvailable = true;
      });
    });
  }

  getSession() {
    const first = this._pool[0];
    if (!first) throw new Error('No browser windows in pool');
    return first.window.webContents.session;
  }

  /**
   * Wait until all windows are available and close them.
   */
  close() {
    return new Promise<void>((resolve) => {
      // wait until the queue is empty
      this._queue.on('empty', () => {
        this._pool.forEach((w) => w.window.close());

        // artificial delay to allow the window to close
        setTimeout(() => resolve(), 500);
      });

      // trigger the empty event if the queue is already empty
      this._queue.next();
    });
  }
}
