import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import HorizontalTrack from './horizontal-track'

afterEach(() => vi.unstubAllGlobals())

function stubMedia({ wide, reduced }: { wide: boolean; reduced: boolean }) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('min-width') ? wide : q.includes('prefers-reduced-motion') ? reduced : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

const PANELS = ['P1', 'P2', 'P3', 'P4', 'P5'].map((t) => <section key={t}>{t}</section>)

describe('HorizontalTrack', () => {
  it('renders all five panels in DOM order (track mode)', () => {
    stubMedia({ wide: true, reduced: false })
    render(<HorizontalTrack>{PANELS}</HorizontalTrack>)
    const text = screen.getByTestId('landing-track').textContent!
    expect(text.indexOf('P1')).toBeLessThan(text.indexOf('P5'))
  })

  it('draws the continuous baseline and panel ticks in track mode', () => {
    stubMedia({ wide: true, reduced: false })
    render(<HorizontalTrack>{PANELS}</HorizontalTrack>)
    expect(screen.getByTestId('baseline')).toBeInTheDocument()
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('05')).toBeInTheDocument()
  })

  it('falls back to a vertical stack under reduced motion', () => {
    stubMedia({ wide: true, reduced: true })
    render(<HorizontalTrack>{PANELS}</HorizontalTrack>)
    expect(screen.queryByTestId('landing-track')).not.toBeInTheDocument()
    expect(screen.getByTestId('landing-stack')).toBeInTheDocument()
    expect(screen.getByText('P5')).toBeInTheDocument()
  })

  it('falls back to a vertical stack on narrow viewports', () => {
    stubMedia({ wide: false, reduced: false })
    render(<HorizontalTrack>{PANELS}</HorizontalTrack>)
    expect(screen.getByTestId('landing-stack')).toBeInTheDocument()
  })
})
