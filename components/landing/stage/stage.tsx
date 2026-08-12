'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import StageNav from './stage-nav'
import LandingScene from './scene'
import {
  REST_POINTS,
  CASCADE_END,
  TRAVEL_VIEWPORTS,
  panelIndex,
  trackXVw,
} from './track-map'

// ————————————————————————————————————————————————————————————————————————
// The stage: one 520vh scroll fabric driving a fixed 400vw corridor
// (build spec v3 §2.5). The smoothed progress value P (0..1) is written
// imperatively every frame to the CSS custom property `--p` on the stage
// root and pushed to JS subscribers — React state only changes on discrete
// events (panel index, nav solidity), so travel never re-renders the tree.
// ————————————————————————————————————————————————————————————————————————

// The fabric length lives with the motion map, which is what it gears.
export { TRAVEL_VIEWPORTS }

export type StageApi = {
  getP: () => number
  subscribe: (fn: (p: number) => void) => () => void
  jumpTo: (p: number, durationMs?: number) => void
}

export const StageContext = createContext<StageApi | null>(null)
export function useStage(): StageApi {
  const api = useContext(StageContext)
  if (!api) throw new Error('useStage outside <Stage>')
  return api
}

export { REST_POINTS }

const PANEL_LABELS = ['01', '02', '03', '04']
// Quiet time after the last scroll input before the corridor settles itself.
const SNAP_IDLE_MS = 150
// How far a gesture must carry before it counts as "going to the next panel"
// rather than a twitch. In pixels, not a fraction of the gap, so the weight of
// a flick feels the same everywhere and does not drift when the fabric length
// changes. Tuned for trackpads, where a gentle two-finger push easily travels
// a few hundred pixels and should not necessarily change panel.
const COMMIT_PX = 340
// The settle curve. Quintic smootherstep: gentle away from the last frame the
// visitor drove, a moderate middle, a soft landing. It peaks at 1.875x the
// average rate, where the circular ease this replaced (founder feedback
// 2026-08-12: "autoscroll is too fast") had an infinite-slope midpoint, so the
// corridor whipped past however long the animation nominally ran.
const settleEase = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
// Length of the settle, scaled by how far it has to carry. A full slide takes
// 1.4s: the corridor covers a viewport either way, whether the hand does it or
// the settle does, so the two are paced to match. The short recoveries back to
// the slide you came from finish sooner but never feel snatched.
// Every gap between rests is the same width, so one of them defines the span.
const PANEL_SPAN = (REST_POINTS[1] ?? 1 / 3) - (REST_POINTS[0] ?? 0)
const settleMs = (delta: number) =>
  Math.min(1500, Math.max(620, 620 + (Math.abs(delta) / PANEL_SPAN) * 780))

