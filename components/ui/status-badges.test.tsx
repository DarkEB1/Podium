import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import {
  LevelChip,
  AvailabilityBadge,
  VerifiedBadge,
  SeekingTag,
} from './status-badges'

// The styled container is the Badge wrapper (slot="badge"); text may live in a
// nested span, so resolve to the styled element before asserting on classes.
function styledOf(textNode: HTMLElement): HTMLElement {
  return (textNode.closest('[data-slot="badge"]') as HTMLElement) ?? textNode
}

// Clean Airbnb badges: soft rounded pills, subtle tinted backgrounds, no
// heavy ink border. Assert there is NO brutalist ink border anywhere.
function expectNoInkBorder(el: HTMLElement) {
  expect(el.className).not.toMatch(/border-border-ink/)
  expect(el.className).not.toMatch(/border-foreground/)
  expect(el.className).not.toMatch(/shadow-\[/)
  expect(el.className).not.toMatch(/-?rotate-/)
}

describe('LevelChip', () => {
  it('renders the level text as a soft accent pill (no ink border)', () => {
    render(<LevelChip level="National" />)
    const chip = styledOf(screen.getByText('National'))
    expect(chip).toBeInTheDocument()
    expect(chip.className).toMatch(/accent/)
    expectNoInkBorder(chip)
  })
})

describe('AvailabilityBadge', () => {
  it('renders available_now in green with a Circle icon (not colour alone), soft pill', () => {
    render(<AvailabilityBadge status="available_now" />)
    const badge = styledOf(screen.getByText(/available now/i))
    expect(badge).toBeInTheDocument()
    // icon present alongside the label -> never colour alone
    const svg = badge.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveClass('lucide-circle')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(badge.className).toMatch(/success/)
    expectNoInkBorder(badge)
  })

  it('renders available_from including the optional date in amber with a Circle icon', () => {
    render(<AvailabilityBadge status="available_from" date="Sep 2026" />)
    const badge = styledOf(screen.getByText(/available from sep 2026/i))
    expect(badge).toBeInTheDocument()
    const svg = badge.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveClass('lucide-circle')
    expect(badge.className).toMatch(/warning/)
    expectNoInkBorder(badge)
  })

  it('renders not_available in red with a Circle icon', () => {
    render(<AvailabilityBadge status="not_available" />)
    const badge = styledOf(screen.getByText(/not available/i))
    expect(badge).toBeInTheDocument()
    const svg = badge.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveClass('lucide-circle')
    expect(badge.className).toMatch(/destructive/)
    expectNoInkBorder(badge)
  })
})

describe('VerifiedBadge', () => {
  it('renders a blue Verified badge with a BadgeCheck icon when verified', () => {
    render(<VerifiedBadge verified />)
    const badge = styledOf(screen.getByText(/^verified$/i))
    expect(badge).toBeInTheDocument()
    const svg = badge.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveClass('lucide-badge-check')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(badge.className).toMatch(/primary/)
    expectNoInkBorder(badge)
  })

  it('renders a grey Unverified badge (no icon, label carries meaning) when not verified', () => {
    render(<VerifiedBadge verified={false} />)
    const badge = styledOf(screen.getByText(/unverified/i))
    expect(badge).toBeInTheDocument()
    expect(badge.className).toMatch(/muted/)
    expectNoInkBorder(badge)
  })
})

describe('SeekingTag', () => {
  it('renders children with low-opacity primary background as a soft pill', () => {
    render(<SeekingTag>Seeking sponsor</SeekingTag>)
    const tag = styledOf(screen.getByText('Seeking sponsor'))
    expect(tag).toBeInTheDocument()
    expect(tag.className).toMatch(/bg-primary\//)
    expect(tag.className).toMatch(/text-primary/)
    expectNoInkBorder(tag)
  })
})
