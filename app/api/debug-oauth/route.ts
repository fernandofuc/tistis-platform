import { NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Extract project ref from URL
  let projectRef = 'unknown';
  if (supabaseUrl) {
    const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (match) {
      projectRef = match[1];
    }
  }

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    supabase: {
      hasUrl: !!supabaseUrl,
      urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : null,
      projectRef: projectRef,
      expectedCallback: supabaseUrl ? `${supabaseUrl}/auth/v1/callback` : null,
    },
    keys: {
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      anonKeyPreview: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...`
        : null,
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
