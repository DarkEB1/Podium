import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import ProfileSeeking from './profile-seeking'

describe('ProfileSeeking', () => {
  it('renders humanised seeking pills', () => {
    render(<ProfileSeeking seeking={['paid_partnership', 'product_gifting']} />)
    expect(screen.getByText('Paid partnership')).toBeInTheDocument()
    expect(screen.getByText('Product gifting')).toBeInTheDocument()
  })

  // PROF10: the pills are framed by a "What <name> is looking for" intro.
  it('renders a named intro above the pills', () => {
    render(<ProfileSeeking seeking={['paid_partnership']} name="Jane Doe" />)
    expect(screen.getByText('What Jane Doe is looking for')).toBeInTheDocument()
  })

  // PROF10: enum jargon becomes a readable label with a tooltip description,
  // e.g. "university_nil_collective" is NOT shown as "University nil collective".
  it('renders a canonical label and a tooltip description per category', () => {
    render(<ProfileSeeking seeking={['university_nil_collective']} />)
    expect(screen.getByText('University / NIL collective')).toBeInTheDocument()
    expect(screen.queryByText('University nil collective')).not.toBeInTheDocument()
    const item = screen.getByText('University / NIL collective').closest('li')
    expect(item).toHaveAttribute(
      'title',
      'Name, image and likeness deals through a college collective.',
    )
  })

  it('shows neutral open-to-opportunities copy for an empty list (default isSeeking=true)', () => {
    render(<ProfileSeeking seeking={[]} />)
    expect(screen.getByText(/open to opportunities/i)).toBeInTheDocument()
    // Visitors get no settings link.
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('shows the not-seeking line when isSeeking is false', () => {
    render(<ProfileSeeking seeking={['paid_partnership']} isSeeking={false} />)
    expect(screen.getByText(/not currently seeking opportunities/i)).toBeInTheDocument()
    expect(screen.queryByText('Paid partnership')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('gives the owner a settings link to turn seeking back on', () => {
    render(<ProfileSeeking seeking={[]} isSeeking={false} isOwner />)
    const link = screen.getByRole('link', { name: /turn seeking back on/i })
    expect(link).toHaveAttribute('href', '/athlete/settings#visibility')
  })

  it('gives the owner a settings link to pick interests when open but empty', () => {
    render(<ProfileSeeking seeking={[]} isOwner />)
    const link = screen.getByRole('link', { name: /pick what you.re seeking/i })
    expect(link).toHaveAttribute('href', '/athlete/settings#visibility')
  })
})
