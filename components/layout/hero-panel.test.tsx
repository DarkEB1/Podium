import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import HeroPanel from './hero-panel'

describe('HeroPanel', () => {
  it('renders a full-bleed image with alt text', () => {
    render(
      <HeroPanel image="/cover.jpg" alt="Stadium at sunset">
        <h1>Jane Doe</h1>
      </HeroPanel>,
    )
    const img = screen.getByRole('img', { name: 'Stadium at sunset' })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/cover.jpg')
  })

  it('renders floating panel children', () => {
    render(
      <HeroPanel image="/cover.jpg" alt="cover">
        <h1>Jane Doe</h1>
      </HeroPanel>,
    )
    expect(screen.getByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument()
  })

  it('gives the floating panel a soft shadow, large radius and light border', () => {
    render(
      <HeroPanel image="/cover.jpg" alt="cover">
        <h1 data-testid="title">Jane Doe</h1>
      </HeroPanel>,
    )
    // The floating panel is the parent of the children wrapper.
    const panel = screen.getByTestId('title').parentElement as HTMLElement
    // Clean Airbnb: soft card shadow, generous rounded corners, single light border.
    expect(panel.className).toMatch(/shadow-\[var\(--shadow-card\)\]/)
    expect(panel.className).toMatch(/rounded-2xl/)
    expect(panel.className).toMatch(/border-border\b/)
    expect(panel.className).not.toMatch(/border-border-ink/)
  })
})
