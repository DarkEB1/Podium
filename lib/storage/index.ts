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
  /** Stable public URL the uploaded object will be served from. */
  publicUrl: string
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
  const { bucket, userId } = opts

  const allowedExts = ALLOWED_EXTS[bucket]
  if (!allowedExts) {
    throw new StorageError('invalid_bucket', `Unknown storage bucket: ${String(bucket)}`)
  }
  if (!userId || !userId.trim()) {
    throw new StorageError('invalid_user', 'A userId is required to scope the upload.')
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

  const { data: publicData } = bucketApi.getPublicUrl(path)

  return {
    uploadUrl: data.signedUrl,
    publicUrl: publicData.publicUrl,
  }
}