export default function Stage({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const listeners = useRef(new Set<(p: number) => void>())
  const pRef = useRef(0)
  const springPos = useRef(0)
  const springVel = useRef(0)
  const jumpAnim = useRef<number | null>(null)
  // Snap-to-panel bookkeeping: when scroll input stops, the corridor finishes
  // the journey to the nearest panel so nobody is left in a half-travelled
  // limbo (founder direction 2026-08-10).
  const lastInputAt = useRef(0)
  const snapArmed = useRef(false)
  const programmaticUntil = useRef(0)
  // The panel the corridor last came to rest on: the origin every gesture is
  // measured from.
  const settledRest = useRef(0)
  const [panelIdx, setPanelIdx] = useState(0)
  const [navSolid, setNavSolid] = useState(false)
  const [introDone, setIntroDone] = useState(false)

  const apply = useCallback((p: number) => {
    pRef.current = p
    if (rootRef.current) rootRef.current.style.setProperty('--p', String(p))
    if (trackRef.current) {
      const vhPerVw = window.innerHeight / window.innerWidth
      trackRef.current.style.transform = `translate3d(${trackXVw(p, vhPerVw)}vw, 0, 0)`
    }
    listeners.current.forEach((fn) => fn(p))
  }, [])

  // Programmatic travel: the corridor rushes past (spec §5.4) — the spring is
  // bypassed (we drive springPos directly) then re-engaged on arrival. Scroll
  // events it emits must not read as visitor input, hence programmaticUntil.
  // The origin for the next gesture is only re-anchored when a jump actually
  // ARRIVES: a jump the visitor interrupts must leave the origin where it was,
  // or the next gesture would be measured from a panel they never reached.
  const jumpTo = useCallback((targetP: number, durationMs?: number) => {
    const startP = pRef.current
    const travel = window.innerHeight * TRAVEL_VIEWPORTS
    const t0 = performance.now()
    const D = durationMs ?? settleMs(targetP - startP)
    programmaticUntil.current = t0 + D + 160
    if (jumpAnim.current !== null) cancelAnimationFrame(jumpAnim.current)
    const step = (now: number) => {
      const u = Math.min((now - t0) / D, 1)
      const p = startP + (targetP - startP) * settleEase(u)
      springPos.current = p
      springVel.current = 0
      window.scrollTo(0, p * travel)
      if (u < 1) {
        jumpAnim.current = requestAnimationFrame(step)
      } else {
        jumpAnim.current = null
        programmaticUntil.current = performance.now() + 160
        if (REST_POINTS.includes(targetP)) settledRest.current = targetP
      }
    }
    jumpAnim.current = requestAnimationFrame(step)
  }, [])

  // Visitor input arms the snap; a jump's own scroll events do not. Real input
  // also ABORTS a settle in progress: the visitor's hand outranks the
  // animation, so a long swipe keeps travelling instead of being swallowed and
  // forcing them to lift off and start again.
  useEffect(() => {
    const arm = () => {
      lastInputAt.current = performance.now()
      snapArmed.current = true
      if (jumpAnim.current !== null) {
        cancelAnimationFrame(jumpAnim.current)
        jumpAnim.current = null
        programmaticUntil.current = 0
        springVel.current = 0
      }
    }
    const onScroll = () => {
      if (performance.now() < programmaticUntil.current) return
      arm()
    }
    // The corridor runs sideways, so a sideways gesture should drive it. A
    // horizontal trackpad swipe carries no vertical delta and the page has no
    // horizontal overflow for the browser to consume, so we fold deltaX into
    // the scroll position ourselves.
    const onWheel = (e: WheelEvent) => {
      arm()
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && e.deltaX !== 0) {
        window.scrollBy(0, e.deltaX)
      }
    }
    // Touch: a horizontal drag pages the corridor. Only claimed once the
    // gesture is clearly sideways, so vertical scrolling and the browser's
    // own edge-swipe gestures are left alone.
    let touchX = 0
    let touchY = 0
    let axis: 'none' | 'x' | 'y' = 'none'
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      touchX = t.clientX
      touchY = t.clientY
      axis = 'none'
    }
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      const dx = touchX - t.clientX
      const dy = touchY - t.clientY
      if (axis === 'none' && Math.abs(dx) + Math.abs(dy) > 10) {
        axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y'
      }
      if (axis === 'x') {
        if (e.cancelable) e.preventDefault()
        window.scrollBy(0, dx)
        touchX = t.clientX
        touchY = t.clientY
      }
      arm()
    }
    const passive = { passive: true } as const
    window.addEventListener('wheel', onWheel, passive)
    window.addEventListener('touchstart', onTouchStart, passive)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', arm, passive)
    window.addEventListener('scroll', onScroll, passive)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', arm)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  // Critically damped spring (k 170, c 26, m 1) between raw scroll and P.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastY = -1
    let stableSince = last
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const travel = window.innerHeight * TRAVEL_VIEWPORTS
      const target = Math.min(Math.max(window.scrollY / travel, 0), 1)
      if (jumpAnim.current === null) {
        const k = 170
        const c = 26
        const x = springPos.current
        const v = springVel.current
        const a = k * (target - x) - c * v
        springVel.current = v + a * dt
        springPos.current = x + springVel.current * dt
        if (Math.abs(target - springPos.current) < 0.00005 && Math.abs(springVel.current) < 0.0005) {
          springPos.current = target
          springVel.current = 0
        }
      }
      const p = Math.min(Math.max(springPos.current, 0), 1)
      if (p !== pRef.current) {
        apply(p)
        const idx = panelIndex(p)
        setPanelIdx((prev) => (prev === idx ? prev : idx))
        setIntroDone((prev) => prev || p >= CASCADE_END)
      }
      setNavSolid((prev) => {
        const next = window.scrollY > 40
        return prev === next ? prev : next
      })
      // Settle on the raw scroll position, not the smoothed one: the spring is
      // still catching up when the visitor lets go, and snapping to a
      // mid-flight value would land the corridor in the wrong place.
      if (window.scrollY !== lastY) {
        lastY = window.scrollY
        stableSince = now
      }
      if (
        snapArmed.current &&
        jumpAnim.current === null &&
        now - stableSince > SNAP_IDLE_MS &&
        now - lastInputAt.current > SNAP_IDLE_MS
      ) {
        // Directional commit, not nearest-neighbour. A short push in one
        // direction takes you a whole panel: the gesture decides where you
        // are going, the corridor covers the distance. Anything less than the
        // commit threshold falls back to the panel you came from, so a stray
        // wheel tick never strands you between two panels.
        const from = settledRest.current
        const dir = target > from ? 1 : -1
        const i = REST_POINTS.indexOf(from)
        const next = REST_POINTS[Math.min(Math.max(i + dir, 0), REST_POINTS.length - 1)] ?? from
        // The intro cascade is hand-driven: while the dominoes are still
        // falling, nothing pulls at the page. The moment the last one lands
        // (CASCADE_END) that freedom ends, so the shove into panel 02 is
        // never a state you can be left stranded in.
        const tippingDominoes = from === 0 && dir === 1 && target < CASCADE_END
        if (!tippingDominoes) {
          const span = next - from
          const frac = span === 0 ? 0 : (target - from) / span
          const movedPx = Math.abs(target - from) * travel
          const goTo =
            frac >= 1
              ? // Carried past the next panel entirely (scrollbar drag, End
                // key, a long trackpad sweep): honour how far they actually
                // went instead of insisting on one panel per gesture.
                REST_POINTS.reduce((best, r) =>
                  Math.abs(target - r) < Math.abs(target - best) ? r : best
                )
              : frac > 0 && movedPx > COMMIT_PX
                ? next
                : from
          snapArmed.current = false
          if (Math.abs(target - goTo) > 0.002) {
            jumpTo(goTo)
          }
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [apply, jumpTo])

  // Keyboard: rest-point jumps (spec §4.5).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown'].includes(e.key)) {
        e.preventDefault()
        const i = Math.min(panelIndex(pRef.current) + 1, REST_POINTS.length - 1)
        jumpTo(REST_POINTS[i]!)
      }
      if (['ArrowLeft', 'PageUp'].includes(e.key)) {
        e.preventDefault()
        const i = Math.max(panelIndex(pRef.current) - 1, 0)
        jumpTo(REST_POINTS[i]!)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [jumpTo])

  const api = useRef<StageApi>({
    getP: () => pRef.current,
    subscribe: (fn) => {
      listeners.current.add(fn)
      return () => listeners.current.delete(fn)
    },
    jumpTo,
  })
  api.current.jumpTo = jumpTo

  return (
    <StageContext.Provider value={api.current}>
      {/* scroll length */}
      <div style={{ height: `${(TRAVEL_VIEWPORTS + 1) * 100}vh` }} aria-hidden="true" />
      {/* the corridor viewport */}
      <div ref={rootRef} data-testid="stage" className="fixed inset-0 overflow-hidden bg-background">
        {/* 3D stage behind the DOM (spec §2.6) */}
        <LandingScene />
        <div
          ref={trackRef}
          data-testid="stage-track"
          className="absolute inset-y-0 left-0 z-10 flex will-change-transform"
          style={{ width: '400vw' }}
        >
          {children}
          {/* tick tape: travels with the track (spec §2.2) */}
          <TickTape />
        </div>
        {/* the baseline: fixed, never moves */}
        <div
          data-testid="baseline"
          aria-hidden="true"
          className="absolute inset-x-0 z-10 border-t-[1.5px] border-foreground"
          style={{ top: 'var(--floor-y)' }}
        />
        <StageNav solid={navSolid} activePanel={panelIdx} onNavigate={jumpTo} />
        {/* wayfinding (spec §2.4) */}
        <div
          className="absolute z-20 font-mono text-[10.5px] uppercase tracking-[.15em] text-muted-foreground"
          style={{ left: 'var(--margin-x)', top: 'calc(var(--floor-y) + 12px)' }}
          aria-hidden="true"
        >
          {`${PANEL_LABELS[panelIdx]} / 04`}
        </div>
        {!introDone && (
          <button
            type="button"
            onClick={() => jumpTo(REST_POINTS[1]!)}
            className="absolute z-20 font-mono text-[10.5px] uppercase tracking-[.15em] text-primary"
            style={{ right: 'var(--margin-x)', top: 'calc(var(--floor-y) + 12px)' }}
          >
            SKIP INTRO →
          </button>
        )}
      </div>
    </StageContext.Provider>
  )
}

// 400vw of measuring tape under the baseline: 12px ticks every 10vw, 16px at
// panel origins with mono coordinates (000..300). Micro 2vw ticks arrive with
// the polish pass if they earn their render cost.
function TickTape() {
  const marks: ReactNode[] = []
  for (let vw = 0; vw <= 400; vw += 10) {
    const origin = vw % 100 === 0
    marks.push(
      <div key={vw} className="absolute" style={{ left: `${vw}vw`, top: 'var(--floor-y)' }}>
        <div
          className="w-px bg-foreground/25"
          style={{ height: origin ? 16 : 12 }}
        />
        {origin && vw < 400 && (
          <span className="absolute left-2 top-1 font-mono text-[10.5px] tracking-[.15em] text-foreground/40">
            {String(vw).padStart(3, '0')}
          </span>
        )}
      </div>
    )
  }
  return <div aria-hidden="true">{marks}</div>
}
