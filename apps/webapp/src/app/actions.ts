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

export async function listJobs(status: JobStatus, search = '') {
  const supabase = await createClient();
  if (!search) {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', status)
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(`Unable to load jobs: ${error.message}`);
    return data ?? [];
  }

  const [titleResult, companyResult] = await Promise.all([
    supabase.from('jobs').select('*').eq('status', status).ilike('title', `%${search}%`).limit(100),
    supabase.from('jobs').select('*').eq('status', status).ilike('companyName', `%${search}%`).limit(100),
  ]);
  if (titleResult.error) throw new Error(`Unable to load jobs: ${titleResult.error.message}`);
  if (companyResult.error) throw new Error(`Unable to load jobs: ${companyResult.error.message}`);

  const jobsById = new Map([...(titleResult.data ?? []), ...(companyResult.data ?? [])].map((job) => [job.id, job]));
  return [...jobsById.values()]
    .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
    .slice(0, 100);
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
