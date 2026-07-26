"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type ComboboxOption = {
  value: string
  label: string
  icon?: React.ReactNode
}

export type ComboboxProps = {
  options: ComboboxOption[]
  value: string | null
  onChange: (value: string) => void
  placeholder?: string | undefined
  /** Show a type-to-filter input. Defaults to true. */
  searchable?: boolean | undefined
  /** Allow selecting a free-text value that is not in `options`. */
  allowCreate?: boolean | undefined
  className?: string | undefined
  id?: string | undefined
  "aria-label"?: string | undefined
  /**
   * PR-17 — controlled popup state. Pass `open`/`onOpenChange` (e.g. from
   * `useFilterDisclosure`) so a parent can enforce one-filter-open-at-a-time.
   * Leave both undefined for the uncontrolled default.
   */
  open?: boolean | undefined
  onOpenChange?: ((open: boolean) => void) | undefined
  defaultOpen?: boolean | undefined
}

/** Sentinel prefixed to a free-text value so we can recognise create entries. */
const CREATE_PREFIX = "create:"

export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  searchable = true,
  allowCreate = false,
  className,
  id,
  "aria-label": ariaLabel,
  open,
  onOpenChange,
  defaultOpen,
}: ComboboxProps) {
  const [query, setQuery] = React.useState("")

  const selected = React.useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  )

  // Base UI filters `items` internally against the input value. When
  // allowCreate is on and the query matches no existing option, append a
  // synthetic "create" option carrying the raw query.
  const items = React.useMemo<ComboboxOption[]>(() => {
    const trimmed = query.trim()
    if (!allowCreate || trimmed === "") return options
    const exists = options.some(
      (o) => o.label.toLowerCase() === trimmed.toLowerCase()
    )
    if (exists) return options
    return [
      ...options,
      { value: `${CREATE_PREFIX}${trimmed}`, label: `Create "${trimmed}"` },
    ]
  }, [options, allowCreate, query])

  // The create option must always survive filtering, so disable Base UI's
  // internal filter when allowCreate is active and filter the real options here.
  const filteredItems = React.useMemo<ComboboxOption[]>(() => {
    if (!allowCreate) return items
    const trimmed = query.trim().toLowerCase()
    if (trimmed === "") return items
    return items.filter(
      (o) =>
        o.value.startsWith(CREATE_PREFIX) ||
        o.label.toLowerCase().includes(trimmed)
    )
  }, [items, allowCreate, query])

  const handleValueChange = React.useCallback(
    (next: ComboboxOption | null) => {
      if (!next) return
      if (next.value.startsWith(CREATE_PREFIX)) {
        onChange(next.value.slice(CREATE_PREFIX.length))
      } else {
        onChange(next.value)
      }
      setQuery("")
    },
    [onChange]
  )

  return (
    <ComboboxPrimitive.Root
      items={allowCreate ? filteredItems : options}
      value={selected}
      onValueChange={handleValueChange}
      onInputValueChange={setQuery}
      // When allowCreate filters locally, disable internal filtering.
      filter={allowCreate ? null : undefined}
      // PR-17 — only pass the controlled props when the caller supplied them,
      // otherwise Base UI would treat `open={undefined}` as controlled-and-closed.
      {...(open !== undefined ? { open } : {})}
      {...(onOpenChange !== undefined ? { onOpenChange } : {})}
      {...(defaultOpen !== undefined ? { defaultOpen } : {})}
    >
      <div className={cn("relative", className)}>
        <ComboboxPrimitive.Input
          id={id}
          aria-label={ariaLabel}
          placeholder={placeholder}
          readOnly={!searchable}
          data-slot="combobox-input"
          className={cn(
            "flex h-10 w-full min-w-0 items-center rounded-xl border border-input bg-card py-2 pr-9 pl-3.5 text-medium shadow-sm transition-[color,box-shadow,border-color] outline-none",
            "placeholder:text-muted-foreground",
            "hover:border-foreground/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !searchable && "cursor-pointer"
          )}
        />
        <ComboboxPrimitive.Trigger
          aria-label="Open"
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
        >
          <ChevronDownIcon className="size-4" />
        </ComboboxPrimitive.Trigger>
      </div>

      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner sideOffset={4} className="isolate z-[100]">
          <ComboboxPrimitive.Popup
            data-slot="combobox-content"
            className={cn(
              "max-h-[min(20rem,var(--available-height))] w-[var(--anchor-width)] min-w-[12rem]",
              "overflow-y-auto rounded-xl border border-border bg-card p-1.5 text-foreground shadow-lg"
            )}
          >
            <ComboboxPrimitive.Empty className="px-3 py-2 text-small text-muted-foreground">
              No results found
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List>
              {(item: ComboboxOption) => (
                <ComboboxPrimitive.Item
                  key={item.value}
                  value={item}
                  className={cn(
                    "relative flex w-full cursor-default items-center gap-2 rounded-lg py-2 pr-8 pl-2.5 text-medium outline-none select-none",
                    "data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:ring-2 data-highlighted:ring-inset data-highlighted:ring-ring"
                  )}
                >
                  {item.icon}
                  <span className="flex-1 truncate">{item.label}</span>
                  <ComboboxPrimitive.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center">
                    <CheckIcon className="size-4" />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  )
}
