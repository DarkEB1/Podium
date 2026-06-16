'use client'

// A9 — PageTransition wrapper (§1.3, spec §10.3).
// Consumed by one `template.tsx` per route group (GL1). Next.js remounts a
// `template.tsx` on every navigation, so wrapping its children here gives a
// fresh enter animation per route without any per-page wiring.
//
// Behaviours (§1.3):
//   variant="top-level" — cross-fade 200ms (default; top-level nav)
//   variant="detail"    — fade + 8px-up 200ms (detail page entry)
//   variant="overlay"   — scale-from-0.96 180ms (modals / bottom sheets)
//   variant="toast"     — slide in
// All gated by prefers-reduced-motion → opacity-only.
//
// Scroll-preserving back: we never scroll or remount the scroll container, so
// the browser's native scroll restoration (App Router default) is left intact.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  transitionClasses,
  type TransitionVariant,
} from '@/lib/motion/transitions'

// useLayoutEffect warns during SSR; fall back to useEffect on the server.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Reactive prefers-reduced-motion hook. Starts `false` (SSR-safe / motion-on)
 * and updates on mount + when the OS preference changes.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return reduced
}

export interface PageTransitionProps {
  children: React.ReactNode
  /** Motion behaviour to apply. Defaults to the top-level cross-fade. */
  variant?: TransitionVariant
  className?: string
}

export function PageTransition({
  children,
  variant = 'top-level',
  className,
}: PageTransitionProps) {
  const pathname = usePathname()
  const reduced = useReducedMotion()
  // `entered` drives the from→to transition: mount in the "from" state, then
  // clear it on the next frame so the element animates to rest.
  const [entered, setEntered] = useState(false)
  const frame = useRef<number | undefined>(undefined)

  // Reset to the "from" state whenever the route key changes.
  useIsomorphicLayoutEffect(() => {
    setEntered(false)
  }, [pathname])

  useEffect(() => {
    if (entered) return
    frame.current = requestAnimationFrame(() => setEntered(true))
    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    }
  }, [entered])

  // The "from" classes (opacity-0 + transform). When entered, we drop the
  // from-state so the element settles to opacity-100 / translate-0 / scale-100.
  const fromClasses = transitionClasses(variant, reduced)

  return (
    <div
      data-transition-key={pathname}
      data-transition-variant={variant}
      className={cn(
        fromClasses,
        // Resting state. Under reduced motion only opacity animates, so we never
        // emit transform-reset utilities there (keeps the DOM transform-free).
        entered && (reduced ? 'opacity-100' : 'opacity-100 translate-y-0 scale-100'),
        className,
      )}
    >
      {children}
    </div>
  )
}

export default PageTransition
