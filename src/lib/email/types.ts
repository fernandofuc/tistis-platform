// =====================================================
// TIS TIS - Email System Types
// =====================================================

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string; // Base64
  contentType: string;
}

export interface SendEmailParams {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
  from?: EmailRecipient;
  replyTo?: EmailRecipient;
  attachments?: EmailAttachment[];
  tags?: string[];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Template-specific data types
export interface WelcomeEmailData {
  customerName: string;
  planName: string;
  planPrice: number;
  dashboardUrl: string;
  supportEmail: string;
}

export interface PaymentConfirmedEmailData {
  customerName: string;
  planName: string;
  amount: number;
  currency: string;
  invoiceNumber?: string;
  nextBillingDate?: string;
  dashboardUrl: string;
}

export interface BrainReadyEmailData {
  customerName: string;
  businessName: string;
  planName: string;
  dashboardUrl: string;
  featuresEnabled: string[];
  whatsappNumber?: string;
  setupCallUrl?: string;
}

export interface SetupReminderEmailData {
  customerName: string;
  pendingSteps: string[];
  completedSteps: number;
  dashboardUrl: string;
  setupCallUrl?: string;
  daysRemaining?: number;
}

export interface PaymentFailedEmailData {
  customerName: string;
  planName: string;
  amount: number;
  currency: string;
  failureReason?: string;
  retryDate?: string;
  updatePaymentUrl: string;
  supportUrl?: string;
}

export interface SubscriptionCancelledEmailData {
  customerName: string;
  planName: string;
  endDate: string;
  reactivateUrl: string;
  feedbackUrl: string;
}

export interface PlanUpgradedEmailData {
  customerName: string;
  previousPlan: string;
  newPlan: string;
  newPrice: number;
  currency: string;
  newFeatures: string[];
  dashboardUrl: string;
  effectiveDate?: string;
}

export interface CredentialsEmailData {
  customerName: string;
  dashboardUrl: string;
  email: string;
  tempPassword: string;
  tenantSlug: string;
}

export type EmailTemplateType =
  | 'welcome'
  | 'payment_confirmed'
  | 'brain_ready'
  | 'setup_reminder'
  | 'payment_failed'
  | 'subscription_cancelled'
  | 'plan_upgraded'
  | 'credentials';
