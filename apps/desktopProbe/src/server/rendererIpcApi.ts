import { Job, WebPageRuntimeData, getExceptionMessage } from '@first2apply/core';
import { dialog, ipcMain, shell } from 'electron';
import fs from 'fs';
import { json2csv } from 'json-2-csv';
import os from 'os';

import { IAnalyticsClient } from '../lib/analytics';
import { F2aAutoUpdater } from './autoUpdater';
import { JobScanner } from './jobScanner';
import { OverlayBrowserView } from './overlayBrowserView';
import { getStripeConfig } from './stripeConfig';
import { F2aSupabaseApi } from './supabaseApi';

/**
 * Helper methods used to centralize error handling.
 */
async function _apiCall<T>(method: () => Promise<T>) {
  try {
    const data = await method();
    return { data };
  } catch (error) {
    console.error(getExceptionMessage(error));
    return { error: getExceptionMessage(error, true) };
  }
}

/**
 * IPC handlers that expose methods to the renderer process
 * used to interact with the Supabase instance hosted on the node process.
 */
export function initRendererIpcApi({
  supabaseApi,
  jobScanner,
  autoUpdater,
  overlayBrowserView,
  nodeEnv,
  analytics,
  onForceQuit,
}: {
  supabaseApi: F2aSupabaseApi;
  jobScanner: JobScanner;
  autoUpdater: F2aAutoUpdater;
  overlayBrowserView: OverlayBrowserView;
  nodeEnv: string;
  analytics: IAnalyticsClient;
  onForceQuit: () => Promise<void>;
}) {
  ipcMain.handle('get-os-type', (_) =>
    _apiCall(async () => {
      return os.platform();
    }),
  );

  ipcMain.handle('signup-with-email', async (_, { email, password }) =>
    _apiCall(async () => {
      const result = await supabaseApi.signupWithEmail({ email, password });
      analytics.trackEvent('user_signed_up', { method: 'email', email });
      return result;
    }),
  );

  ipcMain.handle('login-with-email', async (_, { email, password }) =>
    _apiCall(async () => {
      const result = await supabaseApi.loginWithEmail({ email, password });
      analytics.trackEvent('user_logged_in', { method: 'email', email });
      return result;
    }),
  );

  ipcMain.handle('send-password-reset-email', async (_, { email }) =>
    _apiCall(() => supabaseApi.sendPasswordResetEmail({ email })),
  );

  ipcMain.handle('change-password', async (_, { password }) =>
    _apiCall(() => supabaseApi.updatePassword({ password })),
  );

  ipcMain.handle('logout', async (_) => _apiCall(() => supabaseApi.logout()));

  ipcMain.handle('get-user', async (_) => _apiCall(() => supabaseApi.getUser()));

  ipcMain.handle(
    'create-link',
    async (
      _,
      {
        title,
        url,
        html,
        webPageRuntimeData,
        force,
      }: {
        title: string;
        url: string;
        html: string;
        webPageRuntimeData: WebPageRuntimeData;
        force?: boolean;
      },
    ) =>
      _apiCall(async () => {
        const { link, newJobs } = await supabaseApi.createLink({
          title,
          url,
          html,
          webPageRuntimeData,
          force,
        });

        // intentionally not awaited to not have the user wait until JDs are in
        jobScanner.scanJobs(newJobs).catch((error) => {
          console.error(getExceptionMessage(error));
        });

        analytics.trackEvent('link_created', { link_id: link.id, user_id: link.user_id, site_id: link.site_id });

        return { link };
      }),
  );

  ipcMain.handle('update-link', async (_, { linkId, title, url }) =>
    _apiCall(async () => {
      const res = await supabaseApi.updateLink({ linkId, title, url });
      analytics.trackEvent('link_updated', { link_id: linkId });
      return res;
    }),
  );

  ipcMain.handle('list-links', async (_) => _apiCall(() => supabaseApi.listLinks()));

  ipcMain.handle('delete-link', async (_, { linkId }) =>
    _apiCall(async () => {
      const res = await supabaseApi.deleteLink(linkId);
      analytics.trackEvent('link_deleted', { link_id: linkId });
      return res;
    }),
  );

  ipcMain.handle(
    'get-job-dates-summary',
    async (_, { status, search, siteIds, linkIds, labels, hideReposted, timezone }) =>
      _apiCall(() =>
        supabaseApi.getJobDatesSummary({ status, search, siteIds, linkIds, labels, hideReposted, timezone }),
      ),
  );

  ipcMain.handle('get-job-counts', async (_, { search, siteIds, linkIds, labels, hideReposted }) =>
    _apiCall(() => supabaseApi.getJobCounts({ search, siteIds, linkIds, labels, hideReposted })),
  );

  ipcMain.handle(
    'list-jobs',
    async (_, { status, search, siteIds, linkIds, labels, limit, after, dateFilter, hideReposted, timezone }) =>
      _apiCall(() =>
        supabaseApi.listJobs({
          status,
          search,
          siteIds,
          linkIds,
          labels,
          limit,
          after,
          dateFilter,
          hideReposted,
          timezone,
        }),
      ),
  );

  ipcMain.handle('update-job-status', async (_, { jobId, status }) =>
    _apiCall(async () => {
      const res = await supabaseApi.updateJobStatus({ jobId, status });
      analytics.trackEvent('job_status_updated', { jobId, status });
      return res;
    }),
  );

  ipcMain.handle('update-job-labels', async (_, { jobId, labels }) =>
    _apiCall(async () => {
      const res = await supabaseApi.updateJobLabels({ jobId, labels });
      analytics.trackEvent('job_labels_updated', { jobId, labels: labels.join(',') });
      return res;
    }),
  );

  ipcMain.handle('list-sites', async (_) => _apiCall(() => supabaseApi.listSites()));

  ipcMain.handle('update-job-scanner-settings', async (_, { settings }) =>
    _apiCall(async () => {
      const res = await jobScanner.updateSettings(settings);
      analytics.trackEvent('job_scanner_settings_updated', { ...settings });
      return res;
    }),
  );

  // handler used to fetch the cron schedule
  ipcMain.handle('get-job-scanner-settings', async (_) => _apiCall(async () => jobScanner.getSettings()));

  ipcMain.handle('get-scanner-status', async (_) => _apiCall(async () => jobScanner.getScannerStatus()));

  ipcMain.handle('open-external-url', async (_, { url }) => _apiCall(async () => shell.openExternal(url)));

  ipcMain.handle('scan-job-description', async (_, { job }) =>
    _apiCall(async () => {
      const [updatedJob] = await jobScanner.scanJobs([job]);
      return { job: updatedJob };
    }),
  );
  ipcMain.handle('get-app-state', async (_) =>
    _apiCall(async () => {
      const isScanning = await jobScanner.isScanning();
      const newUpdate = await autoUpdater.getNewUpdate();
      return { isScanning, newUpdate };
    }),
  );
  ipcMain.handle('apply-app-update', async (_) =>
    _apiCall(async () => {
      await autoUpdater.applyUpdate();
      analytics.trackEvent('app_update_applied');
      return {};
    }),
  );

  ipcMain.handle('create-user-review', async (_, { title, description, rating }) =>
    _apiCall(async () => {
      const res = await supabaseApi.createReview({ title, description, rating });
      analytics.trackEvent('user_review_created', { title, description, rating });
      return res;
    }),
  );

  ipcMain.handle('get-user-review', async (_) => _apiCall(async () => supabaseApi.getUserReview()));

  ipcMain.handle('update-user-review', async (_, { id, title, description, rating }) =>
    _apiCall(async () => supabaseApi.updateReview({ id, title, description, rating })),
  );

  ipcMain.handle('get-job-by-id', async (_, { jobId }) =>
    _apiCall(async () => {
      const job = await supabaseApi.getJob(jobId);
      return { job };
    }),
  );

  ipcMain.handle('export-jobs-csv', async (_, { status }) =>
    _apiCall(async () => {
      const res = await dialog.showSaveDialog({
        properties: ['createDirectory'],
        filters: [{ name: 'CSV Jobs', extensions: ['csv'] }],
      });
      const filePath = res.filePath;
      if (res.canceled) return;

      // load all jobs with pagination
      const batchSize = 300;
      let allJobs: Job[] = [];
      let after: string | undefined;
      do {
        const { jobs, nextPageToken } = await supabaseApi.listJobs({
          status,
          limit: batchSize,
          after,
        });
        allJobs = allJobs.concat(jobs);
        after = nextPageToken;
      } while (after);

      // cherry-pick the fields we want to export
      const sanitizedJobs = allJobs.map((job: Job) => ({
        title: job.title,
        company: job.companyName,
        location: job.location,
        salary: job.salary,
        job_type: job.jobType,
        job_status: job.status,
        external_url: job.externalUrl,
      }));

      const csvJobs = json2csv(sanitizedJobs);
      fs.writeFileSync(filePath, csvJobs);
    }),
  );

  ipcMain.handle('change-all-job-status', async (_, { from, to }) =>
    _apiCall(async () => {
      const job = await supabaseApi.changeAllJobStatus({ from, to });
      return { job };
    }),
  );

  ipcMain.handle('get-profile', async (_) =>
    _apiCall(async () => {
      const profile = await supabaseApi.getProfile();
      return { profile };
    }),
  );

  ipcMain.handle('get-stripe-config', async (_) =>
    _apiCall(async () => {
      const config = await getStripeConfig(nodeEnv);
      return { config };
    }),
  );

  ipcMain.handle('create-note', async (_, { job_id, text, files }) =>
    _apiCall(async () => {
      const res = await supabaseApi.createNote({ job_id, text, files });
      analytics.trackEvent('note_created', { job_id, note_id: res.id });
      return res;
    }),
  );

  ipcMain.handle('list-notes', async (_, { job_id }) => _apiCall(() => supabaseApi.listNotes(job_id)));

  ipcMain.handle('update-note', async (_, { noteId, text }) =>
    _apiCall(() => supabaseApi.updateNote({ noteId, text })),
  );

  ipcMain.handle('add-file-to-note', async (_, { noteId, file }) =>
    _apiCall(() => supabaseApi.addFileToNote({ noteId, file })),
  );

  ipcMain.handle('delete-note', async (_, { noteId }) =>
    _apiCall(async () => {
      const res = await supabaseApi.deleteNote(noteId);
      analytics.trackEvent('note_deleted', { note_id: noteId });
      return res;
    }),
  );

  ipcMain.handle('get-advanced-matching-config', async (_) => _apiCall(() => supabaseApi.getAdvancedMatchingConfig()));

  ipcMain.handle('update-advanced-matching-config', async (_, { config }) =>
    _apiCall(async () => {
      const res = await supabaseApi.updateAdvancedMatchingConfig(config);
      analytics.trackEvent('advanced_matching_config_updated', { config: JSON.stringify(config) });
      return res;
    }),
  );

  ipcMain.handle('add-favorite-company', async (_, { companyName }) =>
    _apiCall(() => supabaseApi.addFavoriteCompany(companyName)),
  );

  ipcMain.handle('remove-favorite-company', async (_, { companyName }) =>
    _apiCall(() => supabaseApi.removeFavoriteCompany(companyName)),
  );

  ipcMain.handle('add-blacklisted-company', async (_, { companyName }) =>
    _apiCall(() => supabaseApi.addBlacklistedCompany(companyName)),
  );

  ipcMain.handle('remove-blacklisted-company', async (_, { companyName }) =>
    _apiCall(() => supabaseApi.removeBlacklistedCompany(companyName)),
  );

  ipcMain.handle('add-watched-company', async (_, { companyName }) =>
    _apiCall(() => supabaseApi.addWatchedCompany(companyName)),
  );

  ipcMain.handle('remove-watched-company', async (_, { companyName }) =>
    _apiCall(() => supabaseApi.removeWatchedCompany(companyName)),
  );

  ipcMain.handle('export-user-settings', async (_) => _apiCall(() => supabaseApi.exportUserSettings()));

  ipcMain.handle('import-user-settings', async (_, { settings }) =>
    _apiCall(() => supabaseApi.importUserSettings(settings)),
  );

  ipcMain.handle('scan-link', async (_, { linkId }) => _apiCall(() => jobScanner.scanLink({ linkId })));

  ipcMain.handle('open-overlay-browser-view', async (_, { url }) => {
    return _apiCall(async () => overlayBrowserView.open(url));
  });
  ipcMain.handle('close-overlay-browser-view', async (_) => {
    return _apiCall(async () => overlayBrowserView.close());
  });
  ipcMain.handle('overlay-browser-can-view-go-back', async (_) => {
    return _apiCall(async () => overlayBrowserView.canGoBack());
  });
  ipcMain.handle('overlay-browser-view-go-back', async (_) => {
    return _apiCall(async () => overlayBrowserView.goBack());
  });
  ipcMain.handle('overlay-browser-can-view-go-forward', async (_) => {
    return _apiCall(async () => overlayBrowserView.canGoForward());
  });
  ipcMain.handle('overlay-browser-view-go-forward', async (_) => {
    return _apiCall(async () => overlayBrowserView.goForward());
  });
  ipcMain.handle('finish-overlay-browser-view', async (_) => {
    return _apiCall(async () => overlayBrowserView.finish());
  });
  ipcMain.handle('overlay-browser-view-navigate', async (_, { url }) => {
    return _apiCall(async () => overlayBrowserView.navigate(url));
  });

  ipcMain.handle('force-quit-app', async (_) =>
    _apiCall(async () => {
      await onForceQuit();
      return {};
    }),
  );
}
