import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import NavShell from './nav-shell'

vi.mock('next/navigation', () => ({
  usePathname: () => '/athlete/discover',
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
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
    expect(within(primary).getByRole('link', { name: 'Requests' })).toBeInTheDocument()
    expect(within(primary).getByRole('link', { name: 'Messages' })).toBeInTheDocument()
    expect(within(primary).getByRole('link', { name: 'Profile' })).toBeInTheDocument()
  })

  // B-6 / UX-2: the requests destination was labelled "Listings", so athletes
  // had no discoverable path to accept connection requests.
  it('labels the athlete requests destination "Requests" and links to it', () => {
    render(
      <NavShell role="athlete">
        <div>page</div>
      </NavShell>,
    )
    const primary = screen.getByRole('navigation', { name: /primary/i })
    expect(within(primary).getByRole('link', { name: 'Requests' })).toHaveAttribute(
      'href',
      '/athlete/requests',
    )
  })

  // PR-15: sign out was missing entirely.
  it('renders a sign out control for every role', () => {
    for (const role of ['athlete', 'brand', 'team', 'agent'] as const) {
      const { unmount } = render(
        <NavShell role={role}>
          <div>page</div>
        </NavShell>,
      )
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
      unmount()
    }
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

  it('gives the active top-level item a subtle primary accent (clean, no ink border)', () => {
    render(
      <NavShell role="athlete">
        <div>page</div>
      </NavShell>,
    )
    const primary = screen.getByRole('navigation', { name: /primary/i })
    const active = within(primary).getByRole('link', { name: 'Discover' })
    // Clean Airbnb: a soft primary fill + weight carry the active state; aria-current
    // keeps it from being colour-alone. No heavy ink border.
    expect(active.className).toMatch(/bg-primary\/10/)
    expect(active.className).toMatch(/text-primary/)
    expect(active.className).toMatch(/font-semibold/)
    expect(active.className).not.toMatch(/border-border-ink/)
    const inactive = within(primary).getByRole('link', { name: 'Requests' })
    expect(inactive.className).not.toMatch(/bg-primary\/10/)
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

  it('renders a mobile bottom navigation with a light top divider', () => {
    render(
      <NavShell role="athlete">
        <div>page</div>
      </NavShell>,
    )
    const bottom = screen.getByRole('navigation', { name: /bottom/i })
    expect(bottom).toBeInTheDocument()
    // Clean Airbnb: a single light divider, not a heavy ink border.
    expect(bottom.className).toMatch(/border-t/)
    expect(bottom.className).not.toMatch(/border-border-ink/)
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
