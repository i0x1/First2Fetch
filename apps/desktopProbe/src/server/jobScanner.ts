import { IAnalyticsClient } from '@/lib/analytics';
import { getExceptionMessage, throwError } from '@first2apply/core';
import { Job, Link } from '@first2apply/core';
import { Notification, app, powerSaveBlocker } from 'electron';
import fs from 'fs';
import { ScheduledTask, schedule } from 'node-cron';
import path from 'path';

/**
 * Calculate the next execution time for a cron expression.
 * Supports the patterns we actually use in the app.
 */
function getNextCronTime(cronExpression: string): Date | null {
  const now = new Date();
  const [minute, hour, dayOfMonth, , dayOfWeek] = cronExpression.split(' ');

  try {
    // Handle minute-based intervals (e.g., */30 * * * *)
    if (minute.startsWith('*/')) {
      const interval = parseInt(minute.substring(2), 10);
      if (isNaN(interval) || interval <= 0) return null;
      
      const currentMinute = now.getMinutes();
      const nextMinute = Math.ceil((currentMinute + 1) / interval) * interval;
      const next = new Date(now);
      if (nextMinute >= 60) {
        next.setHours(next.getHours() + 1);
        next.setMinutes(0);
      } else {
        next.setMinutes(nextMinute);
      }
      next.setSeconds(0);
      next.setMilliseconds(0);
      
      // Ensure we're not in the past (shouldn't happen, but safety check)
      if (next <= now) {
        next.setMinutes(next.getMinutes() + interval);
        if (next.getMinutes() >= 60) {
          next.setHours(next.getHours() + 1);
          next.setMinutes(next.getMinutes() - 60);
        }
      }
      return next;
    }

    // Handle hour-based patterns (e.g., 0 */2 * * *)
    if (minute === '0' && hour.startsWith('*/')) {
      const interval = parseInt(hour.substring(2), 10);
      const currentHour = now.getHours();
      const nextHour = Math.ceil((currentHour + 1) / interval) * interval;
      const next = new Date(now);
      if (nextHour >= 24) {
        next.setDate(next.getDate() + 1);
        next.setHours(0);
      } else {
        next.setHours(nextHour);
      }
      next.setMinutes(0);
      next.setSeconds(0);
      next.setMilliseconds(0);
      return next;
    }

    // Handle daily at midnight (0 0 * * *)
    if (minute === '0' && hour === '0') {
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(0);
      next.setMinutes(0);
      next.setSeconds(0);
      next.setMilliseconds(0);
      return next;
    }

    // Handle every N days (0 0 */N * *)
    if (minute === '0' && hour === '0' && dayOfMonth.startsWith('*/')) {
      const interval = parseInt(dayOfMonth.substring(2), 10);
      const next = new Date(now);
      next.setDate(next.getDate() + interval);
      next.setHours(0);
      next.setMinutes(0);
      next.setSeconds(0);
      next.setMilliseconds(0);
      return next;
    }

    // Handle weekly (0 0 * * 0)
    if (minute === '0' && hour === '0' && dayOfWeek === '0') {
      const next = new Date(now);
      const daysUntilSunday = (7 - next.getDay()) % 7 || 7;
      next.setDate(next.getDate() + daysUntilSunday);
      next.setHours(0);
      next.setMinutes(0);
      next.setSeconds(0);
      next.setMilliseconds(0);
      return next;
    }

    // Handle hourly at minute 0 (0 * * * *)
    if (minute === '0' && hour === '*') {
      const next = new Date(now);
      next.setHours(next.getHours() + 1);
      next.setMinutes(0);
      next.setSeconds(0);
      next.setMilliseconds(0);
      return next;
    }

    return null;
  } catch (e) {
    return null;
  }
}

import { AVAILABLE_CRON_RULES, JobScannerSettings, ScannerJobStatus, ScannerStatus } from '../lib/types';
import { installLinkedInDecorator } from './browserHelpers';
import { chunk, promiseAllSequence, waitRandomBetween } from './helpers';
import { HtmlDownloader } from './htmlDownloader';
import { ILogger } from './logger';
import { F2aSupabaseApi } from './supabaseApi';

