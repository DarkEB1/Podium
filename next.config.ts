import type { NextConfig } from "next"

/**
 * GL2 — perceived-performance config (spec §10.3.3).
 *
 * - `images.formats`: serve modern WebP/AVIF with progressive decoding so the
 *   browser negotiates the smallest format it supports. Next's optimizer streams
 *   these progressively and we pair them with blur placeholders (see
 *   lib/perf/blur-placeholder.ts + the A8 BlurImage primitive).
 * - `optimizePackageImports`: route-level code-splitting — tree-shakes barrel
 *   imports from large UI/icon packages so each route ships only the components
 *   it uses, keeping the initial JS under the <200kb gzipped budget.
 */
/**
 * WS-INFRA-02 — site-wide security headers.
 *
 * The live site sent none of these, so the sign-in / signup / "sign contract"
 * screens were framable for clickjacking and responses were MIME-sniffable.
 * `headers()` (not middleware) is used so the guarantees also cover static
 * assets and metadata routes.
 *
 * The CSP is deliberately origin-scoped rather than nonce-based: the app ships
 * an inline pre-hydration theme script (app/layout.tsx) and Next injects inline
 * bootstrap scripts/styles, so `'unsafe-inline'` (script + style) is required to
 * avoid breaking every page, and `'unsafe-eval'` is kept so the three.js/r3f
 * landing and any wasm/Function-constructor dependency keep working. The real
 * win here is `frame-ancestors 'none'` (paired with X-Frame-Options for older
 * browsers) plus the connect/frame/img/object lock-down. Origins allow-listed:
 * Supabase (https + wss, per-env host), Stripe.js + API + checkout frames.
 * next/font self-hosts, so no external font origin is needed.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  // Clickjacking guard for browsers that predate CSP frame-ancestors.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
]

const nextConfig: NextConfig = {
  // A stray lockfile in the user home dir makes Next infer C:\Users\<user> as
  // the workspace root, which misroots file tracing (and broke dev-watch
  // reliability for new directories). Pin the root to this project.
  outputFileTracingRoot: __dirname,
  // Don't advertise the framework/version to every visitor and scanner.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/(.*)', headers: SECURITY_HEADERS }]
  },
  images: {
    // AVIF first (smallest), WebP fallback; both decode progressively.
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "@base-ui/react"],
  },
  // Canonical host is www.podiumsponsorship.com (NEXT_PUBLIC_APP_URL agrees).
  // 308 the bare apex onto it so the redirect and the canonical never argue,
  // and every URL a crawler keeps points at exactly one host.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "podiumsponsorship.com" }],
        destination: "https://www.podiumsponsorship.com/:path*",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
