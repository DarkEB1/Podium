import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Home from './page'

vi.stubGlobal('matchMedia', (q: string) => ({
  matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {},
}))

async function renderHome(market?: string) {
  const ui = await Home({ searchParams: Promise.resolve(market ? { market } : {}) })
  render(ui)
}

describe('landing page', () => {
  it('renders all five panels in order', async () => {
    await renderHome()
    const headings = screen.getAllByRole('heading').map((h) => h.textContent)
    expect(headings[0]).toContain('The podium has room for')
    expect(headings[1]).toContain('The marketplace')
    expect(headings[2]).toContain('Three steps up')
    expect(headings[3]).toContain('Who’s on the podium')
    expect(headings[4]).toContain('Your spot is open.')
  })

  it('defaults to the skyline market variant', async () => {
    await renderHome()
    expect(screen.getByRole('group', { name: 'Filter profiles' })).toBeInTheDocument()
  })

  it('serves the rally variant on ?market=rally', async () => {
    await renderHome('rally')
    expect(screen.getByText('Vantage Gear')).toBeInTheDocument()
  })

  it('has no FAQ content', async () => {
    await renderHome()
    expect(screen.queryByText(/frequently asked/i)).not.toBeInTheDocument()
  })
})
