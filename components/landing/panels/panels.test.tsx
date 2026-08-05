import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import HeroPanel from './hero-panel'
import MarketPanel from './market-panel'
import WhatWeDoPanel from './what-we-do-panel'
import RolesPanel from './roles-panel'
import BuildPanel from './build-panel'

describe('landing panels', () => {
  it('hero carries the hook, CTAs and mono label', () => {
    render(<HeroPanel />)
    expect(screen.getByText(/The podium/)).toBeInTheDocument()
    expect(screen.getByText('SPONSORSHIP MARKETPLACE')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Get on the podium' })).toHaveAttribute('href', '/role-select')
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '#what-we-do')
  })

  it('market panel renders the chosen variant', () => {
    render(<MarketPanel variant="skyline" />)
    expect(screen.getByRole('group', { name: 'Filter profiles' })).toBeInTheDocument()
  })

  it('what-we-do carries the three slabs in order', () => {
    render(<WhatWeDoPanel />)
    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(items[0]).toContain('Build your profile')
    expect(items[1]).toContain('Get discovered')
    expect(items[2]).toContain('Sign and get paid')
  })

  it('roles panel names all three audiences', () => {
    render(<RolesPanel />)
    for (const name of ['Athletes', 'Teams & clubs', 'Brands']) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
  })

  it('build panel closes with the profile CTA and footer links, no FAQ', () => {
    render(<BuildPanel />)
    expect(screen.getByRole('link', { name: 'Build your profile' })).toHaveAttribute('href', '/role-select')
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing')
    expect(screen.getByRole('link', { name: 'Terms' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Privacy' })).toBeInTheDocument()
    expect(screen.queryByText(/FAQ/i)).not.toBeInTheDocument()
  })
})
