import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { animate } from 'motion'
import HorizontalTrack from './horizontal-track'
import { PANEL_COUNT } from '@/lib/landing/track-math'

// Real `animate` schedules via requestAnimationFrame, which never fires
// within a synchronous jsdom test. Replace it with a synchronous stand-in so
// the anchor-click test can assert the resolved target without needing fake
// timers or frame pumping.
vi.mock('motion', () => ({
  animate: vi.fn((_from: number, to: number, opts: { onUpdate?: (v: number) => void; onComplete?: () => void }) => {
    opts.onUpdate?.(to)
    opts.onComplete?.()
    return { stop: vi.fn() }
  }),
}))

afterEach(() => vi.unstubAllGlobals())

function stubMedia({ wide, reduced }: { wide: boolean; reduced: boolean }) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('min-width') ? wide : q.includes('prefers-reduced-motion') ? reduced : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

const PANELS = ['P1', 'P2', 'P3', 'P4', 'P5'].map((t) => <section key={t}>{t}</section>)

describe('HorizontalTrack', () => {
  it('renders all five panels in DOM order (track mode)', () => {
    stubMedia({ wide: true, reduced: false })
    render(<HorizontalTrack>{PANELS}</HorizontalTrack>)
    const text = screen.getByTestId('landing-track').textContent!
    expect(text.indexOf('P1')).toBeLessThan(text.indexOf('P5'))
  })

  it('draws the continuous baseline and panel ticks in track mode', () => {
    stubMedia({ wide: true, reduced: false })
    render(<HorizontalTrack>{PANELS}</HorizontalTrack>)
    expect(screen.getByTestId('baseline')).toBeInTheDocument()
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('05')).toBeInTheDocument()
  })

  it('falls back to a vertical stack under reduced motion', () => {
    stubMedia({ wide: true, reduced: true })
    render(<HorizontalTrack>{PANELS}</HorizontalTrack>)
    expect(screen.queryByTestId('landing-track')).not.toBeInTheDocument()
    expect(screen.getByTestId('landing-stack')).toBeInTheDocument()
    expect(screen.getByText('P5')).toBeInTheDocument()
  })

  it('falls back to a vertical stack on narrow viewports', () => {
    stubMedia({ wide: false, reduced: false })
    render(<HorizontalTrack>{PANELS}</HorizontalTrack>)
    expect(screen.getByTestId('landing-stack')).toBeInTheDocument()
  })

  // Regression coverage for the two arithmetic bugs found in review: both the
  // scroll listener and the keyboard handler must measure range/position
  // relative to the track wrapper, not `document.body`, and one keyboard
  // step must equal exactly one panel of that range. jsdom can't run real
  // scroll physics, but it can lay out an element's offsetHeight/offsetTop
  // as plain own-properties, which is enough to pin the formulas down.
  it('steps the keyboard by exactly one panel of track-relative scroll range', () => {
    stubMedia({ wide: true, reduced: false })
    render(<HorizontalTrack>{PANELS}</HorizontalTrack>)
    const wrapper = screen.getByTestId('track-wrapper')
    Object.defineProperty(wrapper, 'offsetHeight', { value: 4000, configurable: true })
    Object.defineProperty(wrapper, 'offsetTop', { value: 0, configurable: true })
    const scrollBySpy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    const expectedStep = (4000 - window.innerHeight) / (PANEL_COUNT - 1)
    expect(scrollBySpy).toHaveBeenCalledWith({ top: expectedStep, behavior: 'smooth' })
    scrollBySpy.mockRestore()
  })

  it('positions the track relative to the wrapper offset, not raw document scroll', () => {
    stubMedia({ wide: true, reduced: false })
    render(<HorizontalTrack>{PANELS}</HorizontalTrack>)
    const wrapper = screen.getByTestId('track-wrapper')
    const vw = window.innerWidth
    const trackH = vw * PANEL_COUNT
    // Simulate the track wrapper starting 1000px down the document (as if it
    // shared the body with other content) and the user scrolled exactly to
    // its top edge — track position should read as the very start (x = 0),
    // which only holds if position is computed relative to the wrapper.
    Object.defineProperty(wrapper, 'offsetTop', { value: 1000, configurable: true })
    Object.defineProperty(wrapper, 'offsetHeight', { value: trackH, configurable: true })
    Object.defineProperty(document.body, 'scrollHeight', { value: 1000 + trackH, configurable: true })
    Object.defineProperty(window, 'scrollY', { value: 1000, configurable: true, writable: true })

    fireEvent.scroll(window)

    const track = screen.getByTestId('landing-track')
    expect(track.style.transform).toBe('translateX(0px)')
  })

  it('intercepts an in-page anchor click and scrolls to the owning panel', () => {
    stubMedia({ wide: true, reduced: false })
    const anchoredPanels = [
      <section key="P1">P1</section>,
      <section key="P2">
        <div id="t2" />
        <a href="#t2">Jump to panel 2</a>
      </section>,
      <section key="P3">P3</section>,
      <section key="P4">P4</section>,
      <section key="P5">P5</section>,
    ]
    render(<HorizontalTrack>{anchoredPanels}</HorizontalTrack>)
    const wrapper = screen.getByTestId('track-wrapper')
    Object.defineProperty(wrapper, 'offsetHeight', { value: 4000, configurable: true })
    Object.defineProperty(wrapper, 'offsetTop', { value: 200, configurable: true })
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    fireEvent.click(screen.getByText('Jump to panel 2'))

    const expectedTarget = 200 + 1 * ((4000 - window.innerHeight) / (PANEL_COUNT - 1))
    expect(scrollToSpy).toHaveBeenCalledWith(0, expectedTarget)
    scrollToSpy.mockRestore()
  })

  it('pulls the track to the panel that receives keyboard focus', () => {
    stubMedia({ wide: true, reduced: false })
    const focusPanels = [
      <section key="P1">P1</section>,
      <section key="P2">P2</section>,
      <section key="P3">
        <a href="/somewhere">Focusable link in panel 3</a>
      </section>,
      <section key="P4">P4</section>,
      <section key="P5">P5</section>,
    ]
    render(<HorizontalTrack>{focusPanels}</HorizontalTrack>)
    const wrapper = screen.getByTestId('track-wrapper')
    Object.defineProperty(wrapper, 'offsetHeight', { value: 4000, configurable: true })
    Object.defineProperty(wrapper, 'offsetTop', { value: 0, configurable: true })
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    fireEvent.focusIn(screen.getByText('Focusable link in panel 3'))

    const expectedTarget = 2 * ((4000 - window.innerHeight) / (PANEL_COUNT - 1))
    expect(scrollToSpy).toHaveBeenCalledWith(0, expectedTarget)
    scrollToSpy.mockRestore()
  })

  it('does not re-scroll when focus lands in the panel already in view', () => {
    stubMedia({ wide: true, reduced: false })
    const focusPanels = [
      <section key="P1">
        <a href="/somewhere">Focusable link in panel 1</a>
      </section>,
      <section key="P2">P2</section>,
      <section key="P3">P3</section>,
      <section key="P4">P4</section>,
      <section key="P5">P5</section>,
    ]
    render(<HorizontalTrack>{focusPanels}</HorizontalTrack>)
    const wrapper = screen.getByTestId('track-wrapper')
    Object.defineProperty(wrapper, 'offsetHeight', { value: 4000, configurable: true })
    Object.defineProperty(wrapper, 'offsetTop', { value: 0, configurable: true })
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    fireEvent.focusIn(screen.getByText('Focusable link in panel 1'))

    expect(scrollToSpy).not.toHaveBeenCalled()
    scrollToSpy.mockRestore()
  })

  it('lets modified clicks (e.g. ctrl+click to open in a new tab) bypass track interception', () => {
    stubMedia({ wide: true, reduced: false })
    const anchoredPanels = [
      <section key="P1">P1</section>,
      <section key="P2">
        <div id="t2" />
        <a href="#t2">Jump to panel 2</a>
      </section>,
      <section key="P3">P3</section>,
      <section key="P4">P4</section>,
      <section key="P5">P5</section>,
    ]
    render(<HorizontalTrack>{anchoredPanels}</HorizontalTrack>)
    const wrapper = screen.getByTestId('track-wrapper')
    Object.defineProperty(wrapper, 'offsetHeight', { value: 4000, configurable: true })
    Object.defineProperty(wrapper, 'offsetTop', { value: 200, configurable: true })
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    vi.mocked(animate).mockClear()

    // fireEvent returns false only when preventDefault() was called on the
    // dispatched event — a plain assertion that native "open in new tab"
    // behaviour was left alone.
    const notPrevented = fireEvent.click(screen.getByText('Jump to panel 2'), { ctrlKey: true })

    expect(notPrevented).toBe(true)
    expect(animate).not.toHaveBeenCalled()
    expect(scrollToSpy).not.toHaveBeenCalled()
    scrollToSpy.mockRestore()
  })
})
