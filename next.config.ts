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
const nextConfig: NextConfig = {
  // A stray lockfile in the user home dir makes Next infer C:\Users\<user> as
  // the workspace root, which misroots file tracing (and broke dev-watch
  // reliability for new directories). Pin the root to this project.
  outputFileTracingRoot: __dirname,
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
