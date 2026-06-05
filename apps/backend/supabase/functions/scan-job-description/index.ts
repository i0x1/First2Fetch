import { Job, SiteProvider } from '@first2apply/core';
import { getExceptionMessage } from '@first2apply/core';

import { applyAdvancedMatchingFilters } from '../_shared/advancedMatching.ts';
import { CORS_HEADERS } from '../_shared/cors.ts';
import { getEdgeFunctionContext } from '../_shared/edgeFunctions.ts';
import { parseJobDescriptionUpdates } from '../_shared/jobDescriptionParser.ts';
import { createLoggerWithMeta } from '../_shared/logger.ts';

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
          description: updates.description ?? job.description,
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

        const { newStatus, excludeReason } = await applyAdvancedMatchingFilters({
          logger,
          job: updatedJob,
          supabaseClient,
          supabaseAdminClient,
        });

        updatedJob = {
          ...updatedJob,
          status: newStatus,
          exclude_reason: excludeReason,
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

        const { error: updateJobErr } = await supabaseClient
          .from('jobs')
          .update({
            description: updatedJob.description,
            salary: updatedJob.salary,
            tags: updatedJob.tags,
            status: updatedJob.status,
            updated_at: new Date(),
            exclude_reason: updatedJob.exclude_reason,
          })
          .eq('id', jobId)

          // I think this is causing jobs to be put back on new from deleted
          // if the app fails to process an entire batch in one cron interval
          // then the same job will be processed twice (since it's status is processing still)
          .in('status', ['processing', 'new']);
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
          await supabaseClient
            .from('jobs')
            .update({
              status: 'new',
              updated_at: new Date(),
            })
            .eq('id', jobId)
            .in('status', ['processing', 'new']);
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

    // Let's add a timeout of 30 seconds on the parsing operation, but without failing it
    // This means it will still work in the background, but the client will not wait for it.
    const timeoutPromise = new Promise<{
      updatedJob: Job;
      parseFailed: boolean;
    }>((resolve) => {
      setTimeout(() => {
        resolve({
          updatedJob: job,
          parseFailed: false,
        });
      }, 30_000);
    });

    const { updatedJob, parseFailed } = await Promise.race([
      parseDescriptionAndSaveUpdates().catch((error) => {
        // If Promise.race rejects, catch it and return the original job
        logger.error('job description scan promise failed', { jobId, error: getExceptionMessage(error) });
        return {
          updatedJob: job,
          parseFailed: true,
        };
      }),
      timeoutPromise,
    ]);

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
