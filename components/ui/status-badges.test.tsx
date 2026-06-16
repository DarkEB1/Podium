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

describe('LevelChip', () => {
  it('renders the level text as an accent pill', () => {
    render(<LevelChip level="National" />)
    const chip = screen.getByText('National')
    expect(chip).toBeInTheDocument()
    expect(styledOf(chip).className).toMatch(/accent/)
  })
})

describe('AvailabilityBadge', () => {
  it('renders available_now with a visible label and an icon (not colour alone)', () => {
    render(<AvailabilityBadge status="available_now" />)
    const badge = styledOf(screen.getByText(/available now/i))
    expect(badge).toBeInTheDocument()
    // icon present alongside the label -> never colour alone
    expect(badge.querySelector('svg')).not.toBeNull()
    expect(badge.className).toMatch(/success/)
  })

  it('renders available_from including the optional date in amber', () => {
    render(<AvailabilityBadge status="available_from" date="Sep 2026" />)
    const badge = styledOf(screen.getByText(/available from sep 2026/i))
    expect(badge).toBeInTheDocument()
    expect(badge.querySelector('svg')).not.toBeNull()
    expect(badge.className).toMatch(/warning/)
  })

  it('renders not_available in red with an icon', () => {
    render(<AvailabilityBadge status="not_available" />)
    const badge = styledOf(screen.getByText(/not available/i))
    expect(badge).toBeInTheDocument()
    expect(badge.querySelector('svg')).not.toBeNull()
    expect(badge.className).toMatch(/destructive/)
  })
})

describe('VerifiedBadge', () => {
  it('renders a blue Verified badge with an icon when verified', () => {
    render(<VerifiedBadge verified />)
    const badge = styledOf(screen.getByText(/^verified$/i))
    expect(badge).toBeInTheDocument()
    expect(badge.querySelector('svg')).not.toBeNull()
    expect(badge.className).toMatch(/primary/)
  })

  it('renders a grey Unverified badge when not verified', () => {
    render(<VerifiedBadge verified={false} />)
    const badge = styledOf(screen.getByText(/unverified/i))
    expect(badge).toBeInTheDocument()
    expect(badge.className).toMatch(/muted/)
  })
})

describe('SeekingTag', () => {
  it('renders children with low-opacity accent background and accent text', () => {
    render(<SeekingTag>Seeking sponsor</SeekingTag>)
    const tag = styledOf(screen.getByText('Seeking sponsor'))
    expect(tag).toBeInTheDocument()
    expect(tag.className).toMatch(/bg-accent\//)
    expect(tag.className).toMatch(/text-accent/)
  })
})
