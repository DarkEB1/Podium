import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Target } from 'lucide-react'
import StatStrip from './stat-strip'

describe('StatStrip', () => {
  it('renders each stat label and value', () => {
    render(
      <StatStrip
        stats={[
          { label: 'Active Listings', value: '4' },
          { label: 'Matches', value: '12' },
          { label: 'Proposals', value: '3' },
        ]}
      />,
    )
    expect(screen.getByText('Active Listings')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('Matches')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('Proposals')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('exposes a list semantic with one item per stat', () => {
    render(<StatStrip stats={[{ label: 'A', value: '1' }, { label: 'B', value: '2' }]} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('gives each tile a clean light surface with a soft shadow', () => {
    render(<StatStrip stats={[{ label: 'A', value: '1' }]} />)
    const tile = screen.getByRole('listitem')
    // Clean Airbnb: single light border, soft resting shadow, no ink border.
    expect(tile.className).toContain('border-border')
    expect(tile.className).not.toContain('border-border-ink')
    expect(tile.className).toContain('shadow-sm')
    expect(tile.className).not.toMatch(/shadow-\[\d/)
  })

  it('lifts gently on hover instead of pressing into a hard shadow', () => {
    render(<StatStrip stats={[{ label: 'A', value: '1' }]} />)
    const tile = screen.getByRole('listitem')
    expect(tile.className).toContain('hover:-translate-y-0.5')
    expect(tile.className).not.toMatch(/rotate-/)
  })

  it('renders an aria-hidden Lucide icon when an icon component is passed', () => {
    const { container } = render(
      <StatStrip stats={[{ label: 'Targets', value: '7', icon: Target }]} />,
    )
    const svg = container.querySelector('svg[aria-hidden="true"]')
    expect(svg).toBeInTheDocument()
  })

  it('maps an icon concept key to a Lucide icon', () => {
    const { container } = render(
      <StatStrip stats={[{ label: 'Partners', value: '2', iconKey: 'partners' }]} />,
    )
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument()
  })

  it('keeps the label as visible text (not icon-only)', () => {
    render(<StatStrip stats={[{ label: 'Matches', value: '12', iconKey: 'partners' }]} />)
    expect(screen.getByText('Matches')).toBeInTheDocument()
  })

  // "Semi-Professional" at the display size overflowed a ~135px tile.
  it('steps long string values down from the display size and lets them wrap', () => {
    render(<StatStrip stats={[{ label: 'Level', value: 'Semi-Professional' }]} />)
    const value = screen.getByText('Semi-Professional')
    expect(value.className).toContain('text-large')
    expect(value.className).toContain('break-words')
    expect(value.className).not.toContain('text-display')
  })

  it('keeps short numeric values at the display size', () => {
    render(<StatStrip stats={[{ label: 'Matches', value: '12.4K' }]} />)
    const value = screen.getByText('12.4K')
    expect(value.className).toContain('text-display')
  })

  it('renders a value with an href as a link', () => {
    render(
      <StatStrip
        stats={[{ label: 'Followers', value: 'Add socials', href: '/athlete/settings' }]}
      />,
    )
    expect(screen.getByRole('link', { name: 'Add socials' })).toHaveAttribute(
      'href',
      '/athlete/settings',
    )
  })

  it('renders a caption under the value when provided', () => {
    render(
      <StatStrip stats={[{ label: 'Followers', value: '12.4K', caption: 'Self-reported' }]} />,
    )
    expect(screen.getByText('Self-reported')).toBeInTheDocument()
  })

  it('replaces a decorative value with its screen-reader text', () => {
    render(
      <StatStrip stats={[{ label: 'Followers', value: '-', srValue: 'Not provided' }]} />,
    )
    expect(screen.getByText('Not provided')).toBeInTheDocument()
    expect(screen.getByText('-')).toHaveAttribute('aria-hidden', 'true')
  })
})