const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');

const DEFAULT_SETTINGS: JobScannerSettings = {
  cronRule: AVAILABLE_CRON_RULES[1].value, // every 1h
  preventSleep: true,
  useSound: true,
  areEmailAlertsEnabled: true,
  inAppBrowserEnabled: true,
  linkedinScanIntervalMinutes: undefined, // use global cron rule by default
  isPaused: false, // scraping is active by default
};

/**
 * Class used to manage a cron job that periodically scans links.
 */
export class JobScanner {
  private _logger: ILogger;
  private _supabaseApi: F2aSupabaseApi;
  private _normalHtmlDownloader: HtmlDownloader;
  private _incognitoHtmlDownloader: HtmlDownloader;
  private _onNavigate: (_: { path: string }) => void;
  private _analytics: IAnalyticsClient;

  private _isRunning = true;
  // these defaults will be applied when migrating from older versions
  private _settings: JobScannerSettings = {
    preventSleep: false,
    useSound: false,
    areEmailAlertsEnabled: true,
    inAppBrowserEnabled: true,
    linkedinScanIntervalMinutes: undefined,
    isPaused: false,
  };
  private _cronJob: ScheduledTask | undefined;
  private _linkedinCronJob: ScheduledTask | undefined;
  private _prowerSaveBlockerId: number | undefined;
  private _notificationsMap: Map<string, Notification> = new Map();
  private _runningScansCount = 0;
  
  // Status tracking for UI
  private _statusLogs: string[] = [];
  private _currentScanningJobs: Map<string, ScannerJobStatus> = new Map();

  constructor({
    logger,
    supabaseApi,
    normalHtmlDownloader,
    incognitoHtmlDownloader,
    onNavigate,
    analytics,
  }: {
    logger: ILogger;
    supabaseApi: F2aSupabaseApi;
    normalHtmlDownloader: HtmlDownloader;
    incognitoHtmlDownloader: HtmlDownloader;
    onNavigate: (_: { path: string }) => void;
    analytics: IAnalyticsClient;
  }) {
    this._logger = logger;
    this._supabaseApi = supabaseApi;
    this._normalHtmlDownloader = normalHtmlDownloader;
    this._incognitoHtmlDownloader = incognitoHtmlDownloader;
    this._onNavigate = onNavigate;
    this._analytics = analytics;

    // used for testing
    // fs.unlinkSync(settingsPath);

    // load the setings from disk
    let settingsToApply = this._settings;
    if (fs.existsSync(settingsPath)) {
      settingsToApply = {
        ...this._settings,
        ...JSON.parse(fs.readFileSync(settingsPath, 'utf-8')),
      };
      this._logger.info('scanner settings loaded', {
        cronRule: settingsToApply.cronRule,
        linkedinScanIntervalMinutes: settingsToApply.linkedinScanIntervalMinutes,
        isPaused: settingsToApply.isPaused,
      });
    } else {
      this._logger.info('scanner settings missing; using defaults');
      settingsToApply = DEFAULT_SETTINGS;
    }

    this._applySettings(settingsToApply);

    installLinkedInDecorator(this._normalHtmlDownloader.getSession());
  }

  private _logToUi(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const log = `[${timestamp}] ${message}`;
    this._statusLogs.unshift(log);
    // Keep last 100 logs
    if (this._statusLogs.length > 100) {
      this._statusLogs.pop();
    }
  }

  getScannerStatus(): ScannerStatus {
    // Debugging what's available on the cron job object
    // if (this._cronJob) {
    //   this._logger.info('cronJob keys', { keys: Object.keys(this._cronJob) });
    // }

    let linkedinCronRule: string | undefined;
    if (
      this._settings.linkedinScanIntervalMinutes &&
      this._settings.linkedinScanIntervalMinutes > 0
    ) {
      linkedinCronRule = `*/${this._settings.linkedinScanIntervalMinutes} * * * *`;
    }

    // Calculate next run times
    let nextScanTime: string | null = null;
    if (this._settings.cronRule) {
      const nextTime = getNextCronTime(this._settings.cronRule);
      if (nextTime) {
        nextScanTime = nextTime.toISOString();
      }
    }

    let nextLinkedinScanTime: string | null = null;
    if (linkedinCronRule) {
      const nextTime = getNextCronTime(linkedinCronRule);
      if (nextTime) {
        nextLinkedinScanTime = nextTime.toISOString();
      }
    }

    return {
      isScanning: this.isScanning(),
      nextScanTime,
      nextLinkedinScanTime,
      cronRule: this._settings.cronRule,
      linkedinCronRule,
      currentJobs: Array.from(this._currentScanningJobs.values()),
      logs: this._statusLogs,
    };
  }

