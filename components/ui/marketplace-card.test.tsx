import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MarketplaceCard } from './marketplace-card'

const baseProps = {
  image: '/athlete.jpg',
  imageAlt: 'Jane Doe sprinting',
  title: 'Jane Doe',
}

describe('MarketplaceCard', () => {
  it('renders image with the provided alt text', () => {
    render(<MarketplaceCard {...baseProps} cta={{ label: 'View', href: '/a/1' }} />)
    const img = screen.getByAltText('Jane Doe sprinting')
    expect(img).toBeInTheDocument()
    expect(img.getAttribute('src')).toBe('/athlete.jpg')
  })

  it('renders title and subtitle', () => {
    render(
      <MarketplaceCard
        {...baseProps}
        subtitle="Sprinter · National"
        cta={{ label: 'View', href: '/a/1' }}
      />
    )
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Sprinter · National')).toBeInTheDocument()
  })

  it('renders the single stat label and value', () => {
    render(
      <MarketplaceCard
        {...baseProps}
        stat={{ label: 'Followers', value: '12.4k' }}
        cta={{ label: 'View', href: '/a/1' }}
      />
    )
    expect(screen.getByText('Followers')).toBeInTheDocument()
    expect(screen.getByText('12.4k')).toBeInTheDocument()
  })

  it('renders tags and overlay badges slots', () => {
    render(
      <MarketplaceCard
        {...baseProps}
        tags={<span>Track</span>}
        overlayBadges={<span>Verified</span>}
        cta={{ label: 'View', href: '/a/1' }}
      />
    )
    expect(screen.getByText('Track')).toBeInTheDocument()
    expect(screen.getByText('Verified')).toBeInTheDocument()
  })

  it('renders the CTA as a link when href is given', () => {
    render(<MarketplaceCard {...baseProps} cta={{ label: 'View profile', href: '/a/1' }} />)
    const cta = screen.getByRole('link', { name: 'View profile' })
    expect(cta).toHaveAttribute('href', '/a/1')
  })

  it('renders the CTA as a button and fires onClick', () => {
    const onClick = vi.fn()
    render(<MarketplaceCard {...baseProps} cta={{ label: 'Save', onClick }} />)
    const cta = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(cta)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders an accessible save toggle reflecting saved state and fires onToggleSave', () => {
    const onToggleSave = vi.fn()
    render(
      <MarketplaceCard
        {...baseProps}
        saved
        onToggleSave={onToggleSave}
        cta={{ label: 'View', href: '/a/1' }}
      />
    )
    const save = screen.getByRole('button', { name: /unsave|remove from saved/i })
    expect(save).toHaveAttribute('aria-pressed', 'true')
    expect(save.querySelector('svg')).not.toBeNull()
    fireEvent.click(save)
    expect(onToggleSave).toHaveBeenCalledTimes(1)
  })

  it('shows a "save" label when not saved', () => {
    render(
      <MarketplaceCard
        {...baseProps}
        saved={false}
        onToggleSave={() => {}}
        cta={{ label: 'View', href: '/a/1' }}
      />
    )
    const save = screen.getByRole('button', { name: /^save|add to saved/i })
    expect(save).toHaveAttribute('aria-pressed', 'false')
  })

  it('omits the save toggle when no onToggleSave handler is provided', () => {
    render(<MarketplaceCard {...baseProps} cta={{ label: 'View', href: '/a/1' }} />)
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
  })

  it('wraps the card in a link when a card-level href is given', () => {
    render(<MarketplaceCard {...baseProps} href="/a/1" cta={{ label: 'View', onClick: () => {} }} />)
    const cardLink = screen.getByRole('link', { name: /jane doe/i })
    expect(cardLink).toHaveAttribute('href', '/a/1')
  })

  it('applies the default 60% image ratio and honours a custom ratio', () => {
    const { rerender } = render(
      <MarketplaceCard {...baseProps} cta={{ label: 'View', href: '/a/1' }} />
    )
    const figure = screen.getByAltText('Jane Doe sprinting').parentElement as HTMLElement
    expect(figure.style.aspectRatio).toBe('0.6')

    rerender(<MarketplaceCard {...baseProps} imageRatio={0.7} cta={{ label: 'View', href: '/a/1' }} />)
    const figure2 = screen.getByAltText('Jane Doe sprinting').parentElement as HTMLElement
    expect(figure2.style.aspectRatio).toBe('0.7')
  })

  it('carries the neo-brutalist ink border + hard shadow + liftable hover utility (plan §6/§7)', () => {
    render(<MarketplaceCard {...baseProps} cta={{ label: 'View', href: '/a/1' }} />)
    const card = screen.getByTestId('marketplace-card')
    // ink border
    expect(card.className).toMatch(/\bborder\b/)
    expect(card.className).toMatch(/border-border-ink/)
    // resting hard shadow token
    expect(card.className).toMatch(/\bshadow-card\b/)
    // hover lift handled by the .liftable utility (translate -2,-2 → shadow-card-hover,
    // reduced-motion shadow-only — defined once in globals.css §1.5)
    expect(card.className).toMatch(/\bliftable\b/)
  })

  it('renders a folded-corner featured tab when featured is set', () => {
    const { rerender } = render(
      <MarketplaceCard {...baseProps} cta={{ label: 'View', href: '/a/1' }} />
    )
    const plain = screen.getByTestId('marketplace-card')
    expect(plain.getAttribute('data-featured')).toBe('false')

    rerender(<MarketplaceCard {...baseProps} featured cta={{ label: 'View', href: '/a/1' }} />)
    const featured = screen.getByTestId('marketplace-card')
    expect(featured.getAttribute('data-featured')).toBe('true')
    // folded corner drawn via a CSS ::after on the card, toggled by a marker class
    expect(featured.className).toMatch(/marketplace-card--featured/)
  })

  it('keeps the CTA reachable when the card itself is a link (no nested interactive in card link)', () => {
    render(<MarketplaceCard {...baseProps} href="/a/1" cta={{ label: 'View', href: '/a/1/view' }} />)
    const card = screen.getByTestId('marketplace-card')
    const cta = within(card).getByRole('link', { name: 'View' })
    expect(cta).toHaveAttribute('href', '/a/1/view')
  })
})
