import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createUploadUrl, STORAGE_BUCKETS, StorageError } from './index'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// ---------------------------------------------------------------------------
// Mock factory — mocks the Supabase Storage API surface used by createUploadUrl.
// ---------------------------------------------------------------------------

function makeMockClient(opts?: {
  signed?: { data: unknown; error: unknown }
  publicUrl?: string
}) {
  const createSignedUploadUrl = vi.fn().mockResolvedValue(
    opts?.signed ?? {
      data: {
        signedUrl: 'https://storage.example/upload?token=abc',
        token: 'abc',
        path: 'ignored',
      },
      error: null,
    }
  )
  const getPublicUrl = vi.fn().mockReturnValue({
    data: { publicUrl: opts?.publicUrl ?? 'https://storage.example/public/file.jpg' },
  })
  const from = vi.fn().mockReturnValue({ createSignedUploadUrl, getPublicUrl })

  const client = { storage: { from } } as unknown as SupabaseClient<Database>
  return { client, from, createSignedUploadUrl, getPublicUrl }
}

describe('STORAGE_BUCKETS', () => {
  it('declares the four v1 buckets', () => {
    expect(STORAGE_BUCKETS).toEqual(
      expect.objectContaining({
        avatars: 'avatars',
        logos: 'logos',
        covers: 'covers',
        docs: 'docs',
      })
    )
  })
})

describe('createUploadUrl', () => {
  let mock: ReturnType<typeof makeMockClient>

  beforeEach(() => {
    mock = makeMockClient()
  })

  it('generates a presigned upload URL scoped to the user under the bucket', async () => {
    const result = await createUploadUrl(mock.client, {
      bucket: 'avatars',
      userId: 'user-123',
      ext: 'jpg',
    })

    expect(mock.from).toHaveBeenCalledWith('avatars')
    // Path must be namespaced under the userId so RLS owner policies apply.
    const path = mock.createSignedUploadUrl.mock.calls[0]![0] as string
    expect(path.startsWith('user-123/')).toBe(true)
    expect(path.endsWith('.jpg')).toBe(true)

    expect(result.uploadUrl).toBe('https://storage.example/upload?token=abc')
    expect(result.publicUrl).toBe('https://storage.example/public/file.jpg')
    // publicUrl is derived from the same path that was signed.
    expect(mock.getPublicUrl).toHaveBeenCalledWith(path)
  })

  it('normalizes the extension (strips leading dot, lowercases)', async () => {
    await createUploadUrl(mock.client, {
      bucket: 'logos',
      userId: 'u1',
      ext: '.PNG',
    })
    const path = mock.createSignedUploadUrl.mock.calls[0]![0] as string
    expect(path.endsWith('.png')).toBe(true)
  })

  it('rejects an unknown bucket', async () => {
    await expect(
      createUploadUrl(mock.client, {
        // @ts-expect-error testing runtime guard against an invalid bucket
        bucket: 'malware',
        userId: 'u1',
        ext: 'jpg',
      })
    ).rejects.toBeInstanceOf(StorageError)
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('rejects a missing userId', async () => {
    await expect(
      createUploadUrl(mock.client, { bucket: 'avatars', userId: '', ext: 'jpg' })
    ).rejects.toBeInstanceOf(StorageError)
  })

  it('rejects a disallowed extension', async () => {
    await expect(
      createUploadUrl(mock.client, { bucket: 'avatars', userId: 'u1', ext: 'exe' })
    ).rejects.toBeInstanceOf(StorageError)
  })

  it('allows pdf for the docs bucket', async () => {
    await expect(
      createUploadUrl(mock.client, { bucket: 'docs', userId: 'u1', ext: 'pdf' })
    ).resolves.toMatchObject({ uploadUrl: expect.any(String) })
  })

  it('surfaces a StorageError when Supabase returns an error', async () => {
    const failing = makeMockClient({ signed: { data: null, error: { message: 'boom' } } })
    await expect(
      createUploadUrl(failing.client, { bucket: 'avatars', userId: 'u1', ext: 'jpg' })
    ).rejects.toBeInstanceOf(StorageError)
  })

  it('generates unique paths for successive calls', async () => {
    await createUploadUrl(mock.client, { bucket: 'covers', userId: 'u1', ext: 'jpg' })
    await createUploadUrl(mock.client, { bucket: 'covers', userId: 'u1', ext: 'jpg' })
    const p1 = mock.createSignedUploadUrl.mock.calls[0]![0] as string
    const p2 = mock.createSignedUploadUrl.mock.calls[1]![0] as string
    expect(p1).not.toBe(p2)
  })
})
