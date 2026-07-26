'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import type { BrowseMode } from '@/components/ui/browse-mode-toggle'
import { ROUTES } from '@/lib/routes'

/**
 * Browse-mode state for the discovery surfaces (PR-23).
 *
 * The preference is a real column — `discovery_ui_mode public.ui_mode not null
 * default 'marketplace'` on every profile table
 * (supabase/migrations/20260419000002_profiles.sql) — so the server component
 * reads it and hands it in as `initialMode`, and the toggle writes it back
 * through `PATCH /api/profiles/me`. `discovery_ui_mode` is not in
 * `PROTECTED_FIELDS`, so the existing profile route accepts it; no new endpoint.
 *
 * A failed write never reverts the view: the user asked for this mode and
 * should get it. It only means the choice will not survive a reload, which is
 * what the toast says.
 */
export function useBrowseMode(initialMode: BrowseMode): {
  mode: BrowseMode
  setMode: (mode: BrowseMode) => void
  pending: boolean
} {
  const [mode, setModeState] = useState<BrowseMode>(initialMode)
  const [pending, setPending] = useState(false)

  const setMode = useCallback(
    (next: BrowseMode) => {
      // Read from state, not an updater callback: the persist call is a side
      // effect and must not run twice under StrictMode's double invocation.
      if (next === mode) return
      setModeState(next)
      setPending(true)
      void fetch(ROUTES.api.profiles.me, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discovery_ui_mode: next }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('preference not saved')
        })
        .catch(() => {
          toast.error('We could not save your browse preference — it will reset next visit.')
        })
        .finally(() => setPending(false))
    },
    [mode]
  )

  return { mode, setMode, pending }
}
