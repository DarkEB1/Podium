import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// T1 — neo-brutalist design token + typeface system contract (plan §1.1, §1.2, §1.5).
// These assertions lock the EXACT token values that every other task consumes.

const css = readFileSync(path.resolve(__dirname, 'globals.css'), 'utf8')
const layout = readFileSync(path.resolve(__dirname, 'layout.tsx'), 'utf8')

describe('T1 design tokens (globals.css)', () => {
  it('maps the heading typeface to Bricolage and body to DM Sans', () => {
    expect(css).toMatch(/--font-heading:\s*var\(--font-bricolage\)/)
    expect(css).toMatch(/--font-sans:\s*var\(--font-dm-sans\)/)
  })

  it('drops the old Syne heading binding', () => {
    expect(css).not.toMatch(/--font-syne/)
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

  it('defines the ink border token and width', () => {
    expect(css).toMatch(/--border-ink:\s*oklch\(0\.20 0 0\)/)
    expect(css).toMatch(/--border-ink-width:\s*1\.5px/)
    expect(css).toMatch(/--border:\s*oklch\(0\.88 0 0\)/)
  })

  it('uses a punchier amber accent for flat blocks', () => {
    expect(css).toMatch(/--accent:\s*oklch\(0\.80 0\.13 85\)/)
  })

  it('defines the hard-offset shadow token family', () => {
    expect(css).toMatch(/--shadow-card:\s*3px 3px 0 oklch\(0\.20 0 0 \/ 0\.92\)/)
    expect(css).toMatch(/--shadow-card-hover:\s*6px 6px 0 oklch\(0\.20 0 0 \/ 0\.92\)/)
    expect(css).toMatch(/--shadow-press:\s*2px 2px 0 oklch\(0\.20 0 0\)/)
    expect(css).toMatch(/--shadow-focus:\s*3px 3px 0 var\(--primary\)/)
  })

  it('sets radius to 10px', () => {
    expect(css).toMatch(/--radius:\s*0\.625rem/)
  })

  it('exposes the shadow + ink-border tokens as Tailwind utilities via @theme', () => {
    expect(css).toMatch(/--shadow-card:\s*var\(--shadow-card\)/)
    expect(css).toMatch(/--shadow-card-hover:\s*var\(--shadow-card-hover\)/)
    expect(css).toMatch(/--shadow-press:\s*var\(--shadow-press\)/)
    expect(css).toMatch(/--shadow-focus:\s*var\(--shadow-focus\)/)
    expect(css).toMatch(/--color-border-ink:\s*var\(--border-ink\)/)
  })

  it('sets heading and body type rhythm (line-height + tracking)', () => {
    expect(css).toMatch(/line-height:\s*1\.18/)
    expect(css).toMatch(/letter-spacing:\s*-0\.01em/)
    expect(css).toMatch(/line-height:\s*1\.55/)
  })

  it('defines pressable + liftable motion utilities', () => {
    expect(css).toMatch(/\.pressable\b/)
    expect(css).toMatch(/\.liftable\b/)
    expect(css).toMatch(/translate\(2px,\s*2px\)/)
    expect(css).toMatch(/translate\(-2px,\s*-2px\)/)
  })

  it('degrades motion under prefers-reduced-motion', () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
    expect(css).toMatch(/transform:\s*none/)
  })

  it('adds a faint fractalNoise grain to the body background', () => {
    expect(css).toMatch(/fractalNoise/)
    expect(css).toMatch(/background-image/)
  })

  it('is light-mode only: no dark-mode token block', () => {
    expect(css).not.toMatch(/\.dark\s*\{/)
  })
})

describe('T1 typefaces (layout.tsx)', () => {
  it('wires Bricolage Grotesque and DM Sans via next/font/google', () => {
    expect(layout).toMatch(/from ['"]next\/font\/google['"]/)
    expect(layout).toMatch(/Bricolage_Grotesque/)
    expect(layout).toMatch(/DM_Sans/)
  })

  it('removes the old Syne import', () => {
    expect(layout).not.toMatch(/\bSyne\b/)
  })

  it('binds the font CSS variables expected by the tokens', () => {
    expect(layout).toMatch(/--font-bricolage/)
    expect(layout).toMatch(/--font-dm-sans/)
  })
})
