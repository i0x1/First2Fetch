'use server';

import { isValidEmailOtp, JobStatus, WorkspaceJobEvent, WorkspaceMembership } from '@first2apply/core';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) redirect(`/login?error=${encodeURIComponent('Login failed. Check the email and password.')}`);
  redirect('/jobs/new');
}

export async function requestLoginCode(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect(`/login?step=code&email=${encodeURIComponent(email)}&message=${encodeURIComponent('Check your email for the sign-in code.')}`);
}

export async function verifyLoginCode(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  if (!isValidEmailOtp(token)) redirect(`/login?step=code&email=${encodeURIComponent(email)}&error=${encodeURIComponent('Enter the 6- or 8-digit code from your email.')}`);
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) redirect(`/login?step=code&email=${encodeURIComponent(email)}&error=${encodeURIComponent('The code is invalid or expired.')}`);
  redirect('/jobs/new');
}

export async function signup(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (password.length < 8) redirect(`/signup?error=${encodeURIComponent('Use at least 8 characters for the password.')}`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  if (!data.session) redirect(`/login?message=${encodeURIComponent('Check your email to confirm the account.')}`);
  redirect('/jobs/new');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function acceptWorkspaceInvitation() {
  const supabase = await createClient();
  await supabase.rpc('accept_workspace_invitation');
}

const WEB_JOB_PAGE_SIZE = 50;

export async function listJobsPage(status: JobStatus, cursor?: string, search = '') {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('list_jobs', {
    jobs_status: status,
    jobs_after: cursor ?? null,
    jobs_page_size: WEB_JOB_PAGE_SIZE,
    jobs_search: search || null,
    jobs_site_ids: null,
    jobs_link_ids: null,
    jobs_labels: null,
    hide_reposted: false,
    date_filter: null,
    timezone_name: 'UTC',
  });
  if (error) throw new Error(`Unable to load jobs: ${error.message}`);
  const jobs = data ?? [];
  const lastJob = jobs[jobs.length - 1];
  return {
    jobs,
    nextCursor: jobs.length === WEB_JOB_PAGE_SIZE && lastJob ? `${lastJob.id}!${lastJob.updated_at}` : undefined,
  };
}

export async function listJobs(status: JobStatus, search = '') {
  return (await listJobsPage(status, undefined, search)).jobs;
}

export async function loadJobsPage(status: JobStatus, cursor?: string, search = '') {
  return listJobsPage(status, cursor, search);
}

export async function listJobCounts() {
  const supabase = await createClient();
  const statuses: JobStatus[] = ['new', 'ready', 'applied', 'archived', 'excluded_by_advanced_matching'];
  const results = await Promise.all(
    statuses.map((status) => supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', status)),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(`Unable to load job counts: ${failed.error.message}`);
  return {
    new: results[0].count ?? 0,
    ready: results[1].count ?? 0,
    applied: results[2].count ?? 0,
    archived: results[3].count ?? 0,
    filtered: results[4].count ?? 0,
  };
}

export async function listJobSearches() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('links').select('id,title');
  if (error) throw new Error(`Unable to load searches: ${error.message}`);
  return data ?? [];
}

export async function getJob(jobId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
  if (error) throw new Error(`Unable to load job: ${error.message}`);
  if (!data) throw new Error('Job not found in this workspace.');
  return data;
}

export async function listJobEvents(jobId: number): Promise<WorkspaceJobEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('workspace_job_events').select('*').eq('job_id', jobId).order('created_at', { ascending: false });
  if (error) throw new Error(`Unable to load job activity: ${error.message}`);
  return data ?? [];
}

export async function listJobNotes(jobId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('notes').select('*').eq('job_id', jobId).order('created_at', { ascending: false });
  if (error) throw new Error(`Unable to load notes: ${error.message}`);
  return data ?? [];
}

export async function createJobNote(formData: FormData) {
  const jobId = Number(formData.get('jobId'));
  const text = String(formData.get('text') ?? '').trim();
  if (!Number.isInteger(jobId) || !text) throw new Error('A job and note text are required.');
  const supabase = await createClient();
  const { error } = await supabase.from('notes').insert({ job_id: jobId, text, files: [] });
  if (error) throw new Error(`Unable to create note: ${error.message}`);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/jobs/new');
  revalidatePath('/jobs/ready');
  revalidatePath('/jobs/applied');
  revalidatePath('/jobs/archived');
}

export async function updateJobReview(formData: FormData) {
  const jobId = Number(formData.get('jobId'));
  const statusValue = formData.get('status');
  const labelsValue = formData.get('labels');
  const status = statusValue ? (String(statusValue) as JobStatus) : null;
  const labels = labelsValue ? String(labelsValue).split(',').map((label) => label.trim()).filter(Boolean) : null;

  if (!Number.isInteger(jobId) || (!status && !labels)) throw new Error('Invalid job review update.');

  const supabase = await createClient();
  const { error } = await supabase.rpc('workspace_update_job_review', {
    job_id: jobId,
    new_status: status,
    new_labels: labels,
  });
  if (error) throw new Error(`Unable to update job: ${error.message}`);

  revalidatePath('/jobs/new');
  revalidatePath('/jobs/applied');
  revalidatePath('/jobs/archived');
  revalidatePath(`/jobs/${jobId}`);
}

export async function listWorkspaceMembers(): Promise<WorkspaceMembership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('workspace_memberships').select('*').order('created_at');
  if (error) throw new Error(`Unable to load workspace members: ${error.message}`);
  return data ?? [];
}

export async function inviteMember(formData: FormData) {
  const memberEmail = String(formData.get('email') ?? '').trim();
  const supabase = await createClient();
  const { error } = await supabase.functions.invoke('invite-workspace-member', { body: { email: memberEmail } });
  if (error) redirect(`/team?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/team');
  redirect('/team?message=Invitation%20sent');
}

export async function removeMember(formData: FormData) {
  const memberId = String(formData.get('memberId') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_workspace_member', { member_id: memberId });
  if (error) redirect(`/team?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/team');
  redirect('/team?message=Helper%20removed');
}
