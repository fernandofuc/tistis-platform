# OAuth `redirect_uri_mismatch` Diagnostic Guide

## Problem Statement
You're getting `Error 400: redirect_uri_mismatch` when trying to authenticate with Google OAuth, even though Supabase URL configuration appears correct.

## Root Cause Analysis

The error message indicates:
```
redirect_uri=https://ndgoqjnmzirgkergggfi.supabase.co/auth/v1/callback
```

This is correct. The problem is **Google Cloud Console is rejecting this redirect URI** because:

1. **Client ID/Secret mismatch** - The credentials in Supabase don't match Google Cloud Console
2. **Redirect URI not registered** in Google Cloud Console
3. **JavaScript Origins not configured** in Google Cloud Console
4. **OAuth consent screen incomplete** in Google Cloud Console

## Step-by-Step Diagnostic

### Phase 1: Verify Supabase Configuration ✅

Your Supabase should have:
- **Site URL**: `https://tistis-platform.vercel.app`
- **Redirect URLs**: `https://tistis-platform.vercel.app/auth/callback`

Run this to verify environment:
```bash
echo "NEXT_PUBLIC_SUPABASE_URL: $NEXT_PUBLIC_SUPABASE_URL"
echo "URL should end in: supabase.co"
```

### Phase 2: Verify Google Cloud Console Setup ⚠️

The issue is likely HERE. Follow this exact process:

#### 2.1 Go to Google Cloud Console
```
1. Visit: https://console.cloud.google.com
2. Select your project from the dropdown
3. Go to: APIs & Services → Credentials
4. Find: OAuth 2.0 Client IDs → Web application
```

#### 2.2 Verify Authorized Redirect URIs
Click the OAuth credential and check the **Authorized redirect URIs** section.

It should include BOTH:
- `https://ndgoqjnmzirgkergggfi.supabase.co/auth/v1/callback` (Replace with YOUR project ref)
- `https://tistis-platform.vercel.app/auth/callback`

If these are missing, **ADD THEM NOW**.

#### 2.3 Verify JavaScript Origins
It should include:
- `https://tistis-platform.vercel.app`
- `https://ndgoqjnmzirgkergggfi.supabase.co` (YOUR Supabase project ref)

#### 2.4 Copy Credentials
Get:
- **Client ID** (long string starting with numbers)
- **Client Secret** (starts with GOCSPX-)

### Phase 3: Update Supabase Configuration

#### 3.1 Go to Supabase Dashboard
```
1. Visit: https://app.supabase.com
2. Select your project
3. Go to: Authentication → Providers → Google
```

#### 3.2 Verify/Update Google Provider
Make sure:
- ✅ **Status**: Enabled
- ✅ **Client ID**: (paste from Google Cloud Console)
- ✅ **Client Secret**: (paste from Google Cloud Console)

#### 3.3 CRITICAL: Disable and Re-enable
1. Click "Disable" button
2. Wait 5 seconds
3. Click "Enable" button
4. Paste credentials again
5. Click "Save"

### Phase 4: Test the Flow

#### 4.1 Clear Vercel Cache
```bash
# Trigger a redeploy without code changes
vercel --prod
```

#### 4.2 Clear Browser Cache
- Open DevTools → Application → Cookies
- Delete all cookies from `tistis-platform.vercel.app`
- Also clear from Supabase domains

#### 4.3 Try OAuth Login
- Go to: `https://tistis-platform.vercel.app`
- Click "Continuar con Google"
- You should see Google's login page

#### 4.4 If Still Failing
Check the error details. The error should mention which redirect URI was rejected.

---

## Nuclear Option: Create Fresh Credentials

If above doesn't work, create brand new Google OAuth credentials:

### Step 1: Delete Old Credentials
```
Google Cloud Console → Credentials →
Find your OAuth 2.0 Client ID → Delete
```

### Step 2: Create New Credentials
```
APIs & Services → Credentials → Create Credentials → OAuth Client ID

Choose: Web application

Name: tistis-platform-oauth

Authorized Redirect URIs:
- https://ndgoqjnmzirgkergggfi.supabase.co/auth/v1/callback
- https://tistis-platform.vercel.app/auth/callback

JavaScript Origins:
- https://tistis-platform.vercel.app
- https://ndgoqjnmzirgkergggfi.supabase.co
```

### Step 3: Update Supabase
Disable Google provider, wait 10 seconds, re-enable with NEW credentials.

### Step 4: Redeploy
```bash
vercel --prod
```

---

## GitHub OAuth (Same Process)

GitHub has similar configuration. If you're also getting errors there:

### GitHub OAuth Configuration
```
1. Settings → Developer settings → OAuth Apps
2. Find your app
3. Verify: Authorization callback URL
   Should be: https://ndgoqjnmzirgkergggfi.supabase.co/auth/v1/callback
4. Copy: Client ID and Client Secret
5. Update Supabase: Authentication → Providers → GitHub
```

---

## Debugging: Enable Verbose Logging

Add to `[NEXT_PROJECT]/components/auth/AuthModal.tsx`:

```typescript
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
});

if (error) {
  console.error('🔴 OAuth error details:', {
    message: error.message,
    status: error.status,
    code: (error as any).code,
  });
}
```

Then check browser console for detailed error info.

---

## Common Issues Checklist

- [ ] Supabase Site URL is `https://tistis-platform.vercel.app` (not localhost)
- [ ] Supabase Redirect URLs include `https://tistis-platform.vercel.app/auth/callback`
- [ ] Google Cloud Console has both redirect URIs registered
- [ ] Google Cloud Console has both JavaScript origins registered
- [ ] Client ID and Secret in Supabase match Google Cloud Console exactly
- [ ] OAuth provider is ENABLED in Supabase
- [ ] Browser cache cleared (cookies from both domains)
- [ ] Vercel build cache cleared (redeploy)
- [ ] Waited 5+ minutes after Supabase changes (propagation time)

---

## Still Not Working?

If you've checked everything above:

1. **Screenshot the error page** - Share exactly what message appears
2. **Check browser DevTools** - Network tab → Look for the redirect request, check URL parameters
3. **Verify callback route** - Run `npm run dev` locally and test if it works
   - If it works locally → Problem is Supabase/Google OAuth configuration
   - If it fails locally → Problem is in callback handler code

---

## Contact Supabase Support

If still failing after all above:
- Project → Support → Create support ticket
- Include:
  - Project ref
  - Error message
  - Steps you've taken
  - Screenshots of Supabase OAuth configuration

Supabase support can check server-side logs to see why the redirect URI is being rejected.
