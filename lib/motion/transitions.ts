// A9 — Motion tokens + reduced-motion helper (§1.3, spec §10.3)
// Single source of truth for Podium's motion system. CSS-class based (no
// framer-motion dependency); every variant degrades to opacity-only when the
// user prefers reduced motion (spec §9.4 / §10.3 accessibility baseline).
//
// Variants (§1.3):
//   top-level — cross-fade, 200ms (top-level navigation)
//   detail    — fade + 8px upward slide, 200ms (detail page entry)
//   overlay   — scale-from-0.96, 180ms (modals + bottom sheets)
//   toast     — slide in (toast notifications)
//
// Classes rely on Tailwind v4 + tw-animate-css utilities already in the project.

export const MOTION = {
  duration: {
    crossFade: 200,
    detail: 200,
    overlay: 180,
    toast: 200,
  },
  /** Upward travel for detail-page entry, in px (§1.3). */
  detailOffsetPx: 8,
  /** Starting scale for modal / bottom-sheet overlays (§1.3). */
  overlayScale: 0.96,
  /** Shared easing for all enter transitions. */
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const

export type TransitionVariant = 'top-level' | 'detail' | 'overlay' | 'toast'

/**
 * Synchronous read of the user's reduced-motion preference. Safe during SSR
 * (returns false when `matchMedia` is unavailable). For reactive updates use the
 * `useReducedMotion` hook in the component layer.
 */
export function prefersReducedMotion(): boolean {
  if (typeof matchMedia !== 'function') return false
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Enter ("from") classes per variant — the element animates *to* its resting
// state (opacity-100, translate-0, scale-100). When reduced motion is on, only
// opacity changes; no transform is ever applied.
const ENTER_FROM: Record<TransitionVariant, string> = {
  'top-level': 'opacity-0',
  detail: 'opacity-0 translate-y-2', // 8px (Tailwind spacing 2 = 8px), §1.3
  overlay: 'opacity-0 scale-[0.96]',
  toast: 'opacity-0 translate-y-2',
}

const DURATION_CLASS: Record<TransitionVariant, string> = {
  'top-level': 'duration-200',
  detail: 'duration-200',
  overlay: 'duration-[180ms]',
  toast: 'duration-200',
}

/**
 * Returns the className applied to a freshly-mounted, animating element for the
 * given variant. The consumer transitions these away (to the resting state) on
 * the next frame to produce the enter animation.
 *
 * @param variant which motion behaviour to use
 * @param reduced override reduced-motion detection (defaults to live query)
 */
export function transitionClasses(
  variant: TransitionVariant,
  reduced: boolean = prefersReducedMotion(),
): string {
  const base = `transition-[opacity,transform] ease-out ${DURATION_CLASS[variant]}`
  // Reduced motion: opacity-only, never translate/scale (§9.4).
  if (reduced) return `${base} opacity-0`
  return `${base} ${ENTER_FROM[variant]}`
}
