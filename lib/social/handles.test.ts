import { describe, expect, it } from 'vitest'

import { parseSocialInput, socialHandle, socialUrl } from './handles'

describe('parseSocialInput', () => {
  it('accepts "@handle" and strips the @', () => {
    expect(parseSocialInput('instagram', '@jane_doe')).toEqual({
      handle: 'jane_doe',
      url: 'https://instagram.com/jane_doe',
    })
  })

  it('accepts a bare handle', () => {
    expect(parseSocialInput('twitter', 'jane.doe')).toEqual({
      handle: 'jane.doe',
      url: 'https://x.com/jane.doe',
    })
  })

  it('accepts a full profile URL on the right host', () => {
    expect(parseSocialInput('instagram', 'https://www.instagram.com/jane/')).toEqual({
      handle: 'jane',
      url: 'https://instagram.com/jane',
    })
  })

  it('accepts a scheme-less URL and drops query/hash noise', () => {
    expect(parseSocialInput('tiktok', 'tiktok.com/@jane?lang=en')).toEqual({
      handle: 'jane',
      url: 'https://tiktok.com/@jane',
    })
  })

  it('accepts x.com URLs for twitter', () => {
    expect(parseSocialInput('twitter', 'https://x.com/jane')?.handle).toBe('jane')
  })

  it('rejects a URL on the wrong host', () => {
    expect(parseSocialInput('instagram', 'https://tiktok.com/@jane')).toBeNull()
    expect(parseSocialInput('twitter', 'https://facebook.com/jane')).toBeNull()
  })

  it('rejects junk that cannot be a handle', () => {
    expect(parseSocialInput('instagram', 'not a handle!!')).toBeNull()
    expect(parseSocialInput('youtube', '@@@')).toBeNull()
    expect(parseSocialInput('instagram', '@')).toBeNull()
  })

  it('returns null for empty and missing input', () => {
    expect(parseSocialInput('instagram', '')).toBeNull()
    expect(parseSocialInput('instagram', '   ')).toBeNull()
    expect(parseSocialInput('instagram', null)).toBeNull()
    expect(parseSocialInput('instagram', undefined)).toBeNull()
  })

  it('builds the @-prefixed path for tiktok and youtube URLs', () => {
    expect(parseSocialInput('tiktok', 'jane')?.url).toBe('https://tiktok.com/@jane')
    expect(parseSocialInput('youtube', '@jane')?.url).toBe('https://youtube.com/@jane')
  })
})

describe('socialHandle / socialUrl', () => {
  it('reads legacy stored URLs back to a handle and absolute URL', () => {
    expect(socialHandle('instagram', 'https://instagram.com/jane')).toBe('jane')
    expect(socialUrl('instagram', 'https://instagram.com/jane')).toBe(
      'https://instagram.com/jane',
    )
  })

  it('reads canonical stored handles', () => {
    expect(socialHandle('twitter', 'jane')).toBe('jane')
    expect(socialUrl('twitter', 'jane')).toBe('https://x.com/jane')
  })

  it('returns null for unreadable stored values', () => {
    expect(socialHandle('instagram', 'https://example.com/jane')).toBeNull()
    expect(socialUrl('instagram', null)).toBeNull()
  })
})
