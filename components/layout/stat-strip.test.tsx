import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
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
})
