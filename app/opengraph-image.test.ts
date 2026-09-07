import { describe, it, expect, vi } from 'vitest'

// next/og pulls in the edge ImageResponse runtime; the render itself is exercised
// by Next at build/request time, so here we only assert the route's metadata
// contract (the part Next reads to emit the og:image / twitter:image tags).
vi.mock('next/og', () => ({
  ImageResponse: class {
    constructor(..._args: unknown[]) {}
  },
}))

import * as og from './opengraph-image'
import * as twitter from './twitter-image'

// WS-INFRA P2: home declared summary_large_image with no image. A 1200x630 PNG
// at the app root gives every route an og:image, and twitter-image re-exports it.
describe('social share image (WS-INFRA P2)', () => {
  it('declares the 1200x630 PNG contract Next needs for og:image', () => {
    expect(og.size).toEqual({ width: 1200, height: 630 })
    expect(og.contentType).toBe('image/png')
    expect(og.alt).toMatch(/Podium/)
    expect(typeof og.default).toBe('function')
  })

  it('twitter-image reuses the same card so twitter:image is populated too', () => {
    expect(twitter.size).toEqual(og.size)
    expect(twitter.contentType).toBe(og.contentType)
    expect(twitter.default).toBe(og.default)
  })
})
