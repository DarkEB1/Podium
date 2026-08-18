/**
 * Canonical social handle parsing.
 *
 * Storage contract for athlete_profiles.social_accounts:
 * - social_accounts.<platform> holds the canonical handle (no "@", no URL).
 *   Legacy rows may hold full URLs or "@handle" strings; always read through
 *   parseSocialInput so both forms resolve.
 * - social_accounts.<platform>_followers (youtube uses youtube_subscribers)
 *   holds a self-reported follower count as a number.
 */

export type SocialPlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter'

export interface ParsedSocial {
  /** Canonical handle without the leading "@". */
  handle: string
  /** Full profile URL built from the canonical handle. */
  url: string
}

interface PlatformSpec {
  hosts: string[]
  buildUrl: (handle: string) => string
}

const HANDLE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

const PLATFORMS: Record<SocialPlatform, PlatformSpec> = {
  instagram: {
    hosts: ['instagram.com', 'www.instagram.com'],
    buildUrl: (h) => `https://instagram.com/${h}`,
  },
  tiktok: {
    hosts: ['tiktok.com', 'www.tiktok.com'],
    buildUrl: (h) => `https://tiktok.com/@${h}`,
  },
  youtube: {
    hosts: ['youtube.com', 'www.youtube.com', 'm.youtube.com'],
    buildUrl: (h) => `https://youtube.com/@${h}`,
  },
  twitter: {
    hosts: ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com'],
    buildUrl: (h) => `https://x.com/${h}`,
  },
}

/**
 * Accepts "@handle", a bare handle, "instagram.com/handle" or a full profile
 * URL and returns the canonical handle plus a display URL.
 * Returns null when the input is empty or cannot be read as a handle.
 */
export function parseSocialInput(
  platform: SocialPlatform,
  raw: string | null | undefined,
): ParsedSocial | null {
  if (!raw) return null
  const spec = PLATFORMS[platform]
  let value = raw.trim()
  if (!value) return null

  // Full or scheme-less URL for a known host: take the first path segment.
  const urlLike = value.match(/^(?:https?:\/\/)?([^/\s]+)\/(.+)$/)
  if (urlLike) {
    const host = urlLike[1]?.toLowerCase()
    const path = urlLike[2]
    if (!host || !path || !spec.hosts.includes(host)) return null
    value = path.split(/[/?#]/)[0] ?? ''
  }

  if (value.startsWith('@')) value = value.slice(1)
  if (!HANDLE_PATTERN.test(value)) return null

  return { handle: value, url: spec.buildUrl(value) }
}

/** Convenience for render sites: canonical handle from a stored value. */
export function socialHandle(
  platform: SocialPlatform,
  stored: string | null | undefined,
): string | null {
  return parseSocialInput(platform, stored)?.handle ?? null
}

/** Convenience for render sites: profile URL from a stored value. */
export function socialUrl(
  platform: SocialPlatform,
  stored: string | null | undefined,
): string | null {
  return parseSocialInput(platform, stored)?.url ?? null
}
