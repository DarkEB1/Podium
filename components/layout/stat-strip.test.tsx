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

  it('gives each tile an ink border and hard shadow', () => {
    render(<StatStrip stats={[{ label: 'A', value: '1' }]} />)
    const tile = screen.getByRole('listitem')
    expect(tile.className).toContain('border-border-ink')
    expect(tile.className).toContain('shadow-[var(--shadow-card)]')
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
})
