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
})
