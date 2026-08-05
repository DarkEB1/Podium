import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import MarketSkyline from './market-skyline'
import { MARKET_PROFILES } from '@/lib/landing/market-fixtures'

describe('MarketSkyline', () => {
  it('renders one bar per profile', () => {
    render(<MarketSkyline />)
    expect(screen.getAllByRole('listitem')).toHaveLength(MARKET_PROFILES.length)
  })

  it('expands the focused profile into a card with its mono stat line', async () => {
    render(<MarketSkyline />)
    await userEvent.click(screen.getByRole('button', { name: /Rita Silva/ }))
    expect(screen.getByText('TENNIS · U21 · 22 DEALS')).toBeInTheDocument()
  })

  it('filters the skyline by sport chips', async () => {
    render(<MarketSkyline />)
    await userEvent.click(screen.getByRole('button', { name: 'Tennis' }))
    const tennis = MARKET_PROFILES.filter((p) => p.sport === 'Tennis')
    expect(screen.getAllByRole('listitem')).toHaveLength(tennis.length)
  })

  it('filters teams as a kind, not a sport', async () => {
    render(<MarketSkyline />)
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))
    const teams = MARKET_PROFILES.filter((p) => p.kind === 'team')
    expect(screen.getAllByRole('listitem')).toHaveLength(teams.length)
  })
})
