import type { MetadataRoute } from 'next'

import { ROUTES } from '@/lib/routes'
import { clientEnv } from '@/lib/env'

/**
 * XML sitemap (M-1 / NX-5 / M-4).
 *
 * ONLY PUBLIC ROUTES. Every authenticated surface — role dashboards, discovery,
 * messages, settings, onboarding, the whole API — is excluded by construction:
 * the list below is an explicit allow-list, not a filter over `staticRoutes()`,
 * so a new `/brand/*` page cannot leak into the sitemap by being added to
 * ROUTES. `app/robots.ts` disallows the same areas.
 *
 * `/auth`, `/auth/signup` and the rest of the auth flow are deliberately absent
 * too: they are transactional, thin, and indexing them puts a login form in the
 * results for the brand name.
 */

/** The public marketing surface — the acquisition channel for both sides. */
const PUBLIC_ENTRIES: ReadonlyArray<{
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  priority: number
}> = [
  { path: ROUTES.home, changeFrequency: 'weekly', priority: 1 },
  { path: ROUTES.pricing, changeFrequency: 'monthly', priority: 0.8 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/cookies', changeFrequency: 'yearly', priority: 0.3 },
]

/** Base URL from the validated env, with any trailing slash removed. */
export function siteUrl(): string {
  try {
    return clientEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  } catch {
    // A sitemap must never be the thing that fails a build. Falling back keeps
    // `next build` green in an environment without NEXT_PUBLIC_APP_URL; the
    // deployed value is validated everywhere else.
    return 'http://localhost:3000'
  }
}

export function publicSitemapPaths(): string[] {
  return PUBLIC_ENTRIES.map((e) => e.path)
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  const lastModified = new Date()

  return PUBLIC_ENTRIES.map((entry) => ({
    url: entry.path === '/' ? `${base}/` : `${base}${entry.path}`,
    lastModified,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }))
}
