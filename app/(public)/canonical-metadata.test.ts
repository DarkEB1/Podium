import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// WS-INFRA P2: only `/` declared a canonical, so `/pricing?utm_source=…` and the
// alias host were indexable duplicates. Each public page now sets one, resolved
// against the metadataBase in app/layout.tsx.
//
// These are static source assertions (not module imports): importing a page.tsx
// pulls its whole component tree + the Tailwind/PostCSS transform, which is slow
// and flaky under load. The strings below are the exact fix, so asserting on
// them is both deterministic and sufficient.
const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

describe('public pages declare a canonical URL (WS-INFRA P2)', () => {
  it.each([
    ['pricing', '/pricing'],
    ['terms', '/terms'],
    ['privacy', '/privacy'],
    ['cookies', '/cookies'],
    ['contact', '/contact'],
  ])('%s page metadata canonicalises to %s', (dir, expected) => {
    const src = read(`app/(public)/${dir}/page.tsx`)
    expect(src).toContain(`canonical: '${expected}'`)
  })

  it('the root layout sets a metadataBase so relative canonicals resolve', () => {
    const src = read('app/layout.tsx')
    expect(src).toMatch(/metadataBase:\s*new URL\(siteUrl\(\)\)/)
  })
})
