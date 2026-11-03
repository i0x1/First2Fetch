import type { WebPageRuntimeData } from '@first2apply/core';

export const AVAILABLE_CRON_RULES = [
  {
    name: 'Every 30 minutes',
    value: '*/30 * * * *',
  },
  {
    name: 'Every hour',
    value: '0 * * * *',
  },
  {
    name: 'Every 2 hours',
    value: '0 */2 * * *',
  },
  {
    name: 'Every 4 hours',
    value: '0 */4 * * *',
  },
  {
    name: 'Every 8 hours',
    value: '0 */8 * * *',
  },
  {
    name: 'Every 12 hours',
    value: '0 */12 * * *',
  },
  {
    name: 'Every day',
    value: '0 0 * * *',
  },
  {
    name: 'Every 3 days',
    value: '0 0 */3 * *',
  },
  {
    name: 'Every week',
    value: '0 0 * * 0',
  },
];
export type CronRule = (typeof AVAILABLE_CRON_RULES)[number];

export const LINKEDIN_SCAN_INTERVALS = [30, 60, 120, 240, 480, 720, 1440] as const;

/** Preset intervals for custom job boards (Simplify, YC, JobSignal, ...). Any whole number of minutes is accepted. */
export const CUSTOM_BOARD_SCAN_INTERVALS = [30, 60, 120, 240, 360, 720, 1440] as const;
/** Matches the backend's default once-a-day limit for custom boards. */
export const DEFAULT_CUSTOM_BOARD_SCAN_INTERVAL_MINUTES = 1440;
export const MIN_CUSTOM_BOARD_SCAN_INTERVAL_MINUTES = 15;
export const MAX_CUSTOM_BOARD_SCAN_INTERVAL_MINUTES = 10080; // 1 week

export type JobScannerSettings = {
  cronRule?: string;
  preventSleep: boolean;
  useSound: boolean;
  areEmailAlertsEnabled: boolean;
  inAppBrowserEnabled: boolean;
  linkedinScanIntervalMinutes?: number; // undefined means LinkedIn scanning is off
  customBoardScanIntervalMinutes?: number; // undefined means once every 24h
  isPaused: boolean; // Global pause/resume for job scraping
};

export type NewAppVersion = {
  name: string;
  url: string;
  message: string;
};

export type OverlayBrowserViewResult = {
  url: string;
  title: string;
  html: string;
  webPageRuntimeData: WebPageRuntimeData;
};

export type ScannerJobStatus = {
  id: string;
  title: string;
  status: 'scanning_html' | 'parsing_description';
  startTime: string; // ISO string
};

export type ScannerStatus = {
  isScanning: boolean;
  nextScanTime: string | null; // ISO string
  nextLinkedinScanTime: string | null; // ISO string
  cronRule: string | undefined;
  linkedinCronRule: string | undefined;
  linkedinEnabled: boolean;
  linkedinAccessBlocked: boolean;
  /** ISO time when the LinkedIn cooldown ends, null when not paused. */
  linkedinAccessBlockedUntil: string | null;
  isLinkedinScanning: boolean;
  isOtherScanning: boolean;
  lastLinkedinScanTime: string | null;
  lastOtherScanTime: string | null;
  currentJobs: ScannerJobStatus[];
  logs: string[];
};
