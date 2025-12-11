// =====================================================
// TIS TIS - Email Sender Service
// Uses Resend for production email delivery
// =====================================================

import { Resend } from 'resend';
import type { SendEmailParams, EmailResult } from './types';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Default sender configuration
const DEFAULT_FROM = {
  email: process.env.EMAIL_FROM || 'TIS TIS <noreply@tistis.com>',
  name: 'TIS TIS',
};

const DEFAULT_REPLY_TO = {
  email: process.env.EMAIL_REPLY_TO || 'hola@tistis.com',
  name: 'TIS TIS Soporte',
};

/**
 * Send an email using Resend
 */
export async function sendEmail(params: SendEmailParams): Promise<EmailResult> {
  const {
    to,
    subject,
    html,
    text,
    from = DEFAULT_FROM,
    replyTo = DEFAULT_REPLY_TO,
    tags,
  } = params;

  // Normalize recipients to array
  const recipients = Array.isArray(to) ? to : [to];

  try {
    const { data, error } = await resend.emails.send({
      from: typeof from === 'string' ? from : `${from.name} <${from.email}>`,
      to: recipients.map((r) => (typeof r === 'string' ? r : r.email)),
      subject,
      html,
      text: text || stripHtml(html),
      reply_to: typeof replyTo === 'string' ? replyTo : replyTo.email,
      tags: tags?.map((tag) => ({ name: 'category', value: tag })),
    });

    if (error) {
      console.error('[Email] Resend error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log('[Email] Sent successfully:', {
      messageId: data?.id,
      to: recipients.map((r) => (typeof r === 'string' ? r : r.email)),
      subject,
    });

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error) {
    console.error('[Email] Send failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send multiple emails in batch
 */
export async function sendBatchEmails(
  emails: SendEmailParams[]
): Promise<EmailResult[]> {
  const results = await Promise.allSettled(
    emails.map((email) => sendEmail(email))
  );

  return results.map((result) =>
    result.status === 'fulfilled'
      ? result.value
      : { success: false, error: 'Batch send failed' }
  );
}

/**
 * Strip HTML tags for plain text fallback
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
