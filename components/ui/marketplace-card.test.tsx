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
    // A-2: routed through next/image (lazy + intrinsic sizing), so the src is
    // the optimizer URL carrying the original asset.
    expect(img.getAttribute('src')).toContain('athlete.jpg')
    expect(img.getAttribute('loading')).toBe('lazy')
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

  it('carries the clean airbnb surface: light border, soft shadow, rounded-2xl + gentle liftable hover (C3)', () => {
    render(<MarketplaceCard {...baseProps} cta={{ label: 'View', href: '/a/1' }} />)
    const card = screen.getByTestId('marketplace-card')
    // light single border, not the heavy ink border
    expect(card.className).toMatch(/\bborder\b/)
    expect(card.className).toMatch(/border-border\b/)
    expect(card.className).not.toMatch(/border-border-ink/)
    // soft resting shadow token (now soft, see globals.css §1)
    expect(card.className).toMatch(/\bshadow-card\b/)
    // generous rounded corners
    expect(card.className).toMatch(/rounded-2xl/)
    // gentle hover lift handled by the .liftable utility (translateY(-2px) → soft shadow,
    // reduced-motion shadow-only — defined once in globals.css §1.5)
    expect(card.className).toMatch(/\bliftable\b/)
  })

  it('renders a clean soft featured ribbon when featured is set, upright with no hard shadow/rotation', () => {
    const { rerender } = render(
      <MarketplaceCard {...baseProps} cta={{ label: 'View', href: '/a/1' }} />
    )
    const plain = screen.getByTestId('marketplace-card')
    expect(plain.getAttribute('data-featured')).toBe('false')
    expect(screen.queryByText(/featured/i)).toBeNull()

    rerender(<MarketplaceCard {...baseProps} featured cta={{ label: 'View', href: '/a/1' }} />)
    const featured = screen.getByTestId('marketplace-card')
    expect(featured.getAttribute('data-featured')).toBe('true')
    // marker class retained for styling hooks
    expect(featured.className).toMatch(/marketplace-card--featured/)
    // soft clean pill/ribbon rendered as a real element (not a hard CSS triangle)
    const ribbon = screen.getByText(/featured/i)
    expect(ribbon).toBeInTheDocument()
    // upright + flat: no rotation, no hard offset shadow on the ribbon
    expect(ribbon.className).not.toMatch(/rotate-/)
    expect(ribbon.className).not.toMatch(/shadow-\[/)
  })

  it('keeps the CTA reachable when the card itself is a link (no nested interactive in card link)', () => {
    render(<MarketplaceCard {...baseProps} href="/a/1" cta={{ label: 'View', href: '/a/1/view' }} />)
    const card = screen.getByTestId('marketplace-card')
    const cta = within(card).getByRole('link', { name: 'View' })
    expect(cta).toHaveAttribute('href', '/a/1/view')
  })
})


describe('MarketplaceCard image (A-2)', () => {
  it('renders a next/image, never a raw <img> with an unoptimised src', () => {
    render(<MarketplaceCard {...baseProps} cta={{ label: 'View', href: '/a/1' }} />)
    const img = screen.getByAltText('Jane Doe sprinting') as HTMLImageElement
    // next/image always emits a srcset + a sizes hint; a raw <img> would not.
    expect(img.getAttribute('srcset')).toBeTruthy()
    expect(img.getAttribute('sizes')).toBeTruthy()
  })

  it('reserves the image footprint before load so nothing shifts (CLS)', () => {
    render(<MarketplaceCard {...baseProps} cta={{ label: 'View', href: '/a/1' }} />)
    const figure = screen.getByAltText('Jane Doe sprinting').parentElement as HTMLElement
    expect(figure.style.aspectRatio).toBe('0.6')
  })

  it('falls back to the on-brand placeholder when no image is supplied (B-5)', () => {
    render(<MarketplaceCard {...baseProps} image="" cta={{ label: 'View', href: '/a/1' }} />)
    const img = screen.getByAltText('Jane Doe sprinting')
    expect(img.getAttribute('src')).toContain('placeholder-athlete.svg')
  })
})

describe('MarketplaceCard layout (PR-5 / UX-3)', () => {
  it('orders photo, then name, then seeking, then availability', () => {
    render(
      <MarketplaceCard
        {...baseProps}
        seeking="Kit + travel sponsorship"
        availability="Available from March 2026"
        cta={{ label: 'View', href: '/a/1' }}
      />
    )
    const card = screen.getByTestId('marketplace-card')
    const html = card.innerHTML
    const iImage = html.indexOf('Jane Doe sprinting')
    const iName = html.indexOf('>Jane Doe<')
    const iSeeking = html.indexOf('Kit + travel sponsorship')
    const iAvail = html.indexOf('Available from March 2026')
    expect(iImage).toBeGreaterThan(-1)
    expect(iName).toBeGreaterThan(iImage)
    expect(iSeeking).toBeGreaterThan(iName)
    expect(iAvail).toBeGreaterThan(iSeeking)
  })

  it('labels the seeking and availability rows for screen readers', () => {
    render(
      <MarketplaceCard
        {...baseProps}
        seeking="Kit sponsorship"
        availability="Open now"
        cta={{ label: 'View', href: '/a/1' }}
      />
    )
    expect(screen.getByText('Seeking:')).toBeInTheDocument()
    expect(screen.getByText('Availability:')).toBeInTheDocument()
  })

  it('stays backwards compatible: omits the new rows when the props are absent', () => {
    render(<MarketplaceCard {...baseProps} cta={{ label: 'View', href: '/a/1' }} />)
    const card = screen.getByTestId('marketplace-card')
    expect(card.querySelector('[data-slot="marketplace-card-seeking"]')).toBeNull()
    expect(card.querySelector('[data-slot="marketplace-card-availability"]')).toBeNull()
  })
})
