import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Button, buttonVariants } from './button'

function getButton(name: RegExp | string): HTMLElement {
  return screen.getByRole('button', { name })
}

describe('Button re-skin (clean Airbnb)', () => {
  it('carries a soft rest shadow, gentle hover lift, and no brutalist styling', () => {
    render(<Button>Make your move</Button>)
    const btn = getButton(/make your move/i)
    expect(btn).toBeInTheDocument()
    // soft rest shadow (no hard offset shadow)
    expect(btn.className).toMatch(/\bshadow-sm\b/)
    expect(btn.className).toMatch(/hover:shadow-md/)
    // gentle hover lift, motion-safe only (respects prefers-reduced-motion)
    expect(btn.className).toMatch(/motion-safe:hover:-translate-y-0\.5/)
    // lightly-rounded squircle corners (12px)
    expect(btn.className).toMatch(/rounded-\[12px\]/)
    // no brutalist ink border, hard press shadow, or .pressable utility
    expect(btn.className).not.toMatch(/border-border-ink/)
    expect(btn.className).not.toMatch(/shadow-press/)
    expect(btn.className).not.toMatch(/\bpressable\b/)
  })

  it('renders its label in the DM Sans body font at semibold weight', () => {
    render(<Button>Go</Button>)
    const btn = getButton(/go/i)
    // heading-style weight, not the old font-medium
    expect(btn.className).toMatch(/font-semibold/)
    expect(btn.className).not.toMatch(/font-medium/)
  })

  it('keeps every variant available and applies variant classes', () => {
    const variants = [
      'default',
      'outline',
      'secondary',
      'ghost',
      'destructive',
      'link',
    ] as const
    for (const variant of variants) {
      const cls = buttonVariants({ variant })
      expect(typeof cls).toBe('string')
      expect(cls.length).toBeGreaterThan(0)
    }
  })

  it('keeps every size available and applies size classes', () => {
    const sizes = [
      'default',
      'xs',
      'sm',
      'lg',
      'icon',
      'icon-xs',
      'icon-sm',
      'icon-lg',
    ] as const
    for (const size of sizes) {
      const cls = buttonVariants({ size })
      expect(typeof cls).toBe('string')
      expect(cls.length).toBeGreaterThan(0)
    }
  })

  it('still forwards arbitrary props and merges custom className', () => {
    render(
      <Button type="submit" className="my-custom-class" disabled>
        Submit
      </Button>
    )
    const btn = getButton(/submit/i)
    expect(btn).toHaveAttribute('type', 'submit')
    expect(btn).toBeDisabled()
    expect(btn.className).toMatch(/my-custom-class/)
    // base contract still present after className merge
    expect(btn.className).toMatch(/\bshadow-sm\b/)
  })

  it('link variant keeps a visible text label for accessibility', () => {
    render(<Button variant="link">Learn more</Button>)
    expect(getButton(/learn more/i)).toHaveTextContent('Learn more')
  })
})
