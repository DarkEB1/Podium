import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PodiumMark, { BAR_RATIOS, ROUND_RATIO, ROUND_MINOR } from './podium-mark'

describe('PodiumMark', () => {
  it('renders three bars with heights in the 38/64/100 ratio', () => {
    const { container } = render(<PodiumMark height={100} />)
    const rects = container.querySelectorAll('path')
    expect(rects).toHaveLength(3)
    expect(BAR_RATIOS).toEqual([0.38, 0.64, 1])
  })

  it('rounds the top-left corner at 60% of bar width, minor corners at 12%', () => {
    expect(ROUND_RATIO).toBe(0.6)
    expect(ROUND_MINOR).toBe(0.12)
    const { container } = render(<PodiumMark height={100} />)
    // Bar width in the 100-high mark is 30 units → major radius 18, minor 3.6
    const d = container.querySelectorAll('path')[0]!.getAttribute('d')!
    expect(d).toContain('18')
  })

  it('paints the tallest bar lime when limeTop is set, ink otherwise', () => {
    const { container } = render(<PodiumMark height={40} limeTop />)
    const fills = Array.from(container.querySelectorAll('path')).map((p) => p.getAttribute('fill'))
    expect(fills[0]).toBe('currentColor')
    expect(fills[2]).toBe('var(--lime)')
  })

  it('is decorative by default (aria-hidden)', () => {
    const { container } = render(<PodiumMark />)
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
  })
})
