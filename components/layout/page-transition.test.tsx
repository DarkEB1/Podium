import { render, screen, act, waitFor } from '@testing-library/react'
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

  // Every route starts at opacity-0 and is only revealed by a state flip. If the
  // trigger for that flip never fires, correctly-rendered content stays
  // invisible with no way to recover. Browsers stop servicing
  // requestAnimationFrame in a hidden or backgrounded tab, which is exactly the
  // case reproduced: content present in the DOM, permanently at opacity-0.
  describe('reveal does not depend on an animation frame arriving', () => {
    /** Replaces rAF with a no-op, the behaviour of a backgrounded tab. */
    function stubDeadRaf() {
      vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
      vi.stubGlobal('cancelAnimationFrame', vi.fn())
    }

    it('still reveals content when the animation frame never fires', async () => {
      vi.useFakeTimers()
      try {
        stubMatchMedia(false)
        stubDeadRaf()
        const { container } = render(
          <PageTransition>
            <p>route content</p>
          </PageTransition>,
        )

        // Precondition: the from-state is applied and nothing has revealed it.
        expect(container.firstElementChild?.className).not.toMatch(/opacity-100/)

        await act(async () => {
          vi.advanceTimersByTime(500)
        })

        expect(container.firstElementChild?.className).toMatch(/opacity-100/)
      } finally {
        vi.useRealTimers()
      }
    })

    // No fake timers and no rAF stub: whichever trigger this environment
    // provides, the content must end up visible. jsdom does not run rAF
    // callbacks, so in practice this exercises the fallback path too — it is
    // kept as the end-to-end assertion that a plain render becomes visible
    // without a test having to drive any timer by hand.
    it('reveals content on a plain render', async () => {
      stubMatchMedia(false)
      const { container } = render(
        <PageTransition>
          <p>route content</p>
        </PageTransition>,
      )
      await waitFor(() =>
        expect(container.firstElementChild?.className).toMatch(/opacity-100/),
      )
    })
  })
})
