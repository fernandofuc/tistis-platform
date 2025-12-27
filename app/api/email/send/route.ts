// =====================================================
// TIS TIS - Email Send API Endpoint
// Internal API for sending templated emails
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { emailService } from '@/src/lib/email';
import type { EmailTemplateType } from '@/src/lib/email';

// This endpoint should only be called from internal services
// SECURITY: Always require API key in production
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

// SECURITY: Timing-safe API key verification to prevent timing attacks
function verifyApiKeyTimingSafe(authHeader: string | null, expectedKey: string): boolean {
  if (!authHeader || !expectedKey) {
    return false;
  }
  try {
    const providedKey = authHeader.replace('Bearer ', '');
    const providedBuffer = Buffer.from(providedKey);
    const expectedBuffer = Buffer.from(expectedKey);
    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(providedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

interface SendEmailRequest {
  template: EmailTemplateType;
  to: string;
  data: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Validate API key (required in production)
    const authHeader = request.headers.get('authorization');

    if (!INTERNAL_API_KEY) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[Email API] INTERNAL_API_KEY not configured in production');
        return NextResponse.json(
          { error: 'Email service not configured' },
          { status: 503 }
        );
      }
      // Allow without key in development
      console.warn('[Email API] INTERNAL_API_KEY not configured - skipping auth in development');
    } else if (!verifyApiKeyTimingSafe(authHeader, INTERNAL_API_KEY)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: SendEmailRequest = await request.json();
    const { template, to, data } = body;

    if (!template || !to || !data) {
      return NextResponse.json(
        { error: 'Missing required fields: template, to, data' },
        { status: 400 }
      );
    }

    if (!emailService.isValidEmail(to)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    let result;

    switch (template) {
      case 'welcome':
        result = await emailService.sendWelcome(to, {
          customerName: data.customerName as string,
          planName: data.planName as string,
          planPrice: data.planPrice as number,
          dashboardUrl: data.dashboardUrl as string,
          supportEmail: data.supportEmail as string || 'soporte@tistis.com',
        });
        break;

      case 'brain_ready':
        result = await emailService.sendBrainReady(to, {
          customerName: data.customerName as string,
          businessName: data.businessName as string,
          planName: data.planName as string,
          dashboardUrl: data.dashboardUrl as string,
          featuresEnabled: data.featuresEnabled as string[],
          whatsappNumber: data.whatsappNumber as string | undefined,
          setupCallUrl: data.setupCallUrl as string | undefined,
        });
        break;

      case 'payment_confirmed':
        result = await emailService.sendPaymentConfirmed(to, {
          customerName: data.customerName as string,
          planName: data.planName as string,
          amount: data.amount as number,
          currency: data.currency as string || 'MXN',
          invoiceNumber: data.invoiceNumber as string | undefined,
          nextBillingDate: data.nextBillingDate as string | undefined,
          dashboardUrl: data.dashboardUrl as string,
        });
        break;

      case 'setup_reminder':
        result = await emailService.sendSetupReminder(to, {
          customerName: data.customerName as string,
          pendingSteps: data.pendingSteps as string[],
          completedSteps: data.completedSteps as number,
          dashboardUrl: data.dashboardUrl as string,
          setupCallUrl: data.setupCallUrl as string | undefined,
          daysRemaining: data.daysRemaining as number | undefined,
        });
        break;

      case 'payment_failed':
        result = await emailService.sendPaymentFailed(to, {
          customerName: data.customerName as string,
          planName: data.planName as string,
          amount: data.amount as number,
          currency: data.currency as string || 'MXN',
          failureReason: data.failureReason as string | undefined,
          retryDate: data.retryDate as string | undefined,
          updatePaymentUrl: data.updatePaymentUrl as string,
          supportUrl: data.supportUrl as string | undefined,
        });
        break;

      case 'subscription_cancelled':
        result = await emailService.sendSubscriptionCancelled(to, {
          customerName: data.customerName as string,
          planName: data.planName as string,
          endDate: data.endDate as string,
          reactivateUrl: data.reactivateUrl as string,
          feedbackUrl: data.feedbackUrl as string,
        });
        break;

      case 'plan_upgraded':
        result = await emailService.sendPlanUpgraded(to, {
          customerName: data.customerName as string,
          previousPlan: data.previousPlan as string,
          newPlan: data.newPlan as string,
          newPrice: data.newPrice as number,
          currency: data.currency as string || 'MXN',
          newFeatures: data.newFeatures as string[],
          dashboardUrl: data.dashboardUrl as string,
          effectiveDate: data.effectiveDate as string | undefined,
        });
        break;

      default:
        return NextResponse.json(
          { error: `Unknown template type: ${template}` },
          { status: 400 }
        );
    }

    if (!result.success) {
      console.error('[Email API] Send failed:', result.error);
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('[Email API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'TIS TIS Email API',
    templates: [
      'welcome',
      'brain_ready',
      'payment_confirmed',
      'setup_reminder',
      'payment_failed',
      'subscription_cancelled',
      'plan_upgraded',
    ],
  });
}
