import { throwError } from '@first2apply/core';

import { First2ApplyBackendEnv } from '../env.ts';
import { ILogger } from '../logger.ts';
import { EmailTemplate } from './emailTemplates.ts';
import { ResendMailer } from './resendMailer.ts';

/**
 * Interface for transactional mailer services.
 */
export interface IMailer {
  sendEmail(_: { logger: ILogger; from?: string; to: string; template: EmailTemplate }): Promise<void>;
}

/**
 * Build the app mailer from edge function secrets (Resend).
 */
export function createAppMailer(env: First2ApplyBackendEnv): IMailer {
  const apiKey = env.resendApiKey ?? throwError('RESEND_API_KEY is missing');
  const fromEmail = env.resendFromEmail ?? throwError('RESEND_FROM_EMAIL is missing');

  return new ResendMailer(apiKey, fromEmail, env.resendFromName ?? 'First 2 Apply');
}
