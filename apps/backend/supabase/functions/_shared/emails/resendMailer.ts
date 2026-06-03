import { getExceptionMessage } from '@first2apply/core';
import { Resend } from 'npm:resend';

import { ILogger } from '../logger.ts';
import { buildEmailContent } from './emailHtml.ts';
import { EmailTemplate } from './emailTemplates.ts';
import { IMailer } from './mailer.ts';

/**
 * Resend-based implementation used for job alert and scan failure emails.
 */
export class ResendMailer implements IMailer {
  private _client: Resend;

  constructor(
    apiKey: string,
    private _defaultFromAddress: string,
    private _defaultFromName: string,
  ) {
    this._client = new Resend(apiKey);
  }

  async sendEmail({
    logger,
    from,
    to,
    template,
  }: {
    logger: ILogger;
    from?: string;
    to: string;
    template: EmailTemplate;
  }): Promise<void> {
    const { subject, html } = buildEmailContent(template);
    const fromAddress = from ?? this._defaultFromAddress;
    const fromHeader = `${this._defaultFromName} <${fromAddress}>`;

    try {
      logger.info(`Sending ${template.type} email to ${to} via Resend ...`);

      const { error } = await this._client.emails.send({
        from: fromHeader,
        to: [to],
        subject,
        html,
      });

      if (error) {
        throw new Error(error.message);
      }

      logger.info(`Email sent successfully to ${to}`);
    } catch (error) {
      throw new Error(`Error sending email: ${getExceptionMessage(error)}`);
    }
  }
}
