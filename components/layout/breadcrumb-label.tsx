'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'

/**
 * Breadcrumb label override — lets a server page replace the LAST breadcrumb's
 * derived label with real display data.
 *
 * `buildBreadcrumbs` (lib/nav/config.ts) can only humanise path segments, so a
 * dynamic route like `/athlete/profile/[userId]` would otherwise surface the
 * raw UUID (or the generic "Profile" fallback) in the trail. A page that knows
 * the record's display name renders `<BreadcrumbLabel label={name} />` anywhere
 * in its tree; NavShell reads the override through context and applies it to
 * the final crumb.
 *
 * The override is keyed by the pathname it was registered under, so during a
 * navigation a stale label can never attach itself to the next page's trail.
 */

interface BreadcrumbLabelOverride {
  pathname: string
  label: string
}

type SetOverride = React.Dispatch<React.SetStateAction<BreadcrumbLabelOverride | null>>

interface BreadcrumbLabelContextValue {
  override: BreadcrumbLabelOverride | null
  setOverride: SetOverride
}

const BreadcrumbLabelContext = React.createContext<BreadcrumbLabelContextValue | null>(null)

export function BreadcrumbLabelProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = React.useState<BreadcrumbLabelOverride | null>(null)
  const value = React.useMemo(() => ({ override, setOverride }), [override])
  return (
    <BreadcrumbLabelContext.Provider value={value}>{children}</BreadcrumbLabelContext.Provider>
  )
}

/** The label registered for `pathname`'s last crumb, or null when none is. */
export function useBreadcrumbLabelOverride(pathname: string): string | null {
  const ctx = React.useContext(BreadcrumbLabelContext)
  const override = ctx?.override ?? null
  return override && override.pathname === pathname ? override.label : null
}

/**
 * Render-nothing client island a server page drops into its tree to name the
 * current pathname's final breadcrumb.
 */
export function BreadcrumbLabel({ label }: { label: string }) {
  const pathname = usePathname()
  const ctx = React.useContext(BreadcrumbLabelContext)
  const setOverride = ctx?.setOverride

  React.useEffect(() => {
    if (!setOverride) return
    setOverride({ pathname, label })
    return () => {
      // Clear only our own registration: during a route change the incoming
      // page's effect may already have registered its label by the time this
      // cleanup runs, and that newer override must survive.
      setOverride((current) =>
        current && current.pathname === pathname && current.label === label ? null : current,
      )
    }
  }, [setOverride, pathname, label])

  return null
}
