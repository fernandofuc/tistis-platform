/** @type {import('next').NextConfig} */
const nextConfig = {
  // ======================
  // BUILD OPTIMIZATION
  // ======================

  // Enable instrumentation hook for startup validation
  experimental: {
    instrumentationHook: true,
  },

  // Standalone output for optimized Docker/serverless deployments
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,

  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Disable x-powered-by header for security
  poweredByHeader: false,

  // Enable compression
  compress: true,

  // Generate ETags for caching
  generateEtags: true,

  // ======================
  // IMAGE OPTIMIZATION
  // ======================
  images: {
    // Use remotePatterns instead of deprecated domains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        pathname: '/**',
      },
    ],
    // Optimize image formats
    formats: ['image/avif', 'image/webp'],
    // Minimize layout shift
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
  },

  // ======================
  // ENVIRONMENT VARIABLES
  // ======================
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    // Note: npm_package_version is not available in Vercel runtime
    // Using hardcoded version - update this on each release
    NEXT_PUBLIC_APP_VERSION: '4.6.0',
  },

  // ======================
  // LOGGING
  // ======================
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },

  // ======================
  // HEADERS - Security & Cache Strategy
  // ======================
  async headers() {
    return [
      // ----------------------
      // Static Assets - Long cache (immutable)
      // ----------------------
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },

      // ----------------------
      // Static Files (public folder)
      // ----------------------
      {
        source: '/favicon.ico',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/robots.txt',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
      {
        source: '/sitemap.xml',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400',
          },
        ],
      },

      // ----------------------
      // API Routes - No cache (dynamic) + CORS
      // ----------------------
      {
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
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          // CORS headers for API routes
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With, Accept, X-Internal-API-Key, X-Health-Token, X-Request-ID',
          },
          {
            key: 'Access-Control-Expose-Headers',
            value: 'X-Request-ID, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
          {
            key: 'Vary',
            value: 'Origin',
          },
        ],
      },

      // ----------------------
      // Health endpoint - Short cache for load balancers
      // ----------------------
      {
        source: '/api/health',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, max-age=0',
          },
        ],
      },

      // ----------------------
      // Webhook endpoints - No cache, no logging
      // ----------------------
      {
        source: '/api/webhook/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
          {
            key: 'X-Robots-Tag',
            value: 'noindex',
          },
        ],
      },

      // ----------------------
      // Auth routes - No cache
      // ----------------------
      {
        source: '/auth/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },

      // ----------------------
      // Dashboard routes - Short cache with revalidation
      // ----------------------
      {
        source: '/dashboard/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-cache, must-revalidate',
          },
        ],
      },

      // ----------------------
      // Marketing pages - Moderate cache
      // ----------------------
      {
        source: '/((?!dashboard|auth|api).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400',
          },
        ],
      },

      // ----------------------
      // Security Headers - All routes
      // ----------------------
      {
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
            // Allow microphone for voice agent feature
            value: 'camera=(), microphone=(self), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Content-Security-Policy',
            // Note: 'unsafe-inline' required for Next.js hydration
            // 'unsafe-eval' removed for security - should not be needed in production
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://js.stripe.com https://vercel.live https://*.vercel.app https://accounts.google.com https://apis.google.com https://*.supabase.co",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com https://*.supabase.co",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://*.vercel.app https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://vercel.live wss://ws-us3.pusher.com https://accounts.google.com https://oauth2.googleapis.com https://github.com https://api.github.com https://api.openai.com https://api.anthropic.com https://api.vapi.ai wss://*.vapi.ai https://api.resend.com",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://billing.stripe.com https://vercel.live https://*.supabase.co https://accounts.google.com https://github.com",
              "form-action 'self' https://*.supabase.co https://accounts.google.com https://github.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "object-src 'none'",
              "worker-src 'self' blob:",
              "media-src 'self' blob:", // For voice agent audio
            ].join('; '),
          },
        ],
      },
    ];
  },

  // ======================
  // REDIRECTS
  // ======================
  async redirects() {
    return [
      // Health check shorthand
      {
        source: '/health',
        destination: '/api/health',
        permanent: true,
      },
      // Old dashboard redirect
      {
        source: '/app/:path*',
        destination: '/dashboard/:path*',
        permanent: true,
      },
    ];
  },

  // ======================
  // REWRITES
  // ======================
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [],
    };
  },

  // ======================
  // WEBPACK OPTIMIZATION
  // ======================
  webpack: (config, { isServer, dev }) => {
    // Production optimizations
    if (!dev) {
      // Enable module concatenation for smaller bundles
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
      };
    }

    // Ignore node-specific modules in client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
      };
    }

    return config;
  },
};

export default nextConfig;
