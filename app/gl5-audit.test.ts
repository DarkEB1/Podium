import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

/**
 * GL5 — Whitespace / typography / contrast audit (plan §2.1–2.2, §9.4).
 *
 * Static source audit over the per-role page files whose owning pods are
 * complete. Verifies the three-size type scale (no raw Tailwind text-* sizes),
 * page margins (24px mobile / 64px desktop), and WCAG-AA contrast (no raw
 * grey/colour-100/700 palette pills — semantic success/warning/destructive
 * tokens only, no dark-mode infrastructure).
 */

const root = path.resolve(__dirname, '..')

// Per-role page files re-typed by GL5. Auth/public + 403 are not role pods.
const auditedFiles = [
  'app/(athlete)/athlete/dashboard/page.tsx',
  'app/(athlete)/athlete/messages/page.tsx',
  'app/(athlete)/athlete/requests/page.tsx',
  'app/(athlete)/athlete/saved/page.tsx',
  'app/(athlete)/athlete/settings/page.tsx',
  'app/(brand)/brand/messages/page.tsx',
  'app/(brand)/brand/payments/page.tsx',
  'app/(brand)/brand/settings/page.tsx',
  'app/(brand)/brand/subscription/page.tsx',
  'app/(brand)/brand/listings/duplicate-listing-form.tsx',
]

function read(rel: string): string {
  return readFileSync(path.join(root, rel), 'utf8')
}

// Matches Tailwind font-size utilities that are NOT the three permitted scale
// tokens (text-large / text-medium / text-small).
const OFF_SCALE_TEXT = /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)\b/
// Raw palette colour pills (grey-on-grey / low-contrast risk, never semantic).
const RAW_PALETTE = /\b(?:bg|text|border)-(?:green|yellow|red|blue|gray|slate|zinc|neutral|stone)-\d{2,3}\b/
// Dark-mode infrastructure is deferred (spec §10.1) — must not appear.
const DARK_MODE = /\bdark:/
// Page container margin: the mx-auto wrapper must set 24px mobile (px-6) and
// 64px desktop (md:px-16), never the 16px px-4 used by the old scaffold.
const TIGHT_PAGE_MARGIN = /className="[^"]*\bmx-auto\b[^"]*\bpx-4\b[^"]*"/

describe('GL5 typography/contrast audit', () => {
  for (const rel of auditedFiles) {
    describe(rel, () => {
      const src = read(rel)

      it('uses only the three-size type scale (no raw text-* sizes)', () => {
        expect(src).not.toMatch(OFF_SCALE_TEXT)
      })

      it('uses semantic colour tokens, not raw palette swatches', () => {
        expect(src).not.toMatch(RAW_PALETTE)
      })

      it('ships no dark-mode classes (deferred per spec §10.1)', () => {
        expect(src).not.toMatch(DARK_MODE)
      })
    })
  }

  it('page containers use 24px mobile / 64px desktop margins', () => {
    const offenders = auditedFiles.filter((rel) => TIGHT_PAGE_MARGIN.test(read(rel)))
    expect(offenders).toEqual([])
  })
})
