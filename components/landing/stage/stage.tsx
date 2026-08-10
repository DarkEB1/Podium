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
import { REST_POINTS, SHOVE_END, panelIndex, trackXVw } from './track-map'

// ————————————————————————————————————————————————————————————————————————
// The stage: one 1000vh scroll fabric driving a fixed 500vw corridor
// (build spec v3 §2.5). The smoothed progress value P (0..1) is written
// imperatively every frame to the CSS custom property `--p` on the stage
// root and pushed to JS subscribers — React state only changes on discrete
// events (panel index, nav solidity), so travel never re-renders the tree.
// ————————————————————————————————————————————————————————————————————————

export const TRAVEL_VIEWPORTS = 9 // 1000vh body = 100vh viewport + 900vh travel

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

const PANEL_LABELS = ['01', '02', '03', '04', '05']
// Quiet time after the last scroll input before the corridor settles itself.
const SNAP_IDLE_MS = 190

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
  const jumpTo = useCallback((targetP: number, durationMs?: number) => {
    const startP = pRef.current
    const travel = window.innerHeight * TRAVEL_VIEWPORTS
    const t0 = performance.now()
    const D = durationMs ?? 1100
    programmaticUntil.current = t0 + D + 160
    const inoutCirc = (t: number) =>
      t < 0.5
        ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
        : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2
    if (jumpAnim.current !== null) cancelAnimationFrame(jumpAnim.current)
    const step = (now: number) => {
      const u = Math.min((now - t0) / D, 1)
      const p = startP + (targetP - startP) * inoutCirc(u)
      springPos.current = p
      springVel.current = 0
      window.scrollTo(0, p * travel)
      if (u < 1) {
        jumpAnim.current = requestAnimationFrame(step)
      } else {
        jumpAnim.current = null
        programmaticUntil.current = performance.now() + 160
      }
    }
    jumpAnim.current = requestAnimationFrame(step)
  }, [])

  // Visitor input arms the snap; a jump's own scroll events do not.
  useEffect(() => {
    const arm = () => {
      lastInputAt.current = performance.now()
      snapArmed.current = true
    }
    const onScroll = () => {
      if (performance.now() < programmaticUntil.current) return
      arm()
    }
    const opts = { passive: true } as const
    window.addEventListener('wheel', arm, opts)
    window.addEventListener('touchmove', arm, opts)
    window.addEventListener('touchend', arm, opts)
    window.addEventListener('scroll', onScroll, opts)
    return () => {
      window.removeEventListener('wheel', arm)
      window.removeEventListener('touchmove', arm)
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
        setIntroDone((prev) => prev || p >= 0.225)
      }
      setNavSolid((prev) => {
        const next = window.scrollY > 40
        return prev === next ? prev : next
      })
      // Settle to the nearest panel once the visitor stops pushing. Never
      // during the intro cascade (P below the shove end): there the visitor
      // is hand-tipping the dominoes and any pull would fight them.
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
        now - lastInputAt.current > SNAP_IDLE_MS &&
        target > SHOVE_END
      ) {
        const rest = REST_POINTS.reduce((best, r) =>
          Math.abs(target - r) < Math.abs(target - best) ? r : best
        )
        const gap = Math.abs(target - rest)
        snapArmed.current = false
        if (gap > 0.004) {
          jumpTo(rest, Math.min(900, Math.max(420, gap * 5200)))
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
          style={{ width: '500vw' }}
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
          {introDone ? `${PANEL_LABELS[panelIdx]} / 05` : 'SCROLL ↓ TO TIP THE FIRST DOMINO'}
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

// 500vw of measuring tape under the baseline: 12px ticks every 10vw, 16px at
// panel origins with mono coordinates (000..400). Micro 2vw ticks arrive with
// the polish pass if they earn their render cost.
function TickTape() {
  const marks: ReactNode[] = []
  for (let vw = 0; vw <= 500; vw += 10) {
    const origin = vw % 100 === 0
    marks.push(
      <div key={vw} className="absolute" style={{ left: `${vw}vw`, top: 'var(--floor-y)' }}>
        <div
          className="w-px bg-foreground/25"
          style={{ height: origin ? 16 : 12 }}
        />
        {origin && vw < 500 && (
          <span className="absolute left-2 top-1 font-mono text-[10.5px] tracking-[.15em] text-foreground/40">
            {String(vw).padStart(3, '0')}
          </span>
        )}
      </div>
    )
  }
  return <div aria-hidden="true">{marks}</div>
}
