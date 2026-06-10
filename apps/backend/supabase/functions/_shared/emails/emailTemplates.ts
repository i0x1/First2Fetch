/**
 * Payload types for transactional emails sent via Resend.
 */
export enum EmailTemplateType {
  searchParsingFailure = 'searchParsingFailure',
  newJobAlert = 'newJobAlert',
}

export type SearchParsingFailureEmailTemplate = {
  type: EmailTemplateType.searchParsingFailure;
  payload: {
    links: Array<{ title: string; site_name: string }>;
  };
};

export type NewJobAlertEmailTemplate = {
  type: EmailTemplateType.newJobAlert;
  payload: {
    new_jobs_count: number;
    new_jobs: Array<{
      providerName: string;
      title: string;
      url: string;
      description?: string;
      company: string;
      location?: string;
    }>;
  };
};

export type EmailTemplate = SearchParsingFailureEmailTemplate | NewJobAlertEmailTemplate;
