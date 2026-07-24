import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

/**
 * A-3 — WCAG AA contrast contract for the semantic colour tokens in
 * app/globals.css, computed (never eyeballed) in BOTH light and dark.
 *
 * Thresholds: 4.5:1 for normal-size text (the app's smallest tier is 13px),
 * 3:1 for non-text UI (focus ring, form-control boundary).
 */

const css = readFileSync(
  path.resolve(__dirname, '..', '..', 'app', 'globals.css'),
  'utf8'
)

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  if (start === -1) throw new Error(`missing block: ${selector}`)
  const open = css.indexOf('{', start)
  const close = css.indexOf('\n}', open)
  const body = css.slice(open, close)
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
    out[m[1] as string] = (m[2] as string).toUpperCase()
  }
  return out
}

function luminance(hex: string): number {
  const c = hex.replace('#', '')
  const channels = [0, 2, 4].map((i) => {
    const v = parseInt(c.substring(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }) as [number, number, number]
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

const light = block(':root {')
const dark = block('.dark {')

const SURFACES = ['--background', '--card', '--muted', '--accent'] as const
// Foregrounds that can sit on any of the surfaces above as normal-size text.
const TEXT_ON_SURFACES = [
  '--foreground',
  '--muted-foreground',
  '--primary',
  '--success',
  '--warning',
  '--destructive',
] as const

describe.each([
  ['light', light],
  ['dark', dark],
])('A-3 contrast — %s theme', (themeName, t) => {
  it('defines every semantic token', () => {
    for (const k of [...SURFACES, ...TEXT_ON_SURFACES, '--primary-foreground', '--ring', '--input']) {
      expect(t[k], `${themeName} is missing ${k}`).toBeTruthy()
    }
  })

  it.each(TEXT_ON_SURFACES)('%s clears 4.5:1 on every surface', (fg) => {
    for (const bg of SURFACES) {
      const ratio = contrast(t[fg] as string, t[bg] as string)
      expect(
        Number(ratio.toFixed(2)),
        `${themeName}: ${fg} (${t[fg]}) on ${bg} (${t[bg]}) = ${ratio.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('primary-foreground clears 4.5:1 on the primary fill (button labels)', () => {
    const ratio = contrast(t['--primary-foreground'] as string, t['--primary'] as string)
    expect(Number(ratio.toFixed(2)), `${themeName}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
  })

  it('accent/secondary/card foregrounds clear 4.5:1 on their own surface', () => {
    const pairs: [string, string][] = [
      ['--accent-foreground', '--accent'],
      ['--secondary-foreground', '--secondary'],
      ['--card-foreground', '--card'],
      ['--popover-foreground', '--popover'],
    ]
    for (const [fg, bg] of pairs) {
      if (!t[fg] || !t[bg]) continue
      const ratio = contrast(t[fg] as string, t[bg] as string)
      expect(Number(ratio.toFixed(2)), `${themeName}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('focus ring and form-control boundary clear the 3:1 non-text bar', () => {
    for (const token of ['--ring', '--input'] as const) {
      for (const bg of ['--background', '--card'] as const) {
        const ratio = contrast(t[token] as string, t[bg] as string)
        expect(
          Number(ratio.toFixed(2)),
          `${themeName}: ${token} (${t[token]}) on ${bg} (${t[bg]}) = ${ratio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(3)
      }
    }
  })
})

describe('A-3 dark-mode wiring', () => {
  it('rebinds the Tailwind 4 dark variant to the .dark class (next-themes attribute="class")', () => {
    expect(css).toMatch(/@custom-variant dark \(&:where\(\.dark, \.dark \*\)\);/)
  })

  it('declares color-scheme in both themes so native controls follow', () => {
    expect(light['--background']).toBeTruthy()
    expect(css).toMatch(/color-scheme:\s*light/)
    expect(css).toMatch(/color-scheme:\s*dark/)
  })
})
