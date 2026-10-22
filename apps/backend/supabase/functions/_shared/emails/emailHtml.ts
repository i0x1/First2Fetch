import {
  EmailTemplate,
  EmailTemplateType,
  NewJobAlertEmailTemplate,
  SearchParsingFailureEmailTemplate,
  WorkspaceInvitationEmailTemplate,
} from './emailTemplates.ts';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function buildEmailContent(template: EmailTemplate): { subject: string; html: string } {
  switch (template.type) {
    case EmailTemplateType.searchParsingFailure:
      return buildSearchParsingFailureEmail(template);
    case EmailTemplateType.newJobAlert:
      return buildNewJobAlertEmail(template);
    case EmailTemplateType.workspaceInvitation:
      return buildWorkspaceInvitationEmail(template);
    default:
      throw new Error(`Unsupported email template type: ${(template as EmailTemplate).type}`);
  }
}

function buildWorkspaceInvitationEmail(template: WorkspaceInvitationEmailTemplate): { subject: string; html: string } {
  return {
    subject: 'You have access to a First 2 Apply workspace',
    html: `
      <p>Hello,</p>
      <p><strong>${escapeHtml(template.payload.ownerEmail)}</strong> invited you to help review job applications in First 2 Apply.</p>
      <p><a href="${escapeHtml(template.payload.magicLink)}">Open the shared workspace</a></p>
      <p>This link signs you in once. You can also open <a href="${escapeHtml(template.payload.appUrl)}">First 2 Apply</a> and request a new email code.</p>
      <p>If you did not expect this invitation, you can ignore this email.</p>
      <p>Thanks,<br/>First 2 Apply</p>
    `.trim(),
  };
}

function buildSearchParsingFailureEmail(template: SearchParsingFailureEmailTemplate): { subject: string; html: string } {
  const linkRows = template.payload.links
    .map(
      (link) =>
        `<li><strong>${escapeHtml(link.site_name)}</strong> — ${escapeHtml(link.title)}</li>`,
    )
    .join('');

  return {
    subject: 'Action needed: job search links are failing',
    html: `
      <p>Hi,</p>
      <p>Some of your saved job search links failed multiple times while scanning. Please open First 2 Apply and review or update them:</p>
      <ul>${linkRows}</ul>
      <p>Thanks,<br/>First 2 Apply</p>
    `.trim(),
  };
}

function buildNewJobAlertEmail(template: NewJobAlertEmailTemplate): { subject: string; html: string } {
  const count = template.payload.new_jobs_count;
  const jobRows = template.payload.new_jobs
    .map((job) => {
      const location = job.location ? ` · ${escapeHtml(job.location)}` : '';
      const description = job.description
        ? `<p style="margin:4px 0 0;color:#555;">${escapeHtml(job.description)}</p>`
        : '';

      return `
        <li style="margin-bottom:16px;">
          <strong>${escapeHtml(job.title)}</strong> at ${escapeHtml(job.company)}${location}
          <br/>
          <span style="color:#666;">${escapeHtml(job.providerName)}</span>
          <br/>
          <a href="${escapeHtml(job.url)}">View job</a>
          ${description}
        </li>
      `.trim();
    })
    .join('');

  return {
    subject: count === 1 ? '1 new job found' : `${count} new jobs found`,
    html: `
      <p>Hi,</p>
      <p>Your latest scan found <strong>${count}</strong> new job${count === 1 ? '' : 's'}:</p>
      <ul>${jobRows}</ul>
      <p>Open First 2 Apply to review and apply.</p>
      <p>Thanks,<br/>First 2 Apply</p>
    `.trim(),
  };
}
