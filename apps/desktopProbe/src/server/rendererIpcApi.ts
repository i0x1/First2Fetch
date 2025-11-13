import { getExceptionMessage } from '@first2apply/core';
import { Job } from '@first2apply/core';
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
}: {
  supabaseApi: F2aSupabaseApi;
  jobScanner: JobScanner;
  autoUpdater: F2aAutoUpdater;
  overlayBrowserView: OverlayBrowserView;
  nodeEnv: string;
  analytics: IAnalyticsClient;
}) {
  ipcMain.handle('get-os-type', (_event) =>
    _apiCall(async () => {
      return os.platform();
    }),
  );

  ipcMain.handle('signup-with-email', async (_event, { email, password }) =>
    _apiCall(async () => {
      const result = await supabaseApi.signupWithEmail({ email, password });
      analytics.trackEvent('user_signed_up', { method: 'email', email });
      return result;
    }),
  );

  ipcMain.handle('login-with-email', async (_event, { email, password }) =>
    _apiCall(async () => {
      const result = await supabaseApi.loginWithEmail({ email, password });
      analytics.trackEvent('user_logged_in', { method: 'email', email });
      return result;
    }),
  );

  ipcMain.handle('send-password-reset-email', async (_event, { email }) =>
    _apiCall(() => supabaseApi.sendPasswordResetEmail({ email })),
  );

  ipcMain.handle('change-password', async (_event, { password }) =>
    _apiCall(() => supabaseApi.updatePassword({ password })),
  );

  ipcMain.handle('logout', async (_event) => _apiCall(() => supabaseApi.logout()));

  ipcMain.handle('get-user', async (_event) => _apiCall(() => supabaseApi.getUser()));

  ipcMain.handle('create-link', async (_event, { title, url, html }) =>
    _apiCall(async () => {
      const { link, newJobs } = await supabaseApi.createLink({
        title,
        url,
        html,
      });

      // intentionally not awaited to not have the user wait until JDs are in
      jobScanner.scanJobs(newJobs).catch((error) => {
        console.error(getExceptionMessage(error));
      });

      analytics.trackEvent('link_created', { link_id: link.id, user_id: link.user_id, site_id: link.site_id });

      return { link };
    }),
  );

  ipcMain.handle('update-link', async (_event, { linkId, title, url }) =>
    _apiCall(async () => {
      const res = await supabaseApi.updateLink({ linkId, title, url });
      analytics.trackEvent('link_updated', { link_id: linkId });
      return res;
    }),
  );

  ipcMain.handle('list-links', async (_event) => _apiCall(() => supabaseApi.listLinks()));

  ipcMain.handle('delete-link', async (_event, { linkId }) =>
    _apiCall(async () => {
      const res = await supabaseApi.deleteLink(linkId);
      analytics.trackEvent('link_deleted', { link_id: linkId });
      return res;
    }),
  );

  ipcMain.handle('list-jobs', async (_event, { status, search, siteIds, linkIds, labels, limit, after }) =>
    _apiCall(() => supabaseApi.listJobs({ status, search, siteIds, linkIds, labels, limit, after })),
  );

  ipcMain.handle('update-job-status', async (_event, { jobId, status }) =>
    _apiCall(async () => {
      const res = await supabaseApi.updateJobStatus({ jobId, status });
      analytics.trackEvent('job_status_updated', { jobId, status });
      return res;
    }),
  );

  ipcMain.handle('update-job-labels', async (_event, { jobId, labels }) =>
    _apiCall(async () => {
      const res = await supabaseApi.updateJobLabels({ jobId, labels });
      analytics.trackEvent('job_labels_updated', { jobId, labels: labels.join(',') });
      return res;
    }),
  );

  ipcMain.handle('list-sites', async (_event) => _apiCall(() => supabaseApi.listSites()));

  ipcMain.handle('update-job-scanner-settings', async (_event, { settings }) =>
    _apiCall(async () => {
      const res = await jobScanner.updateSettings(settings);
      analytics.trackEvent('job_scanner_settings_updated', { ...settings });
      return res;
    }),
  );

  // handler used to fetch the cron schedule
  ipcMain.handle('get-job-scanner-settings', async (_event) => _apiCall(async () => jobScanner.getSettings()));

  ipcMain.handle('open-external-url', async (_event, { url }) => _apiCall(async () => shell.openExternal(url)));

  ipcMain.handle('scan-job-description', async (_event, { job }) =>
    _apiCall(async () => {
      const [updatedJob] = await jobScanner.scanJobs([job]);
      return { job: updatedJob };
    }),
  );
  ipcMain.handle('get-app-state', async (_event) =>
    _apiCall(async () => {
      const isScanning = await jobScanner.isScanning();
      const newUpdate = await autoUpdater.getNewUpdate();
      return { isScanning, newUpdate };
    }),
  );
  ipcMain.handle('apply-app-update', async (_event) =>
    _apiCall(async () => {
      await autoUpdater.applyUpdate();
      analytics.trackEvent('app_update_applied');
      return {};
    }),
  );

  ipcMain.handle('create-user-review', async (_event, { title, description, rating }) =>
    _apiCall(async () => {
      const res = await supabaseApi.createReview({ title, description, rating });
      analytics.trackEvent('user_review_created', { title, description, rating });
      return res;
    }),
  );

  ipcMain.handle('get-user-review', async (_event) => _apiCall(async () => supabaseApi.getUserReview()));

  ipcMain.handle('update-user-review', async (_event, { id, title, description, rating }) =>
    _apiCall(async () => supabaseApi.updateReview({ id, title, description, rating })),
  );

  ipcMain.handle('get-job-by-id', async (_event, { jobId }) =>
    _apiCall(async () => {
      const job = await supabaseApi.getJob(jobId);
      return { job };
    }),
  );

  ipcMain.handle('export-jobs-csv', async (_event, { status }) =>
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

  ipcMain.handle('change-all-job-status', async (_event, { from, to }) =>
    _apiCall(async () => {
      const job = await supabaseApi.changeAllJobStatus({ from, to });
      return { job };
    }),
  );

  ipcMain.handle('get-profile', async (_event) =>
    _apiCall(async () => {
      const profile = await supabaseApi.getProfile();
      return { profile };
    }),
  );

  ipcMain.handle('get-stripe-config', async (_event) =>
    _apiCall(async () => {
      const config = await getStripeConfig(nodeEnv);
      return { config };
    }),
  );

  ipcMain.handle('create-note', async (_event, { job_id, text, files }) =>
    _apiCall(async () => {
      const res = await supabaseApi.createNote({ job_id, text, files });
      analytics.trackEvent('note_created', { job_id, note_id: res.id });
      return res;
    }),
  );

  ipcMain.handle('list-notes', async (_event, { job_id }) => _apiCall(() => supabaseApi.listNotes(job_id)));

  ipcMain.handle('update-note', async (_event, { noteId, text }) =>
    _apiCall(() => supabaseApi.updateNote({ noteId, text })),
  );

  ipcMain.handle('add-file-to-note', async (_event, { noteId, file }) =>
    _apiCall(() => supabaseApi.addFileToNote({ noteId, file })),
  );

  ipcMain.handle('delete-note', async (_event, { noteId }) =>
    _apiCall(async () => {
      const res = await supabaseApi.deleteNote(noteId);
      analytics.trackEvent('note_deleted', { note_id: noteId });
      return res;
    }),
  );

  ipcMain.handle('get-advanced-matching-config', async (_event) =>
    _apiCall(() => supabaseApi.getAdvancedMatchingConfig()),
  );

  ipcMain.handle('update-advanced-matching-config', async (_event, { config }) =>
    _apiCall(async () => {
      const res = await supabaseApi.updateAdvancedMatchingConfig(config);
      analytics.trackEvent('advanced_matching_config_updated', { config: JSON.stringify(config) });
      return res;
    }),
  );

  ipcMain.handle('add-favorite-company', async (_event, { companyName }) =>
    _apiCall(() => supabaseApi.addFavoriteCompany(companyName)),
  );

  ipcMain.handle('remove-favorite-company', async (_event, { companyName }) =>
    _apiCall(() => supabaseApi.removeFavoriteCompany(companyName)),
  );

  ipcMain.handle('add-blacklisted-company', async (_event, { companyName }) =>
    _apiCall(() => supabaseApi.addBlacklistedCompany(companyName)),
  );

  ipcMain.handle('remove-blacklisted-company', async (_event, { companyName }) =>
    _apiCall(() => supabaseApi.removeBlacklistedCompany(companyName)),
  );

  ipcMain.handle('export-user-settings', async () => _apiCall(() => supabaseApi.exportUserSettings()));

  ipcMain.handle('import-user-settings', async (_event, { settings }) =>
    _apiCall(() => supabaseApi.importUserSettings(settings)),
  );

  ipcMain.handle('scan-link', async (_event, { linkId }) => _apiCall(() => jobScanner.scanLink({ linkId })));

  ipcMain.handle('open-overlay-browser-view', async (_event, { url }) => {
    return _apiCall(async () => overlayBrowserView.open(url));
  });
  ipcMain.handle('close-overlay-browser-view', async () => {
    return _apiCall(async () => overlayBrowserView.close());
  });
  ipcMain.handle('overlay-browser-can-view-go-back', async (_event) => {
    return _apiCall(async () => overlayBrowserView.canGoBack());
  });
  ipcMain.handle('overlay-browser-view-go-back', async () => {
    return _apiCall(async () => overlayBrowserView.goBack());
  });
  ipcMain.handle('overlay-browser-can-view-go-forward', async (_event) => {
    return _apiCall(async () => overlayBrowserView.canGoForward());
  });
  ipcMain.handle('overlay-browser-view-go-forward', async () => {
    return _apiCall(async () => overlayBrowserView.goForward());
  });
  ipcMain.handle('finish-overlay-browser-view', async () => {
    return _apiCall(async () => overlayBrowserView.finish());
  });
  ipcMain.handle('overlay-browser-view-navigate', async (_event, { url }) => {
    return _apiCall(async () => overlayBrowserView.navigate(url));
  });
}
