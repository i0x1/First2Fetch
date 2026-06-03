import { DbSchema, Job, JobLabel, JobStatus, Link, WebPageRuntimeData } from '@first2apply/core';
import { FunctionsHttpError, PostgrestError, SupabaseClient, User } from '@supabase/supabase-js';
import { backOff } from 'exponential-backoff';
import * as luxon from 'luxon';

/**
 * Class used to interact with our Supabase API.
 */
export class F2aSupabaseApi {
  constructor(
    private _supabase: SupabaseClient<DbSchema>,
    private _supabasePublishableKey: string | undefined,
  ) {}

  /**
   * Create a new user account using an email and password.
   */
  signupWithEmail({ email, password }: { email: string; password: string }) {
    return this._supabaseApiCall(() => this._supabase.auth.signUp({ email, password }));
  }

  /**
   * Login using an email and password.
   */
  async loginWithEmail({ email, password }: { email: string; password: string }) {
    return this._supabaseApiCall(() => this._supabase.auth.signInWithPassword({ email, password }));
  }

  /**
   * Send a password reset email.
   */
  sendPasswordResetEmail({ email }: { email: string }) {
    return this._supabaseApiCall(() =>
      this._supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'first2fetch://reset-password',
      }),
    );
  }

  /**
   * Update the password for the current user.
   */
  updatePassword({ password }: { password: string }) {
    return this._supabaseApiCall(() => this._supabase.auth.updateUser({ password }));
  }

  /**
   * Logout the current user.
   */
  async logout() {
    return this._supabaseApiCall(async () => this._supabase.auth.signOut());
  }

  /**
   * Get the user from the current supabase session
   */
  getUser(): Promise<{ user: User | null }> {
    return this._supabaseApiCall(async () => await this._supabase.auth.getUser()).catch(() => ({
      user: null as User | null,
    }));
  }

  /**
   * Create a new link.
   */
  async createLink({
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
  }) {
    const { link, newJobs } = await this._invokeEdgeFunction<
      { title: string; url: string; html: string; webPageRuntimeData: WebPageRuntimeData; force?: boolean },
      { link: Link; newJobs: Job[] }
    >('create-link', {
      title,
      url,
      html,
      webPageRuntimeData,
      force,
    });

    return { link, newJobs };
  }

  /**
   * Update an existing link.
   */
  async updateLink({ linkId, title, url }: { linkId: number; title: string; url: string }): Promise<Link> {
    const updatedLink = await this._supabaseApiCall(async () =>
      this._supabase.from('links').update({ title, url }).eq('id', linkId).select('*').single(),
    );

    return updatedLink;
  }

  /**
   * Get all registered links for the current user.
   */
  listLinks(): Promise<Link[]> {
    return this._supabaseApiCall(async () =>
      this._supabase.from('links').select('*').order('id', { ascending: false }),
    );
  }

  /**
   * Delete a link.
   */
  deleteLink(linkId: number) {
    return this._supabaseApiCall(async () => this._supabase.from('links').delete().eq('id', linkId));
  }

  /**
   * Scan a list of htmls for new jobs.
   */
  async scanHtmls(
    htmls: {
      linkId: number;
      content: string;
      webPageRuntimeData: WebPageRuntimeData;
      maxRetries: number;
      retryCount: number;
    }[],
  ) {
    return this._invokeEdgeFunction<{ htmls: typeof htmls }, { newJobs: Job[]; parseFailed: boolean }>('scan-urls', {
      htmls,
    });
  }

  /**
   * Scan HTML for a job description.
   */
  async scanJobDescription({
    jobId,
    html,
    maxRetries,
    retryCount,
  }: {
    jobId: number;
    html: string;
    maxRetries: number;
    retryCount: number;
  }) {
    return this._invokeEdgeFunction<
      { jobId: number; html: string; maxRetries: number; retryCount: number },
      { job: Job; parseFailed: boolean }
    >('scan-job-description', {
      jobId,
      html,
      maxRetries,
      retryCount,
    });
  }

  /**
   * Run the post scan hook edge function.
   */
  async runPostScanHook({ newJobIds, areEmailAlertsEnabled }: { newJobIds: number[]; areEmailAlertsEnabled: boolean }) {
    return this._invokeEdgeFunction<{ newJobIds: number[]; areEmailAlertsEnabled: boolean }, unknown>(
      'post-scan-hook',
      {
        newJobIds,
        areEmailAlertsEnabled,
      },
    );
  }

  /**
   * Get job date summaries (counts per date) for efficient UI rendering.
   * Groups by LOCAL timezone date.
   */
  async getJobDatesSummary({
    status,
    search,
    siteIds,
    linkIds,
    labels,
    hideReposted,
    timezone,
  }: {
    status: JobStatus;
    search?: string;
    siteIds?: number[];
    linkIds?: number[];
    labels?: string[];
    hideReposted?: boolean;
    timezone?: string; // User's timezone (e.g., 'America/Los_Angeles')
  }) {
    const jobs_search = search || undefined;
    const jobs_site_ids = siteIds?.length > 0 ? siteIds : undefined;
    const jobs_link_ids = linkIds?.length > 0 ? linkIds : undefined;
    const jobs_labels = labels?.length > 0 ? labels : undefined;
    // Get timezone from parameter or detect from browser
    const timezone_name = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    return this._supabaseApiCall<
      Array<{
        date_key: string;
        total_count: number;
        favorite_count: number;
      }>,
      PostgrestError
    >(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (this._supabase.rpc as unknown as any)('get_job_dates_summary', {
        jobs_status: status,
        jobs_search: jobs_search,
        jobs_site_ids: jobs_site_ids,
        jobs_link_ids: jobs_link_ids,
        jobs_labels: jobs_labels,
        hide_reposted: hideReposted ?? false,
        timezone_name: timezone_name,
      });

      return { data, error };
    });
  }

  async getJobCounts({
    search,
    siteIds,
    linkIds,
    labels,
    hideReposted,
  }: {
    search?: string;
    siteIds?: number[];
    linkIds?: number[];
    labels?: string[];
    hideReposted?: boolean;
  }) {
    const jobs_search = search || undefined;
    const jobs_site_ids = siteIds?.length > 0 ? siteIds : undefined;
    const jobs_link_ids = linkIds?.length > 0 ? linkIds : undefined;
    const jobs_labels = labels?.length > 0 ? labels : undefined;

    const counters = await this._supabaseApiCall<
      Array<{
        status: JobStatus;
        job_count: number;
      }>,
      PostgrestError
    >(async () => {
      const res = await this._supabase.rpc('count_jobs', {
        jobs_search,
        jobs_site_ids,
        jobs_link_ids,
        jobs_labels,
        hide_reposted: hideReposted ?? false,
      });

      return res;
    });

    const countersMap = new Map(counters.map((c) => [c.status, c.job_count]));
    return {
      new: countersMap.get('new') ?? 0,
      archived: countersMap.get('archived') ?? 0,
      applied: countersMap.get('applied') ?? 0,
      filtered: countersMap.get('excluded_by_advanced_matching') ?? 0,
    };
  }

  /**
   * List all jobs for the current user.
   * Filters by LOCAL timezone date if dateFilter is provided.
   */
  async listJobs({
    status,
    search,
    siteIds,
    linkIds,
    labels,
    hideReposted,
    limit = 50,
    after,
    dateFilter,
    timezone,
  }: {
    status: JobStatus;
    search?: string;
    siteIds?: number[];
    linkIds?: number[];
    labels?: string[];
    hideReposted?: boolean;
    limit?: number;
    after?: string;
    dateFilter?: string; // YYYY-MM-DD format (LOCAL date)
    timezone?: string; // User's timezone (e.g., 'America/Los_Angeles')
  }) {
    const jobs_search = search || undefined;
    const jobs_site_ids = siteIds?.length > 0 ? siteIds : undefined;
    const jobs_link_ids = linkIds?.length > 0 ? linkIds : undefined;
    const jobs_labels = labels?.length > 0 ? labels : undefined;
    // Get timezone from parameter or detect from browser
    const timezone_name = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const [jobs, counters] = await Promise.all([
      this._supabaseApiCall<Job[], PostgrestError>(async () => {
        const res = await this._supabase.rpc('list_jobs', {
          jobs_status: status,
          jobs_after: after ?? null,
          jobs_page_size: limit,
          jobs_search,
          jobs_site_ids,
          jobs_link_ids,
          jobs_labels,
          hide_reposted: hideReposted ?? false,
          date_filter: dateFilter || null,
          timezone_name: timezone_name,
        });

        return res;
      }),
      this._supabaseApiCall<
        Array<{
          status: JobStatus;
          job_count: number;
        }>,
        PostgrestError
      >(async () => {
        const res = await this._supabase.rpc('count_jobs', {
          jobs_search,
          jobs_site_ids,
          jobs_link_ids,
          jobs_labels,
          hide_reposted: hideReposted ?? false,
        });

        return res;
      }),
    ]);

    let nextPageToken: string | undefined;
    if (jobs.length === limit) {
      // the next page token will include the last id as well as it's last created_at
      const lastJob = jobs[jobs.length - 1];
      nextPageToken = `${lastJob.id}!${lastJob.created_at}`;
    }

    const countersMap = new Map(counters.map((c) => [c.status, c.job_count]));
    return {
      jobs,
      new: countersMap.get('new') ?? 0,
      archived: countersMap.get('archived') ?? 0,
      applied: countersMap.get('applied') ?? 0,
      filtered: countersMap.get('excluded_by_advanced_matching') ?? 0,
      nextPageToken,
    };
  }

  /**
   * Update the status of a job.
   */
  updateJobStatus({ jobId, status }: { jobId: number; status: JobStatus }) {
    return this._supabaseApiCall(
      async () =>
        await this._supabase
          .from('jobs')
          .update({
            status,
            updated_at: luxon.DateTime.now().toUTC().toJSDate(),
          })
          .eq('id', jobId),
    );
  }

  /**
   * Update the labels of a job.
   * @returns the updated job
   */
  async updateJobLabels({ jobId, labels }: { jobId: number; labels: JobLabel[] }) {
    const [updatedJob] = await this._supabaseApiCall(
      async () =>
        await this._supabase
          .from('jobs')
          .update({
            labels,
          })
          .eq('id', jobId)
          .select('*'),
    );

    return updatedJob;
  }

  /**
   * List all sites.
   */
  listSites() {
    return this._supabaseApiCall(async () => await this._supabase.from('sites').select('*'));
  }

  /**
   * Get a job by id.
   */
  async getJob(jobId: number) {
    const [job] = await this._supabaseApiCall(async () => this._supabase.from('jobs').select('*').eq('id', jobId));
    return job;
  }

  /**
   * Change the status of all jobs with a certain status to another status.
   */
  async changeAllJobStatus({ from, to }: { from: JobStatus; to: JobStatus }) {
    return this._supabaseApiCall(async () =>
      this._supabase
        .from('jobs')
        .update({
          status: to,
          updated_at: luxon.DateTime.now().toUTC().toJSDate(),
        })
        .eq('status', from),
    );
  }

  /**
   * Get authorization headers for edge function calls.
   * In Electron, we need to explicitly pass the auth header to edge functions.
   *
   * When verify_jwt is enabled on edge functions, Supabase gateway expects:
   * - Authorization: Bearer <user_jwt_token>
   * - apikey: <anon_key> (the public API key)
   */
  private async _getAuthHeaders(): Promise<Record<string, string>> {
    const {
      data: { session },
      error: sessionError,
    } = await this._supabase.auth.getSession();

    if (sessionError) {
      console.error('[_getAuthHeaders] Failed to get session:', sessionError);
      throw new Error(`Failed to get session: ${sessionError.message}`);
    }

    if (!session?.access_token) {
      console.error('[_getAuthHeaders] No access token in session:', session);
      throw new Error('No active session found. Please sign in again.');
    }

    this._validateSessionProject(session.access_token);
    console.log('[_getAuthHeaders] Successfully retrieved auth token, length:', session.access_token.length);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
    };

    const publishableKey = this._supabasePublishableKey?.trim();
    if (publishableKey) {
      headers.apikey = publishableKey;
    } else {
      // Let supabase-js include the key automatically, but log for diagnostics.
      console.warn('[_getAuthHeaders] Missing explicit Supabase publishable key, relying on default SDK headers');
    }

    return headers;
  }

  private async _invokeEdgeFunction<TBody extends object, TResponse>(
    functionName: string,
    body: TBody,
  ): Promise<TResponse> {
    const invoke = async (headers: Record<string, string>) =>
      this._supabaseApiCall(() =>
        this._supabase.functions.invoke<TResponse>(functionName, {
          body,
          headers,
        }),
      );

    const initialHeaders = await this._getAuthHeaders();
    try {
      return await invoke(initialHeaders);
    } catch (error) {
      if (!this._isUnauthorizedFunctionError(error)) {
        throw error;
      }

      console.warn(
        `[_invokeEdgeFunction] ${functionName} returned 401. Attempting a one-time session refresh and retry.`,
      );
      await this._refreshSessionForEdgeFunctionCall();
      const refreshedHeaders = await this._getAuthHeaders();
      return await invoke(refreshedHeaders);
    }
  }

  private async _refreshSessionForEdgeFunctionCall() {
    const {
      data: { session },
      error: getSessionError,
    } = await this._supabase.auth.getSession();

    if (getSessionError) {
      throw new Error(`Failed to refresh session: ${getSessionError.message}`);
    }

    if (!session?.refresh_token) {
      throw new Error('Session is invalid or expired. Please sign out and sign in again.');
    }

    const { error: refreshError } = await this._supabase.auth.refreshSession({
      refresh_token: session.refresh_token,
    });
    if (refreshError) {
      throw new Error(`Session refresh failed: ${refreshError.message}. Please sign in again.`);
    }
  }

  private _isUnauthorizedFunctionError(error: unknown): boolean {
    return error instanceof FunctionsHttpError && error.context?.status === 401;
  }

  private _validateSessionProject(accessToken: string) {
    const payload = this._decodeJwtPayload(accessToken);
    const tokenProjectRef = typeof payload?.ref === 'string' ? payload.ref : undefined;
    const currentProjectRef = this._extractProjectRefFromUrl();

    if (!tokenProjectRef || !currentProjectRef) {
      return;
    }

    if (tokenProjectRef !== currentProjectRef) {
      throw new Error(
        `Session token project mismatch (token ref: ${tokenProjectRef}, app ref: ${currentProjectRef}). ` +
          `Please sign out and sign in again.`,
      );
    }
  }

  private _extractProjectRefFromUrl(): string | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const url = (this._supabase as any)?.supabaseUrl;
    if (!url || typeof url !== 'string') {
      return undefined;
    }

    try {
      const parsed = new URL(url);
      return parsed.hostname.split('.')[0];
    } catch {
      return undefined;
    }
  }

  private _decodeJwtPayload(token: string): Record<string, unknown> | null {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

    try {
      return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private _isExpectedMissingSession(error: unknown): boolean {
    return error instanceof Error && error.message === 'Auth session missing!';
  }

  /**
   * Wrapper around a Supabase method that handles errors.
   */
  private async _supabaseApiCall<T, E extends Error | PostgrestError | FunctionsHttpError>(
    method: () => Promise<{ data?: T; error: E }>,
  ) {
    const { data, error } = await backOff(
      async () => {
        const result = await method();
        if (result.error) {
          if (!this._isExpectedMissingSession(result.error)) {
            const errorInfo = await this._formatErrorForLogging(result.error);
            console.error('[supabaseApiCall] Supabase call error:', errorInfo);
          }
          throw result.error;
        }

        return result;
      },
      {
        numOfAttempts: 5,
        jitter: 'full',
        startingDelay: 300,
        retry: (error) => this._isRetriableError(error),
      },
    );

    // edge functions don't throw errors, instead they return an errorMessage field in the data object
    // work around for this issue https://github.com/supabase/functions-js/issues/45
    if (!!data && typeof data === 'object' && 'errorMessage' in data && typeof data.errorMessage === 'string') {
      console.error('[supabaseApiCall] Edge function returned errorMessage in response body:', data.errorMessage);
      throw new Error(data.errorMessage);
    }

    if (error) {
      console.error('[supabaseApiCall] Unexpected error after backoff:', error);
      throw error;
    }

    return data;
  }

  private _isRetriableError(error: unknown): boolean {
    if (this._isExpectedMissingSession(error)) {
      return false;
    }
    if (error instanceof FunctionsHttpError) {
      const status = error.context?.status ?? 0;
      if (status === 408 || status === 429) {
        return true;
      }
      if (status >= 400 && status < 500) {
        return false;
      }
    }

    return true;
  }

  private async _formatErrorForLogging(error: unknown) {
    if (!(error instanceof FunctionsHttpError)) {
      return {
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
        error,
      };
    }

    let responseBody: string | null = null;
    try {
      if (error.context && !error.context.bodyUsed) {
        responseBody = await error.context.clone().text();
      }
    } catch {
      responseBody = null;
    }

    return {
      errorType: error.constructor.name,
      errorMessage: error.message,
      status: error.context?.status,
      statusText: error.context?.statusText,
      requestUrl: error.context?.url,
      responseBody,
    };
  }

  /**
   * Create a user review.
   */
  async createReview({ title, description, rating }: { title: string; description?: string; rating: number }) {
    const [createdReview] = await this._supabaseApiCall(
      async () =>
        await this._supabase
          .from('reviews')
          .insert({
            title: title.trim(),
            description: description?.trim(),
            rating,
          })
          .select('*'),
    );

    return createdReview;
  }

  /**
   * Get user's review.
   */
  async getUserReview() {
    const [review] = await this._supabaseApiCall(async () => await this._supabase.from('reviews').select('*'));

    return review;
  }

  /**
   * Update a user review.
   */
  async updateReview({
    id,
    title,
    description,
    rating,
  }: {
    id: number;
    title: string;
    description?: string;
    rating: number;
  }) {
    const [updatedReview] = await this._supabaseApiCall(
      async () =>
        await this._supabase
          .from('reviews')
          .update({
            title: title.trim(),
            description: description?.trim(),
            rating,
          })
          .eq('id', id)
          .select('*'),
    );

    return updatedReview;
  }

  /**
   * Get the profile of the current user.
   */
  async getProfile() {
    const [profile] = await this._supabaseApiCall(async () => await this._supabase.from('profiles').select('*'));

    return profile;
  }

  /**
   * Create a new note for the current user.
   */
  async createNote({ job_id, text, files }: { job_id: number; text: string; files?: string[] }) {
    const [createdNote] = await this._supabaseApiCall(
      async () => await this._supabase.from('notes').insert({ job_id, text, files }).select('*'),
    );

    return createdNote;
  }

  /**
   * Fetch all notes for the current user for a job.
   */
  async listNotes(job_id: number) {
    return this._supabaseApiCall(async () =>
      this._supabase.from('notes').select('*').eq('job_id', job_id).order('created_at', { ascending: false }),
    );
  }

  /**
   * Update an existing note by ID.
   */
  async updateNote({ noteId, text }: { noteId: number; text: string }) {
    return this._supabaseApiCall(async () =>
      this._supabase.from('notes').update({ text }).eq('id', noteId).select('*').single(),
    );
  }

  /**
   * Add a file to a note.
   */
  async addFileToNote({ noteId, file }: { noteId: number; file: string }) {
    const result = await this._supabase.from('notes').select('files').eq('id', noteId).single();

    if (result.error) {
      throw result.error;
    }

    const updatedFiles = result.data.files ? [...result.data.files, file] : [file];

    return this._supabaseApiCall(async () =>
      this._supabase.from('notes').update({ files: updatedFiles }).eq('id', noteId).single(),
    );
  }

  /**
   * Delete a specific note by ID.
   */
  async deleteNote(noteId: number) {
    return this._supabaseApiCall(async () => this._supabase.from('notes').delete().eq('id', noteId));
  }

  /**
   * Get the advanced matching configuration for the current user.
   */
  async getAdvancedMatchingConfig() {
    const [config] = await this._supabaseApiCall(
      async () => await this._supabase.from('advanced_matching').select('*'),
    );

    return config;
  }

  /**
   * Update the advanced matching configuration for the current user.
   * Uses RPC function to encrypt API keys securely.
   */
  private _aiFieldsFromConfig(config: Record<string, unknown>) {
    return {
      ai_provider: (config.ai_provider as string | null) ?? null,
      ai_model: (config.ai_model as string | null) ?? null,
      ai_jd_filter_provider: (config.ai_jd_filter_provider as string | null) ?? null,
      ai_jd_filter_model: (config.ai_jd_filter_model as string | null) ?? null,
      ai_job_list_provider: (config.ai_job_list_provider as string | null) ?? null,
      ai_job_list_model: (config.ai_job_list_model as string | null) ?? null,
      ai_jd_parse_provider: (config.ai_jd_parse_provider as string | null) ?? null,
      ai_jd_parse_model: (config.ai_jd_parse_model as string | null) ?? null,
    };
  }

  async updateAdvancedMatchingConfig(config: {
    chatgpt_prompt: string;
    blacklisted_companies: string[];
    favorite_companies: string[];
    watched_companies?: string[];
    ai_provider?: string | null;
    ai_model?: string | null;
    ai_api_key_encrypted?: string | null;
    ai_jd_filter_provider?: string | null;
    ai_jd_filter_model?: string | null;
    ai_job_list_provider?: string | null;
    ai_job_list_model?: string | null;
    ai_jd_parse_provider?: string | null;
    ai_jd_parse_model?: string | null;
    ai_api_keys?: Record<string, string> | null;
  }) {
    // Use RPC function to handle encryption
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedConfig, error } = await (this._supabase.rpc as any)(
      'update_advanced_matching_with_ai_config',
      {
        p_chatgpt_prompt: config.chatgpt_prompt,
        p_blacklisted_companies: config.blacklisted_companies,
        p_favorite_companies: config.favorite_companies,
        p_watched_companies: config.watched_companies || null,
        p_ai_provider: config.ai_provider || null,
        p_ai_model: config.ai_model || null,
        p_ai_api_key: config.ai_api_key_encrypted || null,
        p_ai_jd_filter_provider: config.ai_jd_filter_provider || null,
        p_ai_jd_filter_model: config.ai_jd_filter_model || null,
        p_ai_job_list_provider: config.ai_job_list_provider || null,
        p_ai_job_list_model: config.ai_job_list_model || null,
        p_ai_jd_parse_provider: config.ai_jd_parse_provider || null,
        p_ai_jd_parse_model: config.ai_jd_parse_model || null,
        p_ai_api_keys: config.ai_api_keys || null,
      },
    );

    if (error) {
      throw error;
    }

    return updatedConfig;
  }

  private _normalizeCompanyName(companyName: string): string {
    return companyName.trim();
  }

  private _ensureUniqueCompanies(companies: string[]): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const company of companies) {
      const trimmed = this._normalizeCompanyName(company);
      if (!trimmed) {
        continue;
      }
      const key = trimmed.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        normalized.push(trimmed);
      }
    }
    return normalized;
  }

  private async _getOrCreateAdvancedMatchingConfig() {
    const config = await this.getAdvancedMatchingConfig();
    if (config) {
      return config;
    }

    return await this.updateAdvancedMatchingConfig({
      chatgpt_prompt: '',
      blacklisted_companies: [],
      favorite_companies: [],
      watched_companies: [],
      ai_provider: null,
      ai_model: null,
      ai_api_key_encrypted: null,
    });
  }

  async addFavoriteCompany(companyName: string) {
    const config = await this._getOrCreateAdvancedMatchingConfig();
    const normalizedName = this._normalizeCompanyName(companyName);
    if (!normalizedName) {
      return config;
    }

    const normalizedLower = normalizedName.toLowerCase();
    const isInFavorites = config.favorite_companies.some((c: string) => c.toLowerCase() === normalizedLower);
    const isInWatched = (config.watched_companies || []).some((c: string) => c.toLowerCase() === normalizedLower);

    let updatedFavorites = [...config.favorite_companies];
    let updatedWatched = [...(config.watched_companies || [])];

    if (isInFavorites) {
      // Already in favorites, do nothing
      return config;
    } else if (isInWatched) {
      // Move from watched to favorites
      updatedWatched = updatedWatched.filter((c: string) => c.toLowerCase() !== normalizedLower);
      updatedFavorites = this._ensureUniqueCompanies([...updatedFavorites, normalizedName]);
    } else {
      // Not in either, add to watched
      updatedWatched = this._ensureUniqueCompanies([...updatedWatched, normalizedName]);
    }

    return this.updateAdvancedMatchingConfig({
      chatgpt_prompt: config.chatgpt_prompt,
      blacklisted_companies: config.blacklisted_companies,
      favorite_companies: updatedFavorites,
      watched_companies: updatedWatched,
      ...this._aiFieldsFromConfig(config),
    });
  }

  async removeFavoriteCompany(companyName: string) {
    const config = await this._getOrCreateAdvancedMatchingConfig();
    const normalizedName = this._normalizeCompanyName(companyName);
    const normalizedLower = normalizedName.toLowerCase();

    const updatedFavorites = config.favorite_companies.filter(
      (company: string) => company.toLowerCase() !== normalizedLower,
    );

    return this.updateAdvancedMatchingConfig({
      chatgpt_prompt: config.chatgpt_prompt,
      blacklisted_companies: config.blacklisted_companies,
      favorite_companies: updatedFavorites,
      watched_companies: config.watched_companies || [],
      ...this._aiFieldsFromConfig(config),
    });
  }

  async addBlacklistedCompany(companyName: string) {
    const config = await this._getOrCreateAdvancedMatchingConfig();
    const normalizedName = this._normalizeCompanyName(companyName);
    if (!normalizedName) {
      return config;
    }

    const normalizedLower = normalizedName.toLowerCase();
    const updatedBlacklist = this._ensureUniqueCompanies([...config.blacklisted_companies, normalizedName]);
    const updatedFavorites = config.favorite_companies.filter(
      (company: string) => company.toLowerCase() !== normalizedLower,
    );
    const updatedWatched = (config.watched_companies || []).filter(
      (company: string) => company.toLowerCase() !== normalizedLower,
    );

    return this.updateAdvancedMatchingConfig({
      chatgpt_prompt: config.chatgpt_prompt,
      blacklisted_companies: updatedBlacklist,
      favorite_companies: updatedFavorites,
      watched_companies: updatedWatched,
      ...this._aiFieldsFromConfig(config),
    });
  }

  async removeBlacklistedCompany(companyName: string) {
    const config = await this._getOrCreateAdvancedMatchingConfig();
    const normalizedName = this._normalizeCompanyName(companyName);
    const updatedBlacklist = config.blacklisted_companies.filter(
      (company: string) => company.toLowerCase() !== normalizedName.toLowerCase(),
    );

    return this.updateAdvancedMatchingConfig({
      chatgpt_prompt: config.chatgpt_prompt,
      blacklisted_companies: updatedBlacklist,
      favorite_companies: config.favorite_companies,
      watched_companies: config.watched_companies || [],
      ...this._aiFieldsFromConfig(config),
    });
  }

  async addWatchedCompany(companyName: string) {
    const config = await this._getOrCreateAdvancedMatchingConfig();
    const normalizedName = this._normalizeCompanyName(companyName);
    if (!normalizedName) {
      return config;
    }

    const normalizedLower = normalizedName.toLowerCase();
    // If company is already in favorites, move it to favorites (promote it)
    const isInFavorites = config.favorite_companies.some((c: string) => c.toLowerCase() === normalizedLower);

    if (isInFavorites) {
      // Already in favorites, do nothing
      return config;
    }

    // Remove from watched if exists, then add to watched
    const updatedWatched = this._ensureUniqueCompanies([
      ...(config.watched_companies || []).filter((c: string) => c.toLowerCase() !== normalizedLower),
      normalizedName,
    ]);

    return this.updateAdvancedMatchingConfig({
      chatgpt_prompt: config.chatgpt_prompt,
      blacklisted_companies: config.blacklisted_companies,
      favorite_companies: config.favorite_companies,
      watched_companies: updatedWatched,
      ...this._aiFieldsFromConfig(config),
    });
  }

  async removeWatchedCompany(companyName: string) {
    const config = await this._getOrCreateAdvancedMatchingConfig();
    const normalizedName = this._normalizeCompanyName(companyName);
    const updatedWatched = (config.watched_companies || []).filter(
      (company: string) => company.toLowerCase() !== normalizedName.toLowerCase(),
    );

    return this.updateAdvancedMatchingConfig({
      chatgpt_prompt: config.chatgpt_prompt,
      blacklisted_companies: config.blacklisted_companies,
      favorite_companies: config.favorite_companies,
      watched_companies: updatedWatched,
      ...this._aiFieldsFromConfig(config),
    });
  }

  /**
   * Increase scrape failure count for a link.
   */
  async increaseScrapeFailureCount({ linkId, failures }: { linkId: number; failures: number }) {
    await this._supabaseApiCall(async () =>
      this._supabase.from('links').update({ scrape_failure_count: failures }).eq('id', linkId),
    );
  }

  async exportUserSettings() {
    const config = await this._getOrCreateAdvancedMatchingConfig();
    const [links, sites] = await Promise.all([
      this._supabaseApiCall(async () =>
        this._supabase.from('links').select('title,url,site_id').order('created_at', { ascending: true }),
      ),
      this._supabaseApiCall(async () => this._supabase.from('sites').select('id,name')),
    ]);

    const siteNameMap = new Map<number, string>();
    for (const site of sites ?? []) {
      if (site?.id && site?.name) {
        siteNameMap.set(site.id, site.name);
      }
    }

    const savedSearches =
      links?.map((link) => ({
        title: link.title,
        url: link.url,
        site_id: link.site_id,
        site_name: siteNameMap.get(link.site_id) ?? null,
      })) ?? [];

    return {
      version: '1.0',
      exported_at: new Date().toISOString(),
      advanced_matching: {
        chatgpt_prompt: config.chatgpt_prompt,
        blacklisted_companies: config.blacklisted_companies,
        favorite_companies: config.favorite_companies,
        ai_provider: config.ai_provider ?? null,
        ai_model: config.ai_model ?? null,
        ai_jd_filter_provider: config.ai_jd_filter_provider ?? null,
        ai_jd_filter_model: config.ai_jd_filter_model ?? null,
        ai_job_list_provider: config.ai_job_list_provider ?? null,
        ai_job_list_model: config.ai_job_list_model ?? null,
        ai_jd_parse_provider: config.ai_jd_parse_provider ?? null,
        ai_jd_parse_model: config.ai_jd_parse_model ?? null,
      },
      saved_searches: savedSearches,
    };
  }

  async importUserSettings(settings: {
    version: string;
    advanced_matching?: {
      chatgpt_prompt?: string;
      blacklisted_companies?: string[];
      favorite_companies?: string[];
      ai_provider?: string | null;
      ai_model?: string | null;
    };
    saved_searches?: Array<{
      title?: string;
      url?: string;
      site_id?: number | null;
      site_name?: string | null;
    }>;
  }) {
    if (!settings || typeof settings !== 'object') {
      throw new Error('Invalid settings payload');
    }

    if (!settings.version || settings.version !== '1.0') {
      throw new Error(`Unsupported settings version: ${settings.version ?? 'unknown'}`);
    }

    // Get current config to preserve AI settings if not provided in import
    const currentConfig = await this.getAdvancedMatchingConfig();

    const advancedMatching = settings.advanced_matching ?? {};

    // Only update AI provider/model if explicitly provided in import (not undefined)
    // This preserves existing AI settings when importing old backup files that don't have them
    const pickAi = (field: string) => {
      const imported = (advancedMatching as Record<string, unknown>)[field];
      if (imported !== undefined) {
        return imported as string | null;
      }
      return (currentConfig as Record<string, unknown> | undefined)?.[field] as string | null ?? null;
    };

    const updatedConfig = await this.updateAdvancedMatchingConfig({
      chatgpt_prompt: advancedMatching.chatgpt_prompt ?? '',
      blacklisted_companies: this._ensureUniqueCompanies(advancedMatching.blacklisted_companies ?? []),
      favorite_companies: this._ensureUniqueCompanies(advancedMatching.favorite_companies ?? []),
      ai_provider: pickAi('ai_provider'),
      ai_model: pickAi('ai_model'),
      ai_jd_filter_provider: pickAi('ai_jd_filter_provider'),
      ai_jd_filter_model: pickAi('ai_jd_filter_model'),
      ai_job_list_provider: pickAi('ai_job_list_provider'),
      ai_job_list_model: pickAi('ai_job_list_model'),
      ai_jd_parse_provider: pickAi('ai_jd_parse_provider'),
      ai_jd_parse_model: pickAi('ai_jd_parse_model'),
    });

    const savedSearches = settings.saved_searches ?? [];
    if (savedSearches.length === 0) {
      return updatedConfig;
    }

    const [existingLinks, sites] = await Promise.all([
      this._supabaseApiCall(async () => this._supabase.from('links').select('id,url')),
      this._supabaseApiCall(async () => this._supabase.from('sites').select('id,name')),
    ]);

    const existingLinksByUrl = new Map<string, { id: number }>();
    for (const link of existingLinks ?? []) {
      if (link?.url) {
        existingLinksByUrl.set(link.url.toLowerCase(), { id: link.id });
      }
    }

    const siteIdByName = new Map<string, number>();
    for (const site of sites ?? []) {
      if (site?.id && site?.name) {
        siteIdByName.set(site.name.toLowerCase(), site.id);
      }
    }

    for (const saved of savedSearches) {
      if (!saved?.url) {
        continue;
      }

      const normalizedUrl = saved.url.trim();
      if (!normalizedUrl) {
        continue;
      }

      let siteId: number | undefined = undefined;
      if (typeof saved.site_id === 'number') {
        siteId = saved.site_id;
      } else if (saved.site_name) {
        siteId = siteIdByName.get(saved.site_name.toLowerCase());
      }

      if (!siteId) {
        // Skip saved search if we can't determine a valid site
        continue;
      }

      const title = (saved.title ?? '').trim() || normalizedUrl;
      const existing = existingLinksByUrl.get(normalizedUrl.toLowerCase());

      if (existing) {
        await this._supabaseApiCall(async () =>
          this._supabase.from('links').update({ title, site_id: siteId, url: normalizedUrl }).eq('id', existing.id),
        );
      } else {
        await this._supabaseApiCall(async () =>
          this._supabase
            .from('links')
            .insert({
              title,
              url: normalizedUrl,
              site_id: siteId,
            })
            .select('id'),
        );
      }
    }

    return updatedConfig;
  }
}
