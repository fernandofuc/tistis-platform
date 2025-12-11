// =====================================================
// TIS TIS - Email Service
// Main email service combining templates with sending
// =====================================================

import { sendEmail, sendBatchEmails, isValidEmail } from './sender';
import {
  welcomeEmailTemplate,
  welcomeEmailSubject,
  brainReadyEmailTemplate,
  brainReadyEmailSubject,
  paymentConfirmedEmailTemplate,
  paymentConfirmedEmailSubject,
  setupReminderEmailTemplate,
  setupReminderEmailSubject,
  paymentFailedEmailTemplate,
  paymentFailedEmailSubject,
  subscriptionCancelledEmailTemplate,
  subscriptionCancelledEmailSubject,
  planUpgradedEmailTemplate,
  planUpgradedEmailSubject,
} from './templates';
import type {
  EmailResult,
  WelcomeEmailData,
  BrainReadyEmailData,
  PaymentConfirmedEmailData,
  SetupReminderEmailData,
  PaymentFailedEmailData,
  SubscriptionCancelledEmailData,
  PlanUpgradedEmailData,
} from './types';

// Re-export types
export type * from './types';

/**
 * TIS TIS Email Service
 * Provides high-level methods for sending templated emails
 */
export const emailService = {
  /**
   * Send welcome email after successful signup/payment
   */
  async sendWelcome(
    to: string,
    data: WelcomeEmailData
  ): Promise<EmailResult> {
    if (!isValidEmail(to)) {
      return { success: false, error: 'Invalid email address' };
    }

    return sendEmail({
      to: { email: to, name: data.customerName },
      subject: welcomeEmailSubject(data.customerName),
      html: welcomeEmailTemplate(data),
      tags: ['welcome', 'onboarding'],
    });
  },

  /**
   * Send notification when micro-app is ready
   */
  async sendBrainReady(
    to: string,
    data: BrainReadyEmailData
  ): Promise<EmailResult> {
    if (!isValidEmail(to)) {
      return { success: false, error: 'Invalid email address' };
    }

    return sendEmail({
      to: { email: to, name: data.customerName },
      subject: brainReadyEmailSubject(data.businessName),
      html: brainReadyEmailTemplate(data),
      tags: ['brain-ready', 'onboarding'],
    });
  },

  /**
   * Send payment confirmation receipt
   */
  async sendPaymentConfirmed(
    to: string,
    data: PaymentConfirmedEmailData
  ): Promise<EmailResult> {
    if (!isValidEmail(to)) {
      return { success: false, error: 'Invalid email address' };
    }

    return sendEmail({
      to: { email: to, name: data.customerName },
      subject: paymentConfirmedEmailSubject(data.amount, data.currency),
      html: paymentConfirmedEmailTemplate(data),
      tags: ['payment', 'receipt'],
    });
  },

  /**
   * Send setup reminder for incomplete onboarding
   */
  async sendSetupReminder(
    to: string,
    data: SetupReminderEmailData
  ): Promise<EmailResult> {
    if (!isValidEmail(to)) {
      return { success: false, error: 'Invalid email address' };
    }

    return sendEmail({
      to: { email: to, name: data.customerName },
      subject: setupReminderEmailSubject(data.customerName, data.pendingSteps.length),
      html: setupReminderEmailTemplate(data),
      tags: ['reminder', 'onboarding'],
    });
  },

  /**
   * Send payment failed notification
   */
  async sendPaymentFailed(
    to: string,
    data: PaymentFailedEmailData
  ): Promise<EmailResult> {
    if (!isValidEmail(to)) {
      return { success: false, error: 'Invalid email address' };
    }

    return sendEmail({
      to: { email: to, name: data.customerName },
      subject: paymentFailedEmailSubject(),
      html: paymentFailedEmailTemplate(data),
      tags: ['payment', 'failed'],
    });
  },

  /**
   * Send subscription cancelled confirmation
   */
  async sendSubscriptionCancelled(
    to: string,
    data: SubscriptionCancelledEmailData
  ): Promise<EmailResult> {
    if (!isValidEmail(to)) {
      return { success: false, error: 'Invalid email address' };
    }

    return sendEmail({
      to: { email: to, name: data.customerName },
      subject: subscriptionCancelledEmailSubject(data.customerName),
      html: subscriptionCancelledEmailTemplate(data),
      tags: ['subscription', 'cancelled'],
    });
  },

  /**
   * Send plan upgraded notification
   */
  async sendPlanUpgraded(
    to: string,
    data: PlanUpgradedEmailData
  ): Promise<EmailResult> {
    if (!isValidEmail(to)) {
      return { success: false, error: 'Invalid email address' };
    }

    return sendEmail({
      to: { email: to, name: data.customerName },
      subject: planUpgradedEmailSubject(data.newPlan),
      html: planUpgradedEmailTemplate(data),
      tags: ['subscription', 'upgraded'],
    });
  },

  /**
   * Send custom email with raw HTML
   */
  async sendCustom(
    to: string,
    subject: string,
    html: string,
    tags?: string[]
  ): Promise<EmailResult> {
    if (!isValidEmail(to)) {
      return { success: false, error: 'Invalid email address' };
    }

    return sendEmail({
      to: { email: to },
      subject,
      html,
      tags,
    });
  },

  /**
   * Send batch emails
   */
  sendBatch: sendBatchEmails,

  /**
   * Utility: Validate email format
   */
  isValidEmail,
};

// Default export
export default emailService;
