import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SettingsShell from './settings-shell'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}))

const sections = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  { id: 'billing', label: 'Billing' },
]

describe('SettingsShell', () => {
  it('renders a nav link for each section', () => {
    render(
      <SettingsShell sections={sections} active="security">
        <div>content</div>
      </SettingsShell>,
    )
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Security' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Billing' })).toBeInTheDocument()
  })

  it('marks the active section with aria-current', () => {
    render(
      <SettingsShell sections={sections} active="security">
        <div>content</div>
      </SettingsShell>,
    )
    expect(screen.getByRole('link', { name: 'Security' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Profile' })).not.toHaveAttribute('aria-current')
  })

  it('renders the content column', () => {
    render(
      <SettingsShell sections={sections} active="profile">
        <div>my settings content</div>
      </SettingsShell>,
    )
    expect(screen.getByText('my settings content')).toBeInTheDocument()
  })

  it('gives the active section a subtle primary accent (clean, no ink border)', () => {
    render(
      <SettingsShell sections={sections} active="security">
        <div>content</div>
      </SettingsShell>,
    )
    const active = screen.getByRole('link', { name: 'Security' })
    // Clean Airbnb: soft primary fill + weight, no ink border ring.
    expect(active.className).toMatch(/bg-primary\/10/)
    expect(active.className).toMatch(/text-primary/)
    expect(active.className).toMatch(/font-semibold/)
    expect(active.className).not.toMatch(/border-border-ink/)
  })

  it('separates the two columns with a light rule on desktop', () => {
    render(
      <SettingsShell sections={sections} active="profile">
        <div>content</div>
      </SettingsShell>,
    )
    const nav = screen.getByRole('navigation', { name: /settings sections/i })
    // Clean Airbnb: a single light divider between the columns on desktop.
    expect(nav.className).toMatch(/md:border-r/)
    expect(nav.className).toMatch(/md:border-border\b/)
    expect(nav.className).not.toMatch(/border-border-ink/)
  })

  // PR-15: sign out must be reachable from settings, for every role.
  it('renders a sign out control', () => {
    render(
      <SettingsShell sections={sections} active="profile">
        <div>content</div>
      </SettingsShell>,
    )
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })
})
