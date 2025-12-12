// IMPORTANT: Re-export from the shared lib to ensure ALL parts of the app
// use the SAME supabase instance and share the authentication session correctly

// Browser client (for client-side components)
export { supabase } from '@/src/shared/lib/supabase';

// Server-side client (with service role) - Only for API routes
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
