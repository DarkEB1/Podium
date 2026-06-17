import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import FAQ from './faq'

describe('FAQ (C19 clean Airbnb restyle)', () => {
  it('renders the section, heading, all Q&As and the CTA', () => {
    render(<FAQ />)

    expect(screen.getByRole('heading', { name: /questions\? we've got answers/i })).toBeInTheDocument()

    // every question is present
    expect(screen.getByText(/is it really free for athletes and teams\?/i)).toBeInTheDocument()
    expect(screen.getByText(/how do brands find me\?/i)).toBeInTheDocument()
    expect(screen.getByText(/how do payments work\?/i)).toBeInTheDocument()
    expect(screen.getByText(/do i need an agent\?/i)).toBeInTheDocument()
    expect(screen.getByText(/what sports are supported\?/i)).toBeInTheDocument()
    expect(screen.getByText(/how do i get verified\?/i)).toBeInTheDocument()

    // CTA preserved
    const cta = screen.getByRole('link', { name: /get started free/i })
    expect(cta).toHaveAttribute('href', '/auth/signup')

    // energetic microcopy preserved
    expect(screen.getByText(/still curious\? the best way to learn is to dive in\./i)).toBeInTheDocument()
  })

  it('uses clean Airbnb styling — no brutalist ink borders, hard offset shadows, or rotations', () => {
    const { container } = render(<FAQ />)
    const html = container.innerHTML

    // no heavy ink borders
    expect(html).not.toMatch(/border-\[1\.5px\]/)
    expect(html).not.toMatch(/border-foreground/)
    // no hard offset shadows
    expect(html).not.toMatch(/shadow-\[\d/)
    // no rotations / sticker tilts
    expect(html).not.toMatch(/-?rotate-/)
  })

  it('uses soft cards and gentle motion that respects reduced-motion', () => {
    const { container } = render(<FAQ />)
    const html = container.innerHTML

    // soft layered card shadow token
    expect(html).toMatch(/shadow-card/)
    // light hairline border
    expect(html).toMatch(/border-border/)
    // generous rounded corners
    expect(html).toMatch(/rounded-(xl|2xl)/)
    // reduced-motion guard present on the interactive item
    expect(html).toMatch(/motion-reduce:/)
  })

  it('keeps Lucide toggle icons (plus/minus) and the Bricolage heading font', () => {
    const { container } = render(<FAQ />)
    // toggle icons render as svg
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0)
    // heading font utility retained
    expect(container.innerHTML).toMatch(/font-heading/)
  })
})