  /**
   * Check if there are any scans running.
   */
  isScanning() {
    return this._runningScansCount > 0;
  }

  /**
   * Scan all links for the current user.
   */
  async scanAllLinks({ linkedinOnly = false }: { linkedinOnly?: boolean } = {}) {
    // if paused, skip the scan
    if (this._settings.isPaused) {
      this._logger.info('skipping scheduled scan because scraping is paused');
      this._logToUi('Skipping scheduled scan because scraping is paused');
      return;
    }

    // if the scanner hasn't finished scanning the previous links, skip this scan
    if (this.isScanning()) {
      this._logger.info('skipping scheduled scan because the scanner is processing other links');
      this._logToUi('Skipping scheduled scan because scanner is busy');
      return;
    }

    // fetch all links from the database
    const allLinks = (await this._supabaseApi.listLinks()) ?? [];
    
    // filter links if LinkedIn-only scan
    let linksToScan = allLinks;
    if (linkedinOnly) {
      const sites = await this._supabaseApi.listSites();
      const linkedinSiteIds = sites.filter(site => site.provider === 'linkedin').map(site => site.id);
      linksToScan = allLinks.filter(link => linkedinSiteIds.includes(link.site_id));
      this._logger.info('scan links selected', { mode: 'linkedin', linksCount: linksToScan.length });
      this._logToUi(`Found ${linksToScan.length} LinkedIn links to scan`);
    } else {
      this._logger.info('scan links selected', { mode: 'all', linksCount: allLinks.length });
      this._logToUi(`Found ${allLinks.length} links to scan`);
    }

    // start the scan
    return this.scanLinks({ links: linksToScan });
  }

  /**
   * Scan only LinkedIn links for the current user.
   */
  async scanLinkedInLinks() {
    return this.scanAllLinks({ linkedinOnly: true });
  }

