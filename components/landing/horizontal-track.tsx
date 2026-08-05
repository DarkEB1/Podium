'use client'

import {
  Children,
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { animate } from 'motion'
import { trackX, snapTarget, PANEL_COUNT } from '@/lib/landing/track-math'

// Progress of the hero→marketplace domino transition (0 outside it).
export const TrackContext = createContext<{ progress: number }>({ progress: 0 })

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    setMatches(mq.matches)
    const onChange = () => setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

const TICKS = ['01', '02', '03', '04', '05']

export default function HorizontalTrack({ children }: { children: ReactNode }) {
  const panels = Children.toArray(children)
  const wide = useMedia('(min-width: 1024px)')
  const reduced = useMedia('(prefers-reduced-motion: reduce)')
  const trackRef = useRef<HTMLDivElement>(null)
  const [x, setX] = useState(0)
  const [progress, setProgress] = useState(0)
  const snapAnim = useRef<ReturnType<typeof animate> | null>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // True while a soft-snap animation is driving window.scrollTo, so the
  // scroll events it generates don't cancel their own animation or queue a
  // second snap on top of it (spec: scroll model).
  const isSnapping = useRef(false)

  // In track mode a panel's position is a CSS transform, not a scroll offset,
  // so a native in-page anchor (e.g. the hero's "How it works" link) has
  // nowhere on the document to scroll to. Intercept it, find which panel
  // wrapper owns the target, and drive window.scrollTo to that panel's
  // boundary instead (spec: anchor navigation inside the track).
  const onAnchorClick = useCallback((e: MouseEvent) => {
    const target = e.target as Element | null
    const anchor = target?.closest('a[href^="#"]') as HTMLAnchorElement | null
    if (!anchor) return
    const id = anchor.getAttribute('href')?.slice(1)
    if (!id) return
    const dest = document.getElementById(id)
    const panelEl = dest?.closest('[data-panel-index]') as HTMLElement | null
    const el = trackRef.current
    if (!panelEl || !el) return
    const panelIndex = Number(panelEl.dataset.panelIndex)
    e.preventDefault()
    const range = el.offsetHeight - window.innerHeight
    const targetScroll = el.offsetTop + panelIndex * (range / (PANEL_COUNT - 1))
    snapAnim.current?.stop()
    isSnapping.current = true
    snapAnim.current = animate(window.scrollY, targetScroll, {
      duration: 0.35,
      ease: 'easeOut',
      onUpdate: (v) => window.scrollTo(0, v),
      onComplete: () => {
        isSnapping.current = false
      },
    })
  }, [])

  const onScroll = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const vw = window.innerWidth
    const trackW = vw * PANEL_COUNT
    // Range and position are relative to the track wrapper, not document.body,
    // so this stays correct even if something else ever shares the body
    // (spec: scroll model).
    const range = el.offsetHeight - window.innerHeight
    const localY = window.scrollY - el.offsetTop
    const nextX = trackX(localY, range, trackW, vw)
    setX(nextX)
    // Domino transition occupies the first inter-panel gap: x in [0, -vw].
    setProgress(Math.min(Math.max(-nextX / vw, 0), 1))
    // A snap animation in flight drives its own scroll events; let it finish
    // undisturbed instead of stopping/rescheduling itself out of existence.
    if (isSnapping.current) return
    // Soft snap once scrolling rests near a boundary (spec: scroll model).
    snapAnim.current?.stop()
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      const target = snapTarget(nextX, vw)
      if (target !== null && target !== nextX) {
        const targetScroll = el.offsetTop + (-target / (trackW - vw)) * range
        isSnapping.current = true
        snapAnim.current = animate(window.scrollY, targetScroll, {
          duration: 0.35,
          ease: 'easeOut',
          onUpdate: (v) => window.scrollTo(0, v),
          onComplete: () => {
            isSnapping.current = false
          },
        })
      }
    }, 140)
  }, [])

  useEffect(() => {
    if (!wide || reduced) return
    // Wheel/touch input lets the user interrupt an in-flight snap.
    const onInterrupt = () => {
      snapAnim.current?.stop()
      isSnapping.current = false
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('wheel', onInterrupt, { passive: true })
    window.addEventListener('touchstart', onInterrupt, { passive: true })
    window.addEventListener('click', onAnchorClick)
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('wheel', onInterrupt)
      window.removeEventListener('touchstart', onInterrupt)
      window.removeEventListener('click', onAnchorClick)
      snapAnim.current?.stop()
      if (settleTimer.current) clearTimeout(settleTimer.current)
    }
  }, [wide, reduced, onScroll, onAnchorClick])

  // Keyboard: arrows/PageDown move one panel (spec: scroll model).
  useEffect(() => {
    if (!wide || reduced) return
    const onKey = (e: KeyboardEvent) => {
      const el = trackRef.current
      if (!el) return
      const range = el.offsetHeight - window.innerHeight
      const step = range / (PANEL_COUNT - 1) // scroll distance per panel
      if (['ArrowRight', 'PageDown'].includes(e.key)) window.scrollBy({ top: step, behavior: 'smooth' })
      if (['ArrowLeft', 'PageUp'].includes(e.key)) window.scrollBy({ top: -step, behavior: 'smooth' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [wide, reduced])

  if (!wide || reduced) {
    return (
      <div data-testid="landing-stack">
        <TrackContext.Provider value={{ progress: 0 }}>{panels}</TrackContext.Provider>
      </div>
    )
  }

  return (
    // Body height provides the scroll length; the sticky viewport shows the track.
    <div ref={trackRef} data-testid="track-wrapper" style={{ height: `${PANEL_COUNT * 100}vh` }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        <TrackContext.Provider value={{ progress }}>
          <div
            data-testid="landing-track"
            className="flex h-full"
            style={{ width: `${PANEL_COUNT * 100}vw`, transform: `translateX(${x}px)` }}
          >
            {panels.map((panel, i) => (
              <div key={i} className="relative h-full w-screen shrink-0" data-panel-index={i}>
                {panel}
                <span className="absolute bottom-[calc(28%-1.75rem)] left-6 font-mono text-small uppercase tracking-[.15em] text-muted-foreground">
                  {TICKS[i] ?? ''}
                </span>
              </div>
            ))}
            {/* The baseline: one continuous hairline the whole page stands on. */}
            <div
              data-testid="baseline"
              aria-hidden="true"
              className="absolute inset-x-0 border-t-[1.5px] border-baseline"
              style={{ top: '72%' }}
            />
          </div>
        </TrackContext.Provider>
      </div>
    </div>
  )
}
