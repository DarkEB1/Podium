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
    expect(screen.getByRole('img', { name: /Jane Doe cover/i })).toHaveAttribute('src', '/cover.jpg')
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

  it('shows an em dash for missing stats rather than blank', () => {
    render(<ProfileStatStrip followers={null} engagement={null} sport={null} level={null} />)
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4)
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

  it('renders an empty state when no socials are connected', () => {
    render(<ProfileSocialStrip accounts={{}} />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.getByText(/no social accounts/i)).toBeInTheDocument()
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

  it('renders an empty state when nothing is sought', () => {
    render(<ProfileSeeking seeking={[]} />)
    expect(screen.getByText(/not currently seeking/i)).toBeInTheDocument()
  })
})
