import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import AgentTemplate from './template'

let pathname = '/dashboard'
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

beforeEach(() => {
  pathname = '/dashboard'
  sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AgentTemplate', () => {
  it('wraps children in the page-transition container', () => {
    stubMatchMedia(false)
    const { container } = render(<AgentTemplate>route body</AgentTemplate>)
    expect(screen.getByText('route body')).toBeInTheDocument()
    expect(container.querySelector('[data-transition-key]')).not.toBeNull()
  })

  it('uses the top-level cross-fade variant for section roots', () => {
    stubMatchMedia(false)
    pathname = '/agents'
    const { container } = render(<AgentTemplate>x</AgentTemplate>)
    expect(
      container
        .querySelector('[data-transition-variant]')
        ?.getAttribute('data-transition-variant'),
    ).toBe('top-level')
  })

  it('uses the detail variant on deep (detail) routes', () => {
    stubMatchMedia(false)
    pathname = '/agents/abc-123'
    const { container } = render(<AgentTemplate>x</AgentTemplate>)
    expect(
      container
        .querySelector('[data-transition-variant]')
        ?.getAttribute('data-transition-variant'),
    ).toBe('detail')
  })

  it('falls back to opacity-only under prefers-reduced-motion', () => {
    stubMatchMedia(true)
    pathname = '/agents/abc-123'
    const { container } = render(<AgentTemplate>x</AgentTemplate>)
    const cls = container.querySelector('[data-transition-key]')?.className ?? ''
    expect(cls).toMatch(/opacity/)
    expect(cls).not.toMatch(/translate/)
  })

  it('applies a 1.02 scale to a tapped card and clears it on release', () => {
    stubMatchMedia(false)
    const { getByTestId } = render(
      <AgentTemplate>
        <a data-card data-testid="card" href="/agents/1">
          card
        </a>
      </AgentTemplate>,
    )
    const card = getByTestId('card')
    fireEvent.pointerDown(card)
    expect(card.style.transform).toContain('scale(1.02)')
    fireEvent.pointerUp(card)
    expect(card.style.transform).toBe('')
  })

  it('does not scale a tapped card under reduced motion', () => {
    stubMatchMedia(true)
    const { getByTestId } = render(
      <AgentTemplate>
        <a data-card data-testid="card" href="/agents/1">
          card
        </a>
      </AgentTemplate>,
    )
    const card = getByTestId('card')
    fireEvent.pointerDown(card)
    expect(card.style.transform).toBe('')
  })

  it('restores a saved scroll position for the current path on mount', () => {
    stubMatchMedia(false)
    pathname = '/agents'
    sessionStorage.setItem('podium:scroll:/agents', '420')
    const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    render(<AgentTemplate>x</AgentTemplate>)
    expect(spy).toHaveBeenCalledWith(0, 420)
    spy.mockRestore()
  })
})
