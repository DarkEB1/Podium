import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import MarketRally from './market-rally'
import { RETURNS_TO_SIGN } from '@/lib/landing/rally-engine'

afterEach(() => vi.unstubAllGlobals())

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion') ? matches : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

describe('MarketRally', () => {
  it('renders the first pair and an unsigned ticker', () => {
    stubReducedMotion(false)
    render(<MarketRally />)
    expect(screen.getByText('Rita Silva')).toBeInTheDocument()
    expect(screen.getByText('Vantage Gear')).toBeInTheDocument()
    expect(screen.getByText(/RALLY 0 · OFFER £400/)).toBeInTheDocument()
  })

  it('advances the ticker per return and stamps SIGNED after five', async () => {
    stubReducedMotion(false)
    render(<MarketRally />)
    const court = screen.getByTestId('rally-court')
    for (let i = 0; i < RETURNS_TO_SIGN; i++) await userEvent.click(court)
    expect(screen.getByText(/SIGNED · £1,650/)).toBeInTheDocument()
  })

  it('serves the next pair after a signed rally is clicked again', async () => {
    stubReducedMotion(false)
    render(<MarketRally />)
    const court = screen.getByTestId('rally-court')
    for (let i = 0; i < RETURNS_TO_SIGN + 1; i++) await userEvent.click(court)
    expect(screen.getByText('Joe Okafor')).toBeInTheDocument()
    expect(screen.getByText(/RALLY 0 · OFFER £650/)).toBeInTheDocument()
  })

  it('keeps the card names out of the labelled court button, but present on the page', () => {
    stubReducedMotion(false)
    render(<MarketRally />)
    expect(within(screen.getByTestId('rally-court')).queryByText('Rita Silva')).toBeNull()
    expect(screen.getByText('Rita Silva')).toBeInTheDocument()
  })

  it('renders the static storyboard under reduced motion', () => {
    stubReducedMotion(true)
    render(<MarketRally />)
    expect(screen.getByTestId('rally-storyboard')).toBeInTheDocument()
    expect(screen.queryByTestId('rally-court')).not.toBeInTheDocument()
  })

  it('derives the storyboard\'s final frame from the engine (SIGNED)', () => {
    stubReducedMotion(true)
    render(<MarketRally />)
    const lines = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(lines[lines.length - 1]).toMatch(/^SIGNED ·/)
  })
})
