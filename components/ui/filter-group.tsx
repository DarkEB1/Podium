"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type FilterGroupContextValue = {
  openId: string | null
  setOpenId: (id: string | null) => void
}

const FilterGroupContext = React.createContext<FilterGroupContextValue | null>(null)

export interface FilterGroupProps extends React.ComponentProps<"div"> {
  /** Controlled id of the currently open filter. */
  openId?: string | null
  /** Fires with the newly open filter id, or null when everything closed. */
  onOpenIdChange?: (id: string | null) => void
  defaultOpenId?: string | null
}

/**
 * FilterGroup — PR-17.
 *
 * Two bugs lived in the filter bar: dropdowns painted *behind* the results, and
 * opening a second filter left the first one hanging open.
 *
 * Stacking: every popover primitive here (Select, Combobox, DropdownMenu) is
 * portalled to the document body and sits on `z-[100]`, above any grid. The
 * remaining hazard is a `transform` / `filter` / `contain` ancestor on the
 * *filter bar itself*, which would trap a non-portalled popover in a local
 * stacking context. This wrapper deliberately sets `isolate` and no transform,
 * so the bar owns one clean stacking context and nothing inside it can be
 * over-painted by a later sibling.
 *
 * Exclusivity: `useFilterDisclosure(id)` returns `{ open, onOpenChange }` to
 * spread straight onto a Select / DropdownMenu / Combobox. Only one id can be
 * open at a time; opening one closes the rest.
 */
export function FilterGroup({
  openId: controlledOpenId,
  onOpenIdChange,
  defaultOpenId = null,
  className,
  children,
  ...props
}: FilterGroupProps) {
  const [uncontrolled, setUncontrolled] = React.useState<string | null>(defaultOpenId)
  const isControlled = controlledOpenId !== undefined
  const openId = isControlled ? controlledOpenId : uncontrolled

  const setOpenId = React.useCallback(
    (id: string | null) => {
      if (!isControlled) setUncontrolled(id)
      onOpenIdChange?.(id)
    },
    [isControlled, onOpenIdChange]
  )

  const ctx = React.useMemo<FilterGroupContextValue>(
    () => ({ openId: openId ?? null, setOpenId }),
    [openId, setOpenId]
  )

  return (
    <FilterGroupContext.Provider value={ctx}>
      <div
        data-slot="filter-group"
        // `isolate` = one predictable stacking context for the bar; `relative z-20`
        // keeps the bar itself above the results grid it sits on top of.
        className={cn("relative isolate z-20 flex min-w-0 flex-wrap items-center gap-2", className)}
        {...props}
      >
        {children}
      </div>
    </FilterGroupContext.Provider>
  )
}

/**
 * Bind one filter's popup to the group. Spread the result onto any primitive
 * that takes `open` / `onOpenChange`:
 *
 * ```tsx
 * <Select {...useFilterDisclosure('sport')}>…</Select>
 * ```
 *
 * Outside a FilterGroup it returns `{}` and the primitive stays uncontrolled,
 * so the hook is safe to adopt incrementally.
 */
export function useFilterDisclosure(id: string): {
  open?: boolean
  onOpenChange?: (open: boolean) => void
} {
  const ctx = React.useContext(FilterGroupContext)

  const onOpenChange = React.useCallback(
    (next: boolean) => {
      ctx?.setOpenId(next ? id : null)
    },
    [ctx, id]
  )

  if (!ctx) return {}
  return { open: ctx.openId === id, onOpenChange }
}
