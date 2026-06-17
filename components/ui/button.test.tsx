import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Button, buttonVariants } from './button'

function getButton(name: RegExp | string): HTMLElement {
  return screen.getByRole('button', { name })
}

describe('Button re-skin (neo-brutalist, plan §6/§8 + §1.1/§1.5)', () => {
  it('carries the ink border, hard press shadow, and .pressable interaction class', () => {
    render(<Button>Make your move</Button>)
    const btn = getButton(/make your move/i)
    expect(btn).toBeInTheDocument()
    // ink border (plan §1.1 --border-ink via border-border-ink)
    expect(btn.className).toMatch(/border-border-ink/)
    // hard-offset press shadow token (plan §1.1 --shadow-press)
    expect(btn.className).toMatch(/shadow-press/)
    // press micro-interaction utility (plan §1.5 .pressable)
    expect(btn.className).toMatch(/\bpressable\b/)
  })

  it('renders its label in the heading font weight (plan §6)', () => {
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
    expect(btn.className).toMatch(/border-border-ink/)
  })

  it('link variant keeps a visible text label for accessibility', () => {
    render(<Button variant="link">Learn more</Button>)
    expect(getButton(/learn more/i)).toHaveTextContent('Learn more')
  })
})
