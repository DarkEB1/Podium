import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { PageTransition } from './page-transition'

let pathname = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

function stubMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: reduced && query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  pathname = '/'
})

describe('PageTransition', () => {
  it('renders its children', () => {
    stubMatchMedia(false)
    render(
      <PageTransition>
        <p>route content</p>
      </PageTransition>,
    )
    expect(screen.getByText('route content')).toBeInTheDocument()
  })

  it('re-keys on pathname so a fresh enter animation runs per route', () => {
    stubMatchMedia(false)
    const { container, rerender } = render(
      <PageTransition>
        <p>a</p>
      </PageTransition>,
    )
    const first = container.firstElementChild?.getAttribute('data-transition-key')
    pathname = '/athletes/123'
    rerender(
      <PageTransition>
        <p>b</p>
      </PageTransition>,
    )
    const second = container.firstElementChild?.getAttribute('data-transition-key')
    expect(first).not.toBe(second)
  })

  it('uses the detail variant when variant="detail"', () => {
    stubMatchMedia(false)
    const { container } = render(
      <PageTransition variant="detail">
        <p>x</p>
      </PageTransition>,
    )
    expect(container.firstElementChild?.className).toMatch(/translate/)
  })

  it('falls back to opacity-only under prefers-reduced-motion', () => {
    stubMatchMedia(true)
    const { container } = render(
      <PageTransition variant="detail">
        <p>x</p>
      </PageTransition>,
    )
    const cls = container.firstElementChild?.className ?? ''
    expect(cls).toMatch(/opacity/)
    expect(cls).not.toMatch(/translate/)
  })
})
