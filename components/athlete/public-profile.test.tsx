import { render, screen, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import ProfileHero from './profile-hero'
import ProfileStatStrip from './profile-stat-strip'
import ProfileGallery from './profile-gallery'
import ProfileSocialStrip from './profile-social-strip'
import ProfileSeeking from './profile-seeking'

describe('ProfileHero', () => {
  it('renders the cover image, name, tagline and verified badge', () => {
    render(
      <ProfileHero
        coverImage="/cover.jpg"
        name="Jane Doe"
        tagline="Sprinter · National"
        location="London, GB"
        verified
        availability={{ status: 'available_now' }}
      />,
    )
    // A-2: next/image rewrites src through the optimizer
    // (/_next/image?url=<encoded>&w=…), so assert the ORIGINAL source is
    // still what gets requested rather than pinning the exact rewritten URL.
    expect(
      screen.getByRole('img', { name: /Jane Doe cover/i }).getAttribute('src') ?? ''
    ).toContain(encodeURIComponent('/cover.jpg'))
    expect(screen.getByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument()
    expect(screen.getByText('Sprinter · National')).toBeInTheDocument()
    expect(screen.getByText('London, GB')).toBeInTheDocument()
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.getByText('Available now')).toBeInTheDocument()
  })

  it('falls back to a designed placeholder when no cover image is provided', () => {
    render(<ProfileHero coverImage={null} name="No Cover" />)
    // No <img> should render; the placeholder region is labelled instead.
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No Cover' })).toBeInTheDocument()
  })

  // The square avatar used to be passed as coverImage and stretched across
  // the full-bleed band. It now renders as a circular avatar in the panel and
  // the band stays a designed placeholder.
  it('renders the avatar in the panel, not as the cover band', () => {
    render(<ProfileHero avatar="/avatar.jpg" name="Jane Doe" />)
    const avatar = screen.getByRole('img', { name: /Jane Doe profile photo/i })
    expect(avatar).toHaveAttribute('src', '/avatar.jpg')
    expect(avatar.className).toMatch(/rounded-full/)
    // Exactly one image: the avatar. No cover <img> exists.
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })
})

describe('ProfileStatStrip', () => {
  it('renders Followers, Engagement, Sport and Level tiles', () => {
    render(
      <ProfileStatStrip
        followers="12.4K"
        engagement="4.8%"
        sport="Athletics"
        level="National"
      />,
    )
    for (const label of ['Followers', 'Engagement', 'Sport', 'Level']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByText('12.4K')).toBeInTheDocument()
    expect(screen.getByText('4.8%')).toBeInTheDocument()
    expect(screen.getByText('Athletics')).toBeInTheDocument()
    expect(screen.getByText('National')).toBeInTheDocument()
  })

  it('labels missing sport and level rather than leaving a tile blank', () => {
    render(<ProfileStatStrip followers={null} engagement={null} sport={null} level={null} />)
    expect(screen.getAllByText('Not set')).toHaveLength(2)
  })

  // The visible dash for non-owners is decorative; screen readers still get a
  // meaningful value, keeping the earlier a11y fix intact.
  it('announces missing audience metrics as "Not provided" for non-owners', () => {
    render(<ProfileStatStrip followers={null} engagement={null} sport={null} level={null} />)
    expect(screen.getAllByText('Not provided')).toHaveLength(2)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  // Followers/engagement were permanently "Not set" because nothing wrote the
  // performance_stats keys — the owner now gets a way to fix it in place.
  it('gives the owner an "Add socials" link when audience metrics are missing', () => {
    render(
      <ProfileStatStrip
        followers={null}
        engagement={null}
        sport="Athletics"
        level="National"
        isOwner
        settingsHref="/athlete/settings#profile"
      />,
    )
    const links = screen.getAllByRole('link', { name: 'Add socials' })
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', '/athlete/settings#profile')
  })

  it('captions present audience metrics as self-reported', () => {
    render(
      <ProfileStatStrip
        followers="12.4K"
        engagement="4.8%"
        sport="Athletics"
        level="National"
      />,
    )
    expect(screen.getAllByText('Self-reported')).toHaveLength(2)
  })
})

describe('ProfileGallery', () => {
  it('renders one image per photo with descriptive alt text', () => {
    render(
      <ProfileGallery
        name="Jane Doe"
        photos={['/p1.jpg', '/p2.jpg', '/p3.jpg']}
      />,
    )
    const imgs = screen.getAllByRole('img')
    expect(imgs).toHaveLength(3)
    expect(imgs[0]).toHaveAttribute('alt', 'Jane Doe action photo 1')
  })

  it('renders a designed empty state when there are no photos', () => {
    render(<ProfileGallery name="Jane Doe" photos={[]} />)
    expect(screen.queryAllByRole('img')).toHaveLength(0)
    expect(screen.getByText(/no photos yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('gives the owner an inline "Add photos" action on the empty state', () => {
    render(
      <ProfileGallery
        name="Jane Doe"
        photos={[]}
        isOwner
        manageHref="/athlete/settings#profile"
      />,
    )
    expect(screen.getByRole('link', { name: 'Add photos' })).toHaveAttribute(
      'href',
      '/athlete/settings#profile',
    )
  })
})

describe('ProfileSocialStrip', () => {
  it('renders a link per connected platform and skips empty ones', () => {
    render(
      <ProfileSocialStrip
        accounts={{ instagram: 'https://instagram.com/jane', youtube: 'https://youtube.com/jane' }}
      />,
    )
    expect(screen.getByRole('link', { name: /instagram/i })).toHaveAttribute(
      'href',
      'https://instagram.com/jane',
    )
    expect(screen.getByRole('link', { name: /youtube/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /tiktok/i })).not.toBeInTheDocument()
  })

  // Storage now holds canonical handles; legacy rows hold full URLs. Both
  // must resolve to "@handle" plus an absolute profile URL.
  it('renders canonical handles and legacy URLs identically', () => {
    render(
      <ProfileSocialStrip
        accounts={{ instagram: 'jane', tiktok: 'https://www.tiktok.com/@jane' }}
      />,
    )
    const instagram = screen.getByRole('link', { name: /instagram/i })
    expect(instagram).toHaveAttribute('href', 'https://instagram.com/jane')
    expect(instagram).toHaveTextContent('@jane')
    const tiktok = screen.getByRole('link', { name: /tiktok/i })
    expect(tiktok).toHaveAttribute('href', 'https://tiktok.com/@jane')
    expect(tiktok).toHaveTextContent('@jane')
  })

  it('skips values that cannot be read as a handle', () => {
    render(<ProfileSocialStrip accounts={{ instagram: 'https://example.com/not-a-profile' }} />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('renders an empty state when no socials are connected', () => {
    render(<ProfileSocialStrip accounts={{}} />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.getByText(/no social accounts/i)).toBeInTheDocument()
  })

  it('gives the owner an inline "Connect social" action on the empty state', () => {
    render(
      <ProfileSocialStrip
        accounts={{}}
        isOwner
        connectHref="/athlete/settings#profile"
      />,
    )
    expect(screen.getByRole('link', { name: 'Connect social' })).toHaveAttribute(
      'href',
      '/athlete/settings#profile',
    )
  })
})

describe('ProfileSeeking', () => {
  it('renders a humanised tag per seeking value', () => {
    const { container } = render(
      <ProfileSeeking seeking={['paid_partnership', 'product_gifting']} />,
    )
    const region = within(container)
    expect(region.getByText('Paid partnership')).toBeInTheDocument()
    expect(region.getByText('Product gifting')).toBeInTheDocument()
  })

  it('renders the open-to-opportunities state when nothing is sought', () => {
    render(<ProfileSeeking seeking={[]} />)
    expect(screen.getByText(/open to opportunities/i)).toBeInTheDocument()
  })

  it('renders the not-seeking state when the toggle is off', () => {
    render(<ProfileSeeking seeking={[]} isSeeking={false} />)
    expect(screen.getByText(/not currently seeking/i)).toBeInTheDocument()
  })
})
