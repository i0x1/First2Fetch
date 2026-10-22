import { Job, SiteProvider } from '@first2apply/core';
import { getExceptionMessage } from '@first2apply/core';

import { applyAdvancedMatchingFilters } from '../_shared/advancedMatching.ts';
import { CORS_HEADERS } from '../_shared/cors.ts';
import { getEdgeFunctionContext } from '../_shared/edgeFunctions.ts';
import { parseJobDescriptionUpdates } from '../_shared/jobDescriptionParser.ts';
import { createLoggerWithMeta } from '../_shared/logger.ts';
import { normalizeJobDescription } from '@first2apply/core';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const logger = createLoggerWithMeta({
    function: 'scan-job-description',
  });
  try {
    const context = await getEdgeFunctionContext({
      logger,
      req,
      checkAuthorization: true,
    });
    const { supabaseClient, supabaseAdminClient } = context;

    const body: {
      jobId: number;
      html: string;
      maxRetries?: number;
      retryCount?: number;
    } = await req.json();
    const { jobId, html, maxRetries, retryCount } = body;
    logger.info('job description scan started', { jobId, retryCount, maxRetries });

    // find the job and its site
    const { data: job, error: findJobErr } = await supabaseClient.from('jobs').select('*').eq('id', jobId).single();
    if (findJobErr) {
      throw findJobErr;
    }
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const { data: site, error: findSiteErr } = await supabaseClient
      .from('sites')
      .select('*')
      .eq('id', job.siteId)
      .single();
    if (findSiteErr) {
      throw findSiteErr;
    }

    const parseDescriptionAndSaveUpdates = async () => {
      try {
        let updatedJob: Job = { ...job, status: 'new' };

        // parse the job description
        logger.debug('job description parse started', { jobId, provider: site.provider });

        // update the job with the description
        const updates = await parseJobDescriptionUpdates({
          site,
          job,
          html,
          ...context,
        });
        const isLastRetry = retryCount === maxRetries;
        updatedJob = {
          ...updatedJob,
          description: normalizeJobDescription(updates.description) ?? normalizeJobDescription(job.description),
          salary: !job.salary ? updates.salary : job.salary,
          tags: Array.from(new Set((job.tags ?? []).concat(updates.tags ?? []))),
        };
        if (!updates.description && isLastRetry) {
          logger.error('job description parser returned no description', {
            jobId,
            url: job.externalUrl,
            site: site.provider,
          });

          await supabaseClient.from('html_dumps').insert([{ url: job.externalUrl, html }]);
        }

        if (updates.description) {
          logger.debug('job description parsed', {
            jobId,
            site: site.provider,
            title: job.title,
          });
        }

        const match = await applyAdvancedMatchingFilters({
          logger,
          job: updatedJob,
          supabaseClient,
          supabaseAdminClient,
        });

        updatedJob = {
          ...updatedJob,
          status: match.newStatus,
          exclude_reason: match.excludeReason,
        };

        if (!updatedJob.description) {
          // use original description to avoid empty descriptions
          updatedJob.description = job.description;
        }

        logger.info('job description scan completed', {
          jobId,
          status: updatedJob.status,
          site: site.provider,
        });

        const { error: updateJobErr } = await supabaseClient.rpc('workspace_apply_job_scan_v1', { job_id: jobId, updates: {
          description: updatedJob.description,
          salary: updatedJob.salary,
          tags: updatedJob.tags,
          status: updatedJob.status,
          exclude_reason: updatedJob.exclude_reason ?? null,
          updated_at: new Date().toISOString(),
        } });
        if (updateJobErr) {
          throw updateJobErr;
        }

        // Report failure from this parse attempt, not from the DB fallback description.
        const descriptionExtracted = Boolean(updates.description?.trim());
        const parseFailed =
          site.provider === SiteProvider.robertHalf
            ? !job.description?.trim()
            : !descriptionExtracted;

        return { updatedJob, parseFailed };
      } catch (error) {
        // If parsing fails, log the error and update job status to 'new' so it can be retried
        // This ensures the function doesn't crash and jobs don't get stuck in 'processing' status
        logger.error('job description scan failed', { jobId, error: getExceptionMessage(error) });
        
        // Update job status back to 'new' so it can be retried and shows up in frontend
        try {
          const { error: resetError } = await supabaseClient.rpc('workspace_apply_job_scan_v1', { job_id: jobId, updates: {
            status: 'new',
            exclude_reason: getExceptionMessage(error).slice(0, 1000),
            updated_at: new Date().toISOString(),
          } });
          if (resetError) throw resetError;
        } catch (updateError) {
          logger.error('failed to reset job status after parser error', {
            jobId,
            error: getExceptionMessage(updateError),
          });
        }
        
        return {
          updatedJob: { ...job, status: 'new' },
          parseFailed: true,
        };
      }
    };

    // The caller must receive the saved result. Returning the original job
    // after a timer makes a pending description look like a successful scan.
    const { updatedJob, parseFailed } = await parseDescriptionAndSaveUpdates();

    return new Response(JSON.stringify({ job: updatedJob, parseFailed }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (error) {
    logger.error(getExceptionMessage(error));
    return new Response(JSON.stringify({ errorMessage: getExceptionMessage(error, true) }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      // until this is fixed: https://github.com/supabase/functions-js/issues/45
      // we have to return 200 and handle the error on the client side
      status: 200,
    });
  }
});
