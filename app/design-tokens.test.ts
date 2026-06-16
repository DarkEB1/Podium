import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// A1 — design token + typeface system contract (plan §1.1, spec §2.1-2.4, §10.1).
// These assertions lock the EXACT token values that every other pod consumes.

const css = readFileSync(path.resolve(__dirname, 'globals.css'), 'utf8')
const layout = readFileSync(path.resolve(__dirname, 'layout.tsx'), 'utf8')

describe('A1 design tokens (globals.css)', () => {
  it('maps the two typefaces: Syne -> heading, DM Sans -> sans', () => {
    expect(css).toMatch(/--font-heading:\s*var\(--font-syne\)/)
    expect(css).toMatch(/--font-sans:\s*var\(--font-dm-sans\)/)
  })

  it('defines exactly the three-size type scale', () => {
    expect(css).toMatch(/--text-large:\s*1\.5rem/)
    expect(css).toMatch(/--text-medium:\s*1rem/)
    expect(css).toMatch(/--text-small:\s*0\.8125rem/)
  })

  it('exposes the type scale as Tailwind text-* utilities via @theme', () => {
    expect(css).toMatch(/--text-large:\s*var\(--text-large\)/)
    expect(css).toMatch(/--text-medium:\s*var\(--text-medium\)/)
    expect(css).toMatch(/--text-small:\s*var\(--text-small\)/)
  })

  it('page background is a warm off-white distinct from the white card surface', () => {
    expect(css).toMatch(/--background:\s*oklch\(0\.985 0\.004 95\)/)
    expect(css).toMatch(/--card:\s*oklch\(1 0 0\)/)
  })

  it('defines the semantic colour system including success and warning', () => {
    expect(css).toMatch(/--primary:\s*oklch\(0\.55 0\.18 255\)/)
    expect(css).toMatch(/--accent:\s*oklch\(0\.72 0\.15 45\)/)
    expect(css).toMatch(/--success:\s*oklch\(0\.62 0\.17 150\)/)
    expect(css).toMatch(/--warning:\s*oklch\(0\.78 0\.16 80\)/)
    expect(css).toMatch(/--destructive:\s*oklch\(0\.58 0\.22 27\)/)
    expect(css).toMatch(/--foreground:\s*oklch\(0\.20 0 0\)/)
    expect(css).toMatch(/--muted-foreground:\s*oklch\(0\.52 0 0\)/)
  })

  it('exposes success and warning as Tailwind colour utilities via @theme', () => {
    expect(css).toMatch(/--color-success:\s*var\(--success\)/)
    expect(css).toMatch(/--color-warning:\s*var\(--warning\)/)
  })

  it('sets radius to 12px and both card shadow tokens', () => {
    expect(css).toMatch(/--radius:\s*0\.75rem/)
    expect(css).toMatch(/--shadow-card:\s*0 2px 8px rgba\(0,0,0,0\.08\)/)
    expect(css).toMatch(/--shadow-card-hover:\s*0 4px 16px rgba\(0,0,0,0\.12\)/)
  })

  it('is light-mode only: no dark-mode token block', () => {
    expect(css).not.toMatch(/\.dark\s*\{/)
  })
})

describe('A1 typefaces (layout.tsx)', () => {
  it('wires Syne and DM Sans via next/font/google', () => {
    expect(layout).toMatch(/from ['"]next\/font\/google['"]/)
    expect(layout).toMatch(/\bSyne\b/)
    expect(layout).toMatch(/DM_Sans/)
  })

  it('binds the font CSS variables expected by the tokens', () => {
    expect(layout).toMatch(/--font-syne/)
    expect(layout).toMatch(/--font-dm-sans/)
  })
})
