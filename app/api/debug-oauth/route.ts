import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// This endpoint is for development debugging only
// Protected by ADMIN_API_KEY in production (timing-safe)
function verifyAdminKey(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    // Allow in development for debugging
    return true;
  }

  if (!adminKey) {
    return false;
  }

  try {
    const keyBuffer = Buffer.from(adminKey);
    const expectedBuffer = Buffer.from(expectedKey);
    if (keyBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(keyBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  // Block in production without admin key
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Extract project ref from URL
  let projectRef = 'unknown';
  if (supabaseUrl) {
    const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (match) {
      projectRef = match[1];
    }
  }

  // SECURITY: Only show configuration status, not actual values
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    supabase: {
      hasUrl: !!supabaseUrl,
      projectRef: projectRef,
      expectedCallback: supabaseUrl ? `${supabaseUrl}/auth/v1/callback` : null,
    },
    keys: {
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    instructions: {
      step1: 'Go to Google Cloud Console -> APIs & Services -> Credentials',
      step2: 'Edit your OAuth 2.0 Client ID',
      step3: `Add this EXACT URL to Authorized redirect URIs: ${supabaseUrl}/auth/v1/callback`,
      step4: 'Also add to Authorized JavaScript origins: ' + supabaseUrl,
      step5: 'Save and wait 5 minutes for propagation',
      note: 'The redirect URI must be the SUPABASE callback URL, not your app URL'
    }
  };

  return NextResponse.json(diagnostics, { status: 200 });
}
