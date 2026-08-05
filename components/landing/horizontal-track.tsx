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

  const onScroll = useCallback(() => {
    const vw = window.innerWidth
    const trackW = vw * PANEL_COUNT
    const range = document.body.scrollHeight - window.innerHeight
    const nextX = trackX(window.scrollY, range, trackW, vw)
    snapAnim.current?.stop()
    setX(nextX)
    // Domino transition occupies the first inter-panel gap: x in [0, -vw].
    setProgress(Math.min(Math.max(-nextX / vw, 0), 1))
    // Soft snap once scrolling rests near a boundary (spec: scroll model).
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      const target = snapTarget(nextX, vw)
      if (target !== null && target !== nextX) {
        const targetScroll = (-target / (trackW - vw)) * range
        snapAnim.current = animate(window.scrollY, targetScroll, {
          duration: 0.35,
          ease: 'easeOut',
          onUpdate: (v) => window.scrollTo(0, v),
        })
      }
    }, 140)
  }, [])

  useEffect(() => {
    if (!wide || reduced) return
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      snapAnim.current?.stop()
      if (settleTimer.current) clearTimeout(settleTimer.current)
    }
  }, [wide, reduced, onScroll])

  // Keyboard: arrows/PageDown move one panel (spec: scroll model).
  useEffect(() => {
    if (!wide || reduced) return
    const onKey = (e: KeyboardEvent) => {
      const step = window.innerHeight * ((document.body.scrollHeight - window.innerHeight) /
        (window.innerWidth * (PANEL_COUNT - 1))) // scroll distance per panel
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
    <div style={{ height: `${PANEL_COUNT * 100}vh` }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        <TrackContext.Provider value={{ progress }}>
          <div
            data-testid="landing-track"
            className="flex h-full"
            style={{ width: `${PANEL_COUNT * 100}vw`, transform: `translateX(${x}px)` }}
          >
            {panels.map((panel, i) => (
              <div key={i} className="relative h-full w-screen shrink-0">
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
