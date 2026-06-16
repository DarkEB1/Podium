import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SettingsShell from './settings-shell'

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
})
