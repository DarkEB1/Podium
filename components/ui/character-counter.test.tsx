import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CharacterCounter } from './character-counter'

describe('CharacterCounter', () => {
  it('renders the live count in "n/max characters" form', () => {
    render(<CharacterCounter value="hello" max={600} />)
    expect(screen.getByText('5/600 characters')).toBeInTheDocument()
  })

  it('counts an empty string as 0', () => {
    render(<CharacterCounter value="" max={100} />)
    expect(screen.getByText('0/100 characters')).toBeInTheDocument()
  })

  it('uses string length (code units) for the count', () => {
    render(<CharacterCounter value="abcde fghij" max={20} />)
    expect(screen.getByText('11/20 characters')).toBeInTheDocument()
  })

  it('flags an over-limit value as destructive for a non-colour-alone cue', () => {
    render(<CharacterCounter value="abcdef" max={3} />)
    const counter = screen.getByText('6/3 characters')
    expect(counter.className).toMatch(/destructive/)
    expect(counter).toHaveAttribute('aria-live', 'polite')
  })

  it('is not destructive while within the limit', () => {
    render(<CharacterCounter value="ab" max={3} />)
    const counter = screen.getByText('2/3 characters')
    expect(counter.className).not.toMatch(/destructive/)
  })
})
