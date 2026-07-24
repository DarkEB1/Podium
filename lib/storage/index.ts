import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * lib/storage — presigned-URL generation for client-side uploads.
 *
 * ARCHITECTURE RULE: large file uploads MUST go directly from the browser to
 * Supabase Storage via a presigned URL. We never stream upload bytes through a
 * Next.js route handler (CLAUDE.md "Layer Map" / spec §4A.1). This module only
 * mints the short-lived signed URL the client uploads to.
 */

/** The four v1 storage buckets (spec §4A.1). */
export const STORAGE_BUCKETS = {
  avatars: 'avatars', // athlete/agent profile photos (1:1)
  logos: 'logos', // brand/team logos
  covers: 'covers', // brand/team cover images (wide)
  docs: 'docs', // media packs / sponsorship brief PDFs
} as const

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS]

/**
 * Which buckets are world-readable.
 *
 * `docs` is deliberately PRIVATE (migration 20260720005002): it holds media
 * packs and sponsorship briefs, and is the obvious home for signed contract
 * documents. It was originally created public with an unrestricted SELECT
 * policy, which made every uploaded document readable by `anon` — the object
 * uuid was the only thing standing between a signed commercial contract and
 * the open internet, and `anon` could enumerate `storage.objects` anyway.
 *
 * The image buckets stay public because public profile pages render them
 * directly via `getPublicUrl`, and a signed URL would expire in the page cache.
 */
const PUBLIC_BUCKETS: ReadonlySet<string> = new Set([
  STORAGE_BUCKETS.avatars,
  STORAGE_BUCKETS.logos,
  STORAGE_BUCKETS.covers,
])

export function isPublicBucket(bucket: StorageBucket): boolean {
  return PUBLIC_BUCKETS.has(bucket)
}

/** Allowed file extensions per bucket. Image buckets accept JPEG/PNG/HEIC/WebP;
 * the docs bucket additionally accepts PDF. */
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'heic', 'webp'] as const
const ALLOWED_EXTS: Record<StorageBucket, readonly string[]> = {
  avatars: IMAGE_EXTS,
  logos: IMAGE_EXTS,
  covers: IMAGE_EXTS,
  docs: [...IMAGE_EXTS, 'pdf'],
}

export class StorageError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'StorageError'
  }
}

export interface CreateUploadUrlOptions {
  bucket: StorageBucket
  /** Owning user's id — uploads are namespaced under it so RLS owner policies apply. */
  userId: string
  /** File extension, with or without a leading dot (e.g. "jpg" or ".PNG"). */
  ext: string
}

export interface UploadUrlResult {
  /** Short-lived signed URL the browser uploads the file bytes to. */
  uploadUrl: string
  /**
   * The object's path within the bucket (`<userId>/<uuid>.<ext>`).
   *
   * PERSIST THIS, not `publicUrl`, for anything in a private bucket — a public
   * URL to a private object simply 400s, and a stored URL cannot be re-signed
   * later. Read it back with `createSignedDownloadUrl()`.
   */
  path: string
  /**
   * Stable public URL — only for public buckets. `null` for private buckets
   * (`docs`), where no such URL exists; use `createSignedDownloadUrl()`.
   */
  publicUrl: string | null
}

function normalizeExt(ext: string): string {
  return ext.trim().replace(/^\./, '').toLowerCase()
}

function randomId(): string {
  // crypto.randomUUID is available in Node 18+ and all supported browsers.
  return globalThis.crypto.randomUUID()
}

/**
 * Mint a presigned upload URL for a single file, scoped under `userId/` inside
 * the requested bucket. Returns the URL to PUT bytes to plus the eventual
 * public URL. Validates bucket, user, and extension before touching Supabase.
 */
export async function createUploadUrl(
  supabase: SupabaseClient<Database>,
  opts: CreateUploadUrlOptions
): Promise<UploadUrlResult> {
  const { bucket } = opts

  const allowedExts = ALLOWED_EXTS[bucket]
  if (!allowedExts) {
    throw new StorageError('invalid_bucket', `Unknown storage bucket: ${String(bucket)}`)
  }

  // The storage.objects policies (PR-16, migration 20260720001005) require
  // `(storage.foldername(name))[1] = auth.uid()::text`, so the owner id must be
  // the WHOLE first path segment: trimmed, and containing no path separator.
  const userId = (opts.userId ?? '').trim()
  if (!userId) {
    throw new StorageError('invalid_user', 'A userId is required to scope the upload.')
  }
  if (userId.includes('/')) {
    throw new StorageError(
      'invalid_user',
      'userId must be a single path segment — it becomes the owner folder.'
    )
  }

  const ext = normalizeExt(opts.ext)
  if (!ext || !allowedExts.includes(ext)) {
    throw new StorageError(
      'invalid_extension',
      `Extension "${opts.ext}" is not allowed for the ${bucket} bucket.`
    )
  }

  const path = `${userId}/${randomId()}.${ext}`

  const bucketApi = supabase.storage.from(bucket)
  const { data, error } = await bucketApi.createSignedUploadUrl(path)
  if (error || !data) {
    throw new StorageError('upload_url_failed', error?.message ?? 'Failed to create upload URL.')
  }

  // Only mint a public URL for a genuinely public bucket. Returning one for a
  // private object would hand the caller a link that 400s and, worse, invite it
  // to be persisted in place of the path that can still be signed later.
  const publicUrl = isPublicBucket(bucket) ? bucketApi.getPublicUrl(path).data.publicUrl : null

  return {
    uploadUrl: data.signedUrl,
    path,
    publicUrl,
  }
}

/** How long a generated download link stays valid. */
export const SIGNED_DOWNLOAD_TTL_SECONDS = 60 * 10

/**
 * Mint a short-lived download URL for an object in a private bucket.
 *
 * Access is still enforced by the `storage.objects` SELECT policy — signing is
 * not an authorisation bypass; the caller must already be entitled to the
 * object (owner, active-match counterparty, or admin).
 *
 * `pathOrUrl` accepts either a bare object path or a previously-stored absolute
 * URL, because rows written before `docs` became private hold a full public
 * URL. The bucket segment is stripped so those legacy values still resolve.
 */
export async function createSignedDownloadUrl(
  supabase: SupabaseClient<Database>,
  bucket: StorageBucket,
  pathOrUrl: string,
  expiresIn: number = SIGNED_DOWNLOAD_TTL_SECONDS
): Promise<string> {
  const path = objectPathFrom(bucket, pathOrUrl)
  if (!path) {
    throw new StorageError('invalid_path', 'Could not determine the object path to sign.')
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  if (error || !data) {
    throw new StorageError(
      'signed_url_failed',
      error?.message ?? 'Failed to create a download URL.'
    )
  }

  return data.signedUrl
}

/**
 * Normalise a stored value to a bucket-relative object path. Handles both a
 * bare path and a legacy absolute `.../storage/v1/object/public/<bucket>/<path>`
 * URL. Returns null when nothing usable can be extracted.
 */
export function objectPathFrom(bucket: StorageBucket, pathOrUrl: string): string | null {
  const value = (pathOrUrl ?? '').trim()
  if (!value) return null

  if (!value.includes('://')) {
    // Already a path; tolerate an accidental leading bucket prefix.
    return value.replace(new RegExp(`^/?${bucket}/`), '').replace(/^\/+/, '') || null
  }

  try {
    const { pathname } = new URL(value)
    const marker = `/${bucket}/`
    const index = pathname.indexOf(marker)
    if (index === -1) return null
    return decodeURIComponent(pathname.slice(index + marker.length)) || null
  } catch {
    return null
  }
}
