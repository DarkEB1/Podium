'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * ThemeToggle — flips between the light and dark token sets.
 *
 * NX-2: this used to read `theme`, which is `"system"` on a fresh visit, so the
 * first click produced `"dark"` from a light page and the *second* click did
 * nothing sensible. It now switches off `resolvedTheme` (the theme actually
 * painted) and writes an explicit light/dark preference that next-themes
 * persists to localStorage.
 *
 * Until mount, `resolvedTheme` is undefined on the client and unknowable on the
 * server, so we render a non-interactive placeholder of the same size. That
 * avoids a hydration mismatch and any flash of the wrong icon — the *page*
 * itself never flashes because next-themes' pre-hydration script sets the class
 * before first paint.
 */
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === 'dark'

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-hidden="true"
        tabIndex={-1}
        disabled
        className="opacity-0"
      >
        <Sun className="size-4" aria-hidden="true" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={isDark}
      data-testid="theme-toggle"
    >
      {isDark ? (
        <Moon className="size-4" aria-hidden="true" />
      ) : (
        <Sun className="size-4" aria-hidden="true" />
      )}
    </Button>
  )
}
