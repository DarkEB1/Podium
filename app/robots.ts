import type { MetadataRoute } from 'next'

import { siteUrl } from './sitemap'

/**
 * robots.txt (M-1 / NX-5).
 *
 * Public marketing pages are crawlable; every authenticated area and the API
 * are disallowed. This is a crawler hint, NOT access control — middleware.ts
 * and RLS are what actually protect these routes — but it keeps signed-in
 * surfaces, one-time auth links and the erasure cron out of search results.
 */

/** Areas no crawler should index. Mirrors the exclusions in app/sitemap.ts. */
export const DISALLOWED_PATHS: readonly string[] = [
  '/api/',
  '/athlete/',
  '/brand/',
  '/team/',
  '/agent/',
  '/admin/',
  '/auth/',
  '/dashboard',
  '/role-select',
  '/update-password',
  '/403',
]

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [...DISALLOWED_PATHS],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