  /**
   * Perform a scan of a list links.
   */
  async scanLinks({ links, sendNotification = true }: { links: Link[]; sendNotification?: boolean }) {
    try {
      this._logger.info('scan started', { linksCount: links.length });
      this._logToUi('Starting to scan links...');
      this._analytics.trackEvent('scan_links_start', {
        links_count: links.length,
      });
      this._runningScansCount++;
      const start = new Date().getTime();

      await Promise.all(
        links.map(async (link) => {
          this._logToUi(`Scanning link: ${link.title} (${link.url})`);
          this._logger.debug('scan link started', { linkId: link.id, title: link.title });
          const newJobs = await this._normalHtmlDownloader
            .loadUrl({
              url: link.url,
              scrollTimes: 5,
              callback: async ({ html, webPageRuntimeData, maxRetries, retryCount }) => {
                if (!this._isRunning) return []; // stop if the scanner is closed

                const { newJobs, parseFailed } = await this._supabaseApi.scanHtmls([
                  { linkId: link.id, content: html, webPageRuntimeData, maxRetries, retryCount },
                ]);

                if (parseFailed) {
                  this._logger.warn('link parse failed', {
                    linkId: link.id,
                    title: link.title,
                  });
                  this._logToUi(`Failed to parse HTML for link: ${link.title}`);

                  throw new Error(`failed to parse html for link ${link.id}`);
                }
                
                if (newJobs.length > 0) {
                    this._logToUi(`Found ${newJobs.length} new jobs from link: ${link.title}`);
                }

                // add a random delay before moving on to the next link
                // to avoid being rate limited by cloudflare
                await waitRandomBetween(5000, 15000);

                return newJobs;
              },
            })
            .catch(async (error): Promise<Job[]> => {
              if (this._isRunning) {
                const errorMessage = getExceptionMessage(error);
                this._logger.error('link scan failed', {
                  linkId: link.id,
                  title: link.title,
                  error: errorMessage,
                });
                this._logToUi(`Error scanning link ${link.title}: ${errorMessage}`);

                // when dealing with rate limits, bump the number of failed attempts for the link
                await this._supabaseApi
                  .increaseScrapeFailureCount({
                    linkId: link.id,
                    failures: link.scrape_failure_count + 1,
                  })
                  .catch((error) => {
                    this._logger.error(`failed to increase scrape failure count: ${getExceptionMessage(error)}`, {
                      linkId: link.id,
                    });
                  });
              }

              // intetionally return an empty array if there is an error
              // in order to continue scanning the rest of the links
              return [];
            });

          return newJobs;
        }),
      );
      this._logger.info('link html download complete', { linksCount: links.length });
      this._logToUi(`Finished downloading HTML for ${links.length} links`);

      // scan job descriptions for all pending jobs
      if (!this._isRunning) return;
      const { jobs } = await this._supabaseApi.listJobs({
        status: 'processing',
        limit: 300,
      });
      this._logger.info('job description queue ready', { jobsCount: jobs.length });
      if (jobs.length > 0) {
        this._logToUi(`Found ${jobs.length} jobs that need detailed processing`);
      }
      const scannedJobs = await this.scanJobs(jobs);
      const newJobs = scannedJobs.filter((job) => job.status === 'new');

      const newJobIds = newJobs.map((job) => job.id);
      await this._supabaseApi
        .runPostScanHook({
          newJobIds: sendNotification ? newJobIds : [],
          areEmailAlertsEnabled: this._settings.areEmailAlertsEnabled,
        })
        .catch((error) => {
          this._logger.error(`failed to run post scan hook: ${getExceptionMessage(error)}`);
          this._logToUi(`Failed to run post-scan hook: ${getExceptionMessage(error)}`);
        });

      // fire a notification if there are new jobs
      if (!this._isRunning) return;
      if (sendNotification) this.showNewJobsNotification({ newJobs });

      const end = new Date().getTime();
      const took = (end - start) / 1000;
      this._logger.info('scan completed', {
        linksCount: links.length,
        processedJobsCount: scannedJobs.length,
        newJobsCount: newJobs.length,
        durationSeconds: Math.round(took),
      });
      this._logToUi(`Scan session complete in ${took.toFixed(0)} seconds`);
      this._analytics.trackEvent('scan_links_complete', {
        links_count: links.length,
        new_jobs_count: newJobs.length,
      });
    } catch (error) {
      this._logger.error(getExceptionMessage(error));
      this._logToUi(`Error during scan session: ${getExceptionMessage(error)}`);
    } finally {
      this._runningScansCount--;
    }
  }

