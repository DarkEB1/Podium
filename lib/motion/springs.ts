/**
 * Shared spring vocabulary for Framer Motion (`motion/react`) interactions.
 *
 * Single source of truth so motion values stay consistent and defensible.
 * Framer's `spring` with `bounce` + `duration` maps closely onto Apple's
 * damping + response model (UX audit 2026-08-14, apple-design skill §4).
 *
 * Rule of thumb: `bounce: 0` by default — reserve overshoot for motion a
 * gesture's momentum actually caused (a fling/throw).
 *
 * CSS-vs-spring line (audit §M5): CSS transitions are fine for enter/exit of
 * things the user CANNOT grab (page transitions, tooltips, static fades). Use
 * these springs for anything draggable or reversible — only a MotionValue can
 * be caught mid-flight and reversed from its live on-screen value.
 */
export const SPRING = {
  /** Critically damped default — no overshoot. Menus, repositions, settles. */
  default: { type: 'spring', bounce: 0, duration: 0.4 },
  /** Snappier settle for small UI (toggles, the travelling tab indicator). */
  snappy: { type: 'spring', bounce: 0, duration: 0.28 },
  /** Momentum interactions only — a flick/throw preceded it. Card fling, drawer. */
  momentum: { type: 'spring', bounce: 0.18, duration: 0.4 },
} as const

export type SpringPreset = keyof typeof SPRING

/**
 * Apple's velocity-projection factor: landing point ≈ x + velocity * FACTOR,
 * from `(v/1000)·d/(1−d)` with deceleration rate d = 0.998 (audit §6). Use to
 * decide a gesture's committed endpoint from release velocity, not position.
 */
export const PROJECTION_FACTOR = 0.0665
