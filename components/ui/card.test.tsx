import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from './card'

describe('Card', () => {
  it('renders children and exposes the card slot', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Acme deal</CardTitle>
          <CardDescription>National sponsorship</CardDescription>
          <CardAction>
            <button type="button">More</button>
          </CardAction>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    )
    expect(screen.getByText('Acme deal')).toBeInTheDocument()
    expect(screen.getByText('National sponsorship')).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
    expect(screen.getByText('Footer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument()
  })

  it('honours the size variant via data-size', () => {
    const { container } = render(<Card size="sm">x</Card>)
    const card = container.querySelector('[data-slot="card"]') as HTMLElement
    expect(card.getAttribute('data-size')).toBe('sm')
  })

  it('carries the clean airbnb surface: light border, soft shadow, rounded-2xl (C3)', () => {
    const { container } = render(<Card>x</Card>)
    const card = container.querySelector('[data-slot="card"]') as HTMLElement
    // light single border, not the heavy ink border
    expect(card.className).toMatch(/\bborder\b/)
    expect(card.className).toMatch(/border-border\b/)
    expect(card.className).not.toMatch(/border-border-ink/)
    // soft card shadow token (now soft, see globals.css §1)
    expect(card.className).toMatch(/\bshadow-card\b/)
    // generous rounded corners
    expect(card.className).toMatch(/rounded-2xl/)
  })

  it('forwards className and arbitrary props', () => {
    const { container } = render(
      <Card className="custom-class" data-foo="bar">
        x
      </Card>
    )
    const card = container.querySelector('[data-slot="card"]') as HTMLElement
    expect(card.className).toMatch(/custom-class/)
    expect(card.getAttribute('data-foo')).toBe('bar')
  })
})