  /**
   * Scan a list of new jobs to extract the description.
   */
  async scanJobs(jobs: Job[]): Promise<Job[]> {
    this._logger.info('job description scan started', { jobsCount: jobs.length });
    this._logToUi(`Processing ${jobs.length} job descriptions...`);

    // figure out which jobs can be scanned in incognito mode
    const sites = await this._supabaseApi.listSites();
    const sitesMap = new Map(sites.map((site) => [site.id, site]));
    const incognitoJobsToScan = jobs.filter((job) => sitesMap.get(job.siteId)?.incognito_support);
    const normalJobsToScan = jobs.filter((job) => !sitesMap.get(job.siteId)?.incognito_support);

    const scanJobDescriptions = async ({
      jobsToScan,
      htmlDownloader,
    }: {
      jobsToScan: Job[];
      htmlDownloader: HtmlDownloader;
    }) => {
      const jobChunks = chunk(jobsToScan, 10);
      const updatedJobs = await promiseAllSequence(jobChunks, async (chunkOfJobs) => {
        if (!this._isRunning) return chunkOfJobs; // stop if the scanner is closed

        return Promise.all(
          chunkOfJobs.map(async (job) => {
            try {
              // Add to current scanning jobs
              this._currentScanningJobs.set(String(job.id), {
                id: String(job.id),
                title: job.title,
                status: 'scanning_html',
                startTime: new Date().toISOString(),
              });
              this._logToUi(`Fetching description for: ${job.title}`);

              return await htmlDownloader.loadUrl({
                url: job.externalUrl,
                scrollTimes: 1,
                callback: async ({ html, maxRetries, retryCount }) => {
                  this._logger.debug('job html downloaded', {
                    jobId: job.id,
                    title: job.title,
                  });
                  
                  // Update status to parsing
                  if (this._currentScanningJobs.has(String(job.id))) {
                      const status = this._currentScanningJobs.get(String(job.id))!;
                      this._currentScanningJobs.set(String(job.id), { ...status, status: 'parsing_description' });
                  }
                  this._logToUi(`Parsing content for: ${job.title} with AI parser`);

                  // stop if the scanner is closed
                  if (!this._isRunning) return job;

                  const { job: updatedJob, parseFailed } = await this._supabaseApi.scanJobDescription({
                    jobId: job.id,
                    html,
                    maxRetries,
                    retryCount,
                  });

                  if (parseFailed) {
                    this._logger.warn('job description parse failed', {
                      jobId: job.id,
                      title: job.title,
                    });
                    this._logToUi(`Failed to parse job description for: ${job.title}`);

                    throw new Error(`failed to parse job description for ${job.id}`);
                  }

                  // add a random delay before moving on to the next link
                  // to avoid being rate limited by cloudflare
                  await waitRandomBetween(2000, 5000);

                  this._logToUi(`Successfully processed: ${job.title}`);
                  return updatedJob;
                },
              });
            } catch (error) {
              if (this._isRunning)
                this._logger.error('job description scan failed', {
                  jobId: job.id,
                  title: job.title,
                  error: getExceptionMessage(error),
                });
              this._logToUi(`Error processing job ${job.title}: ${getExceptionMessage(error)}`);

              // intetionally return initial job if there is an error
              // in order to continue scanning the rest of the jobs
              return job;
            } finally {
                // Remove from current scanning jobs
                this._currentScanningJobs.delete(String(job.id));
            }
          }),
        );
      }).then((r) => r.flat());

      return updatedJobs;
    };

    const [scannedNormalJobs, scannedIncognitoJobs] = await Promise.all([
      scanJobDescriptions({
        jobsToScan: normalJobsToScan,
        htmlDownloader: this._normalHtmlDownloader,
      }),
      scanJobDescriptions({
        jobsToScan: incognitoJobsToScan,
        htmlDownloader: this._incognitoHtmlDownloader,
      }),
    ]);

    const allScannedJobs = [...scannedIncognitoJobs, ...scannedNormalJobs];
    const updatedJobs = jobs.map((job) => allScannedJobs.find((j) => j.id === job.id) ?? throwError('job not found')); // preserve the order

    this._logger.info('job description scan completed', { jobsCount: updatedJobs.length });
    this._logToUi('Finished processing all job descriptions in this batch');

    return updatedJobs;
  }

  /**
   * Display a notfication for new jobs.
   */
  showNewJobsNotification({ newJobs }: { newJobs: Job[] }) {
    if (newJobs.length === 0) return;

    // Create a new notification
    const maxDisplayedJobs = 3;
    const displatedJobs = newJobs.slice(0, maxDisplayedJobs);
    const otherJobsCount = newJobs.length - maxDisplayedJobs;

    const firstJobsLabel = displatedJobs.map((job: Job) => `${job.title} at ${job.companyName}`).join(', ');
    const plural = otherJobsCount > 1 ? 's' : '';
    const otherJobsLabel = otherJobsCount > 0 ? ` and ${otherJobsCount} other${plural}` : '';
    const notification = new Notification({
      title: 'Job Search Update',
      body: `${firstJobsLabel}${otherJobsLabel} ${displatedJobs.length > 1 ? 'are' : 'is'} now available!`,
      // sound: "Submarine",
      silent: !this._settings.useSound,
    });

    // Show the notification
    const notificationId = new Date().getTime().toString();
    this._notificationsMap.set(notificationId, notification);
    notification.on('click', () => {
      this._onNavigate({ path: '/?status=new' });
      this._notificationsMap.delete(notificationId);
      this._analytics.trackEvent('notification_click', {
        jobs_count: newJobs.length,
      });
    });
    notification.show();
    this._analytics.trackEvent('show_notification', {
      jobs_count: newJobs.length,
    });
  }

