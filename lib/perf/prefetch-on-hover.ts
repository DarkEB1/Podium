"use client"

import { useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

/**
 * Intent delay before prefetching a hovered/focused link (spec §10.3.3).
 * 300ms filters out incidental pointer passes so we only prefetch routes the
 * user is genuinely heading toward.
 */
export const PREFETCH_HOVER_DELAY_MS = 300

export interface PrefetchOnHoverHandlers {
  onMouseEnter: () => void
  onMouseLeave: () => void
  onFocus: () => void
  onBlur: () => void
}

/**
 * usePrefetchOnHover — returns spreadable handlers that prefetch `href` after a
 * sustained 300ms hover or keyboard focus, cancelling if the pointer leaves
 * first and prefetching at most once. Keyboard focus is wired for a11y parity so
 * keyboard users get the same perceived speed as mouse users.
 */
export function usePrefetchOnHover(
  href: string | null | undefined,
): PrefetchOnHoverHandlers {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const done = useRef(false)

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const schedule = useCallback(() => {
    if (!href || done.current || timer.current !== null) return
    timer.current = setTimeout(() => {
      timer.current = null
      done.current = true
      router.prefetch(href)
    }, PREFETCH_HOVER_DELAY_MS)
  }, [href, router])

  // A new href is a new prefetch target.
  useEffect(() => {
    done.current = false
    return clear
  }, [href, clear])

  return {
    onMouseEnter: schedule,
    onMouseLeave: clear,
    onFocus: schedule,
    onBlur: clear,
  }
}
