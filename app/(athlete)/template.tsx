'use client'

// GL1 — Athlete route-group template. Next.js remounts `template.tsx` on every
// navigation, so wrapping children in A9's PageTransition here gives a fresh
// enter animation per route (spec §10.3, §1.3) without per-page wiring.
//
//   - top-level nav  -> cross-fade (PageTransition variant="top-level")
//   - detail entry   -> fade + 8px-up (variant="detail"), chosen by route depth
//   - tapped card    -> transient scale 1.02 from the tap origin (reduced-motion safe)
//   - Back nav       -> scroll position restored from the per-path store
//   - reduced motion -> opacity-only (delegated to PageTransition / variant gate)

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import {
  PageTransition,
  useReducedMotion,
} from '@/components/layout/page-transition'
import type { TransitionVariant } from '@/lib/motion/transitions'

const SCROLL_KEY_PREFIX = 'podium:scroll:'

/**
 * A "detail" entry is any route nested below a section root (3+ path segments,
 * e.g. `/athletes/abc-123`). Section roots (`/dashboard`, `/athletes`) use the
 * top-level cross-fade. Per §1.3.
 */
function variantForPath(pathname: string): TransitionVariant {
  const segments = pathname.split('/').filter(Boolean)
  return segments.length >= 2 ? 'detail' : 'top-level'
}

export default function AthleteTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const reduced = useReducedMotion()
  const variant = variantForPath(pathname)
  const tapped = useRef<HTMLElement | null>(null)

  // Scroll-position preservation. Restore the stored offset for this path on
  // mount (Back navigation lands here); persist the live offset as it changes.
  useEffect(() => {
    const key = SCROLL_KEY_PREFIX + pathname
    const saved = sessionStorage.getItem(key)
    if (saved !== null) {
      window.scrollTo(0, Number(saved))
    }
    const onScroll = () => {
      sessionStorage.setItem(key, String(window.scrollY))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      sessionStorage.setItem(key, String(window.scrollY))
      window.removeEventListener('scroll', onScroll)
    }
  }, [pathname])

  // Tapped-card affordance: scale 1.02 from the tap point. Disabled under
  // reduced motion (spec §9.4). `[data-card]` is set by MarketplaceCard (A4).
  useEffect(() => {
    if (reduced) return
    const findCard = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null
      return target.closest<HTMLElement>('[data-card]')
    }
    const onDown = (e: PointerEvent) => {
      const card = findCard(e.target)
      if (!card) return
      const rect = card.getBoundingClientRect()
      const ox = ((e.clientX - rect.left) / rect.width) * 100
      const oy = ((e.clientY - rect.top) / rect.height) * 100
      card.style.transformOrigin = `${ox}% ${oy}%`
      card.style.transition = 'transform 120ms ease-out'
      card.style.transform = 'scale(1.02)'
      tapped.current = card
    }
    const clear = () => {
      if (!tapped.current) return
      tapped.current.style.transform = ''
      tapped.current = null
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', clear)
    window.addEventListener('pointercancel', clear)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', clear)
      window.removeEventListener('pointercancel', clear)
      clear()
    }
  }, [reduced])

  return <PageTransition variant={variant}>{children}</PageTransition>
}
