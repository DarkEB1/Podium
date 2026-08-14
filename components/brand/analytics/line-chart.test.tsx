import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LineChart } from './line-chart'

describe('LineChart', () => {
  it('renders a polyline point per data value', () => {
    const { container } = render(
      <LineChart data={[{ x: '2026-08-01', y: 2 }, { x: '2026-08-02', y: 5 }, { x: '2026-08-03', y: 1 }]} />,
    )
    const poly = container.querySelector('polyline')
    expect(poly).not.toBeNull()
    expect((poly?.getAttribute('points') ?? '').trim().split(/\s+/)).toHaveLength(3)
  })
  it('renders nothing breaking for empty data', () => {
    const { container } = render(<LineChart data={[]} />)
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
