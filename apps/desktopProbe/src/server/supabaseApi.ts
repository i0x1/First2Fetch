import { DbSchema, Job, JobLabel, JobStatus, Link } from '@first2apply/core';
import { FunctionsHttpError, PostgrestError, SupabaseClient, User } from '@supabase/supabase-js';
import { backOff } from 'exponential-backoff';
import * as luxon from 'luxon';

/**
 * Class used to interact with our Supabase API.
 */
export class F2aSupabaseApi {
  constructor(private _supabase: SupabaseClient<DbSchema>) {}

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
  async createLink({ title, url, html }: { title: string; url: string; html: string }) {
    // for debugging, use a test.html file
    // const htmlFixture = fs.readFileSync(path.join(__dirname, '../../../test.html'), 'utf-8');
    // html = htmlFixture;

    const { link, newJobs } = await this._supabaseApiCall(() =>
      this._supabase.functions.invoke<{ link: Link; newJobs: Job[] }>('create-link', {
        body: {
          title,
          url,
          html,
        },
      }),
    );

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
  scanHtmls(
    htmls: {
      linkId: number;
      content: string;
      maxRetries: number;
      retryCount: number;
    }[],
  ) {
    return this._supabaseApiCall(() =>
      this._supabase.functions.invoke<{ newJobs: Job[]; parseFailed: boolean }>('scan-urls', {
        body: {
          htmls,
        },
      }),
    );
  }

  /**
   * Scan HTML for a job description.
   */
  scanJobDescription({
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
    return this._supabaseApiCall(() =>
      this._supabase.functions.invoke<{ job: Job; parseFailed: boolean }>('scan-job-description', {
        body: {
          jobId,
          html,
          maxRetries,
          retryCount,
        },
      }),
    );
  }

  /**
   * Run the post scan hook edge function.
   */
  runPostScanHook({ newJobIds, areEmailAlertsEnabled }: { newJobIds: number[]; areEmailAlertsEnabled: boolean }) {
    return this._supabaseApiCall(() =>
      this._supabase.functions.invoke('post-scan-hook', {
        body: {
          newJobIds,
          areEmailAlertsEnabled,
        },
      }),
    );
  }

  /**
   * List all jobs for the current user.
   */
  async listJobs({
    status,
    search,
    siteIds,
    linkIds,
    labels,
    limit = 50,
    after,
  }: {
    status: JobStatus;
    search?: string;
    siteIds?: number[];
    linkIds?: number[];
    labels?: string[];
    limit?: number;
    after?: string;
  }) {
    const jobs_search = search || undefined;
    const jobs_site_ids = siteIds?.length > 0 ? siteIds : undefined;
    const jobs_link_ids = linkIds?.length > 0 ? linkIds : undefined;
    const jobs_labels = labels?.length > 0 ? labels : undefined;
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
        });

        return res;
      }),
    ]);

    let nextPageToken: string | undefined;
    if (jobs.length === limit) {
      // the next page token will include the last id as well as it's last updated_at
      const lastJob = jobs[jobs.length - 1];
      nextPageToken = `${lastJob.id}!${lastJob.updated_at}`;
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
   * Wrapper around a Supabase method that handles errors.
   */
  private async _supabaseApiCall<T, E extends Error | PostgrestError | FunctionsHttpError>(
    method: () => Promise<{ data?: T; error: E }>,
  ) {
    const { data, error } = await backOff(
      async () => {
        const result = await method();
        if (result.error) {
          // Log more details about the error for debugging
          console.error('[supabaseApiCall] Edge function error:', {
            errorType: result.error.constructor.name,
            errorMessage: result.error.message,
            error: result.error,
          });
          throw result.error;
        }

        return result;
      },
      {
        numOfAttempts: 5,
        jitter: 'full',
        startingDelay: 300,
      },
    );

    // edge functions don't throw errors, instead they return an errorMessage field in the data object
    // work around for this issue https://github.com/supabase/functions-js/issues/45
    if (
      !!data &&
      typeof data === 'object' &&
      'errorMessage' in data &&
      typeof data.errorMessage === 'string'
    ) {
      console.error('[supabaseApiCall] Edge function returned errorMessage in response body:', data.errorMessage);
      throw new Error(data.errorMessage);
    }

    if (error) {
      console.error('[supabaseApiCall] Unexpected error after backoff:', error);
      throw error;
    }

    return data;
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
  async updateAdvancedMatchingConfig(config: {
    chatgpt_prompt: string;
    blacklisted_companies: string[];
    favorite_companies: string[];
    ai_provider?: string | null;
    ai_model?: string | null;
    ai_api_key_encrypted?: string | null;
  }) {
    // Use RPC function to handle encryption
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedConfig, error } = await (this._supabase.rpc as any)('update_advanced_matching_with_ai_config', {
      p_chatgpt_prompt: config.chatgpt_prompt,
      p_blacklisted_companies: config.blacklisted_companies,
      p_favorite_companies: config.favorite_companies,
      p_ai_provider: config.ai_provider || null,
      p_ai_model: config.ai_model || null,
      p_ai_api_key: config.ai_api_key_encrypted || null, // This will be encrypted in the function
    });

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

    const updatedFavorites = this._ensureUniqueCompanies([...config.favorite_companies, normalizedName]);

    return this.updateAdvancedMatchingConfig({
      chatgpt_prompt: config.chatgpt_prompt,
      blacklisted_companies: config.blacklisted_companies,
      favorite_companies: updatedFavorites,
      ai_provider: config.ai_provider,
      ai_model: config.ai_model,
    });
  }

  async removeFavoriteCompany(companyName: string) {
    const config = await this._getOrCreateAdvancedMatchingConfig();
    const normalizedName = this._normalizeCompanyName(companyName);
    const updatedFavorites = config.favorite_companies.filter(
      (company: string) => company.toLowerCase() !== normalizedName.toLowerCase(),
    );

    return this.updateAdvancedMatchingConfig({
      chatgpt_prompt: config.chatgpt_prompt,
      blacklisted_companies: config.blacklisted_companies,
      favorite_companies: updatedFavorites,
      ai_provider: config.ai_provider,
      ai_model: config.ai_model,
    });
  }

  async addBlacklistedCompany(companyName: string) {
    const config = await this._getOrCreateAdvancedMatchingConfig();
    const normalizedName = this._normalizeCompanyName(companyName);
    if (!normalizedName) {
      return config;
    }

    const updatedBlacklist = this._ensureUniqueCompanies([...config.blacklisted_companies, normalizedName]);
    const updatedFavorites = config.favorite_companies.filter(
      (company: string) => company.toLowerCase() !== normalizedName.toLowerCase(),
    );

    return this.updateAdvancedMatchingConfig({
      chatgpt_prompt: config.chatgpt_prompt,
      blacklisted_companies: updatedBlacklist,
      favorite_companies: updatedFavorites,
      ai_provider: config.ai_provider,
      ai_model: config.ai_model,
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
      ai_provider: config.ai_provider,
      ai_model: config.ai_model,
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

    const advancedMatching = settings.advanced_matching ?? {};

    const updatedConfig = await this.updateAdvancedMatchingConfig({
      chatgpt_prompt: advancedMatching.chatgpt_prompt ?? '',
      blacklisted_companies: this._ensureUniqueCompanies(advancedMatching.blacklisted_companies ?? []),
      favorite_companies: this._ensureUniqueCompanies(advancedMatching.favorite_companies ?? []),
      ai_provider: advancedMatching.ai_provider ?? null,
      ai_model: advancedMatching.ai_model ?? null,
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