  /**
   * Update settings.
   */
  updateSettings(settings: JobScannerSettings) {
    this._applySettings(settings);
    this._saveSettings();
  }

  /**
   * Get the current settings.
   */
  getSettings() {
    return { ...this._settings };
  }

  /**
   * Close the scanner.
   */
  close() {
    // end cron job
    if (this._cronJob) {
      this._logger.info(`stopping cron schedule`);
      this._cronJob.stop();
    }

    // end LinkedIn cron job
    if (this._linkedinCronJob) {
      this._logger.info(`stopping LinkedIn cron schedule`);
      this._linkedinCronJob.stop();
    }

    // stop power blocker
    if (typeof this._prowerSaveBlockerId === 'number') {
      this._logger.info(`stopping prevent sleep`);
      powerSaveBlocker.stop(this._prowerSaveBlockerId);
    }

    this._isRunning = false;
  }

  /**
   * Scan a link to fetch new jobs.
   */
  async scanLink({ linkId }: { linkId: number }) {
    const link = await this._supabaseApi.listLinks().then((links) => links.find((l) => l.id === linkId));
    if (!link) {
      throw new Error(`link not found: ${linkId}`);
    }

    // scan the link after the debug window is closed
    this.scanLinks({ links: [link] }).catch((error) => {
      this._logger.error(getExceptionMessage(error));
    });
  }

  /**
   * Persist settings to disk.
   */
  private _saveSettings() {
    fs.writeFileSync(settingsPath, JSON.stringify(this._settings));
    this._logger.info(`settings saved to disk`);
  }

  /**
   * Apply a new set of settings into the runtime.
   */
  private _applySettings(settings: JobScannerSettings) {
    if (settings.cronRule !== this._settings.cronRule) {
      // stop old cron job
      if (this._cronJob) {
        this._logger.info(`stopping old cron schedule`);
        this._cronJob.stop();
      }
      // start new cron job if needed
      if (settings.cronRule) {
        this._cronJob = schedule(settings.cronRule, () => this.scanAllLinks());
        this._logger.info(`cron job started successfully ${settings.cronRule}`);
      }
    }

    // Handle LinkedIn-specific scan interval
    if (settings.linkedinScanIntervalMinutes !== this._settings.linkedinScanIntervalMinutes) {
      // stop old LinkedIn cron job
      if (this._linkedinCronJob) {
        this._logger.info(`stopping old LinkedIn cron schedule`);
        this._linkedinCronJob.stop();
        this._linkedinCronJob = undefined;
      }
      // start new LinkedIn cron job if interval is set
      if (settings.linkedinScanIntervalMinutes && settings.linkedinScanIntervalMinutes > 0) {
        const linkedinCronRule = `*/${settings.linkedinScanIntervalMinutes} * * * *`;
        this._linkedinCronJob = schedule(linkedinCronRule, () => this.scanLinkedInLinks());
        this._logger.info(`LinkedIn cron job started successfully: every ${settings.linkedinScanIntervalMinutes} minutes`);
      }
    }

    if (settings.preventSleep !== this._settings.preventSleep) {
      // stop old power blocker
      if (typeof this._prowerSaveBlockerId === 'number') {
        this._logger.info(`stopping old prevent sleep`);
        powerSaveBlocker.stop(this._prowerSaveBlockerId);
      }
      // start new power blocker if needed
      if (settings.preventSleep) {
        this._prowerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
        this._logger.info(`prevent sleep started successfully: ${this._prowerSaveBlockerId}`);
      }
    }

    // Log pause state changes
    if (settings.isPaused !== this._settings.isPaused) {
      this._logger.info(`scraping ${settings.isPaused ? 'paused' : 'resumed'}`);
      this._logToUi(`Scraping ${settings.isPaused ? 'paused' : 'resumed'}`);
    }

    this._settings = settings;
    this._logger.info(`settings applied successfully`);
  }
}
