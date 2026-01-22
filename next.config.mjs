/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable instrumentation hook for startup validation
  experimental: {
    instrumentationHook: true,
  },
  images: {
    domains: [
      'your-project.supabase.co', // Para imágenes de Supabase
    ],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
  // Security headers
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://vercel.live https://*.vercel.app https://accounts.google.com https://apis.google.com https://*.supabase.co",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com https://*.supabase.co",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://*.vercel.app https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://vercel.live wss://ws-us3.pusher.com https://accounts.google.com https://oauth2.googleapis.com https://github.com https://api.github.com",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://billing.stripe.com https://vercel.live https://*.supabase.co https://accounts.google.com https://github.com",
              "form-action 'self' https://*.supabase.co https://accounts.google.com https://github.com",
            ].join('; '),
          },
        ],
      },
      {
        // Stricter headers for API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
