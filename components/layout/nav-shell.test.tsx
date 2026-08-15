import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import NavShell from './nav-shell'
import { BreadcrumbLabel } from './breadcrumb-label'

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
    // H3: the soft primary fill is now a shared-layout indicator element
    // (Framer `layoutId`) rendered only inside the active item, so it can slide
    // between items — the tint is on that child span, not the link className.
    expect(active.querySelector('.bg-primary\\/10')).not.toBeNull()
    expect(active.className).toMatch(/text-primary/)
    expect(active.className).toMatch(/font-semibold/)
    expect(active.className).not.toMatch(/border-border-ink/)
    const inactive = within(primary).getByRole('link', { name: 'Requests' })
    expect(inactive.className).not.toMatch(/bg-primary\/10/)
    expect(inactive.querySelector('.bg-primary\\/10')).toBeNull()
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

  // DASH1: the wordmark previously linked to the first nav item (Discover),
  // orphaning the dashboard. It now points at the role's dashboard home.
  it('links the wordmark to the role dashboard, not the first nav item', () => {
    render(
      <NavShell role="athlete">
        <div>page</div>
      </NavShell>,
    )
    expect(screen.getByRole('link', { name: /podium/i })).toHaveAttribute(
      'href',
      '/athlete/dashboard',
    )
  })

  // DASH1b: the header CTA lands on /athlete/settings, so it is labelled
  // "Settings" — not "Edit Profile", which collided with the public "Profile"
  // nav item.
  it('labels the header CTA "Settings" and points it at settings', () => {
    render(
      <NavShell role="athlete">
        <div>page</div>
      </NavShell>,
    )
    const settings = screen.getByRole('link', { name: 'Settings' })
    expect(settings).toHaveAttribute('href', '/athlete/settings')
    expect(screen.queryByRole('link', { name: /edit profile/i })).toBeNull()
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

  // A dynamic route's last segment can be an opaque id; the page names the
  // final crumb through the BreadcrumbLabel island instead.
  it('lets a page rename the final breadcrumb via BreadcrumbLabel', () => {
    render(
      <NavShell role="athlete">
        <BreadcrumbLabel label="Sarah Okoro" />
      </NavShell>,
    )
    const crumbs = screen.getByRole('navigation', { name: /breadcrumb/i })
    expect(within(crumbs).getByText('Sarah Okoro')).toBeInTheDocument()
    expect(within(crumbs).queryByText('Discover')).not.toBeInTheDocument()
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
