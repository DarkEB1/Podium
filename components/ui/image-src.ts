/**
 * A-2 — shared with `marketplace-card.tsx`, which established the rule.
 *
 * `next.config.ts` declares no `images.remotePatterns`, so routing an absolute
 * http(s) URL (Supabase Storage, a presigned link, an arbitrary CDN) through the
 * Next image optimizer throws at runtime. Passing `unoptimized` for those keeps
 * the parts of `next/image` that matter here — lazy loading and intrinsic sizing
 * (the CLS fix) — without the optimizer.
 *
 * Once a storage host is added to `images.remotePatterns`, delete this and let
 * the optimizer handle them.
 */
export function isRemoteImageSrc(src: string): boolean {
  return /^https?:\/\//i.test(src)
}
