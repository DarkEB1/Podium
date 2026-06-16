import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import NavShell from './nav-shell'

vi.mock('next/navigation', () => ({
  usePathname: () => '/athlete/discover',
}))

vi.mock('./notification-bell', () => ({ default: () => <div data-testid="bell" /> }))
vi.mock('./theme-toggle', () => ({ default: () => <div data-testid="theme" /> }))

describe('NavShell', () => {
  it('renders the four top-level nav items', () => {
    render(
      <NavShell role="athlete">
        <div>page</div>
      </NavShell>,
    )
    const primary = screen.getByRole('navigation', { name: /primary/i })
    expect(within(primary).getByRole('link', { name: 'Discover' })).toBeInTheDocument()
    expect(within(primary).getByRole('link', { name: 'Listings' })).toBeInTheDocument()
    expect(within(primary).getByRole('link', { name: 'Messages' })).toBeInTheDocument()
    expect(within(primary).getByRole('link', { name: 'Profile' })).toBeInTheDocument()
  })

  it('marks the active top-level item with aria-current', () => {
    render(
      <NavShell role="athlete">
        <div>page</div>
      </NavShell>,
    )
    const primary = screen.getByRole('navigation', { name: /primary/i })
    expect(within(primary).getByRole('link', { name: 'Discover' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('renders a persistent role-appropriate top-right CTA', () => {
    render(
      <NavShell role="brand">
        <div>page</div>
      </NavShell>,
    )
    // Brand CTA is "Post a Listing"
    expect(screen.getByRole('link', { name: /post a listing/i })).toBeInTheDocument()
  })

  it('renders a mobile bottom navigation', () => {
    render(
      <NavShell role="athlete">
        <div>page</div>
      </NavShell>,
    )
    expect(screen.getByRole('navigation', { name: /bottom/i })).toBeInTheDocument()
  })

  it('renders breadcrumbs derived from the pathname', () => {
    render(
      <NavShell role="athlete">
        <div>page</div>
      </NavShell>,
    )
    const crumbs = screen.getByRole('navigation', { name: /breadcrumb/i })
    expect(within(crumbs).getByText(/discover/i)).toBeInTheDocument()
  })

  it('renders children', () => {
    render(
      <NavShell role="athlete">
        <div>my page content</div>
      </NavShell>,
    )
    expect(screen.getByText('my page content')).toBeInTheDocument()
  })
})
