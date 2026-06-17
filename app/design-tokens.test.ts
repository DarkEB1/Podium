import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// C1 — clean Airbnb design token + typeface system contract.
// Re-tokened away from neo-brutalism: soft grey borders, soft layered shadows,
// 14px radius, flat near-white page (no paper-grain). Nord palette; Geist/DM Sans wiring.

const css = readFileSync(path.resolve(__dirname, 'globals.css'), 'utf8')
const layout = readFileSync(path.resolve(__dirname, 'layout.tsx'), 'utf8')

describe('T1 design tokens (globals.css)', () => {
  it('maps the heading typeface to Geist and body to DM Sans', () => {
    expect(css).toMatch(/--font-heading:\s*var\(--font-geist\)/)
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

  it('page background is near-white distinct from the white card surface', () => {
    expect(css).toMatch(/--background:\s*#FAFAFC/)
    expect(css).toMatch(/--card:\s*#FFFFFF/)
  })

  it('uses the Nord snow-storm hairline border token', () => {
    expect(css).toMatch(/--border:\s*#E5E9F0/)
  })

  it('uses a frost-blue primary and a light frost accent tint', () => {
    expect(css).toMatch(/--primary:\s*#5E81AC/)
    expect(css).toMatch(/--accent:\s*#E5E9F0/)
  })

  it('defines soft layered card shadows', () => {
    expect(css).toMatch(/--shadow-card:\s*0 1px 2px rgba\(0,0,0,0\.06\), 0 6px 16px rgba\(0,0,0,0\.08\)/)
    expect(css).toMatch(/--shadow-card-hover:\s*0 10px 28px rgba\(0,0,0,0\.12\)/)
  })

  it('drops the hard neo-brutalist shadow tokens', () => {
    expect(css).not.toMatch(/--shadow-press:\s*2px 2px 0/)
    expect(css).not.toMatch(/3px 3px 0 var\(--primary\)/)
  })

  it('sets radius to 14px', () => {
    expect(css).toMatch(/--radius:\s*0\.875rem/)
  })

  it('exposes the card shadow tokens as Tailwind utilities via @theme', () => {
    expect(css).toMatch(/--shadow-card:\s*var\(--shadow-card\)/)
    expect(css).toMatch(/--shadow-card-hover:\s*var\(--shadow-card-hover\)/)
  })

  it('sets heading and body type rhythm (line-height + tracking)', () => {
    expect(css).toMatch(/line-height:\s*1\.18/)
    expect(css).toMatch(/letter-spacing:\s*-0\.01em/)
    expect(css).toMatch(/line-height:\s*1\.55/)
  })

  it('defines gentle pressable + liftable motion utilities', () => {
    expect(css).toMatch(/\.pressable\b/)
    expect(css).toMatch(/\.liftable\b/)
    // liftable: gentle -2px lift on the Y axis + soft hover shadow
    expect(css).toMatch(/translateY\(-2px\)/)
    expect(css).toMatch(/box-shadow:\s*var\(--shadow-card-hover\)/)
    // pressable: subtle scale only, no hard 2px translate
    expect(css).toMatch(/scale\(0?\.99\)/)
    expect(css).not.toMatch(/translate\(2px,\s*2px\)/)
  })

  it('degrades motion under prefers-reduced-motion', () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
    expect(css).toMatch(/transform:\s*none/)
  })

  it('removes the fractalNoise paper-grain body background', () => {
    expect(css).not.toMatch(/fractalNoise/)
  })

  it('is light-mode only: no dark-mode token block', () => {
    expect(css).not.toMatch(/\.dark\s*\{/)
  })
})

describe('T1 typefaces (layout.tsx)', () => {
  it('wires Geist and DM Sans via next/font/google', () => {
    expect(layout).toMatch(/from ['"]next\/font\/google['"]/)
    expect(layout).toMatch(/\bGeist\b/)
    expect(layout).toMatch(/DM_Sans/)
  })

  it('removes the old Syne import', () => {
    expect(layout).not.toMatch(/\bSyne\b/)
  })

  it('binds the font CSS variables expected by the tokens', () => {
    expect(layout).toMatch(/--font-geist/)
    expect(layout).toMatch(/--font-dm-sans/)
  })
})
