export interface SendEmailDto {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
}
