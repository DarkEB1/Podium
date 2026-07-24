"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  flagEmoji,
  type Country,
} from "@/lib/data/countries"

export type CountrySelectProps = {
  value: string | null
  onChange: (iso: string) => void
  id?: string
  className?: string
  "aria-label"?: string
}

export function CountrySelect({
  value,
  onChange,
  id,
  className,
  "aria-label": ariaLabel = "Country",
}: CountrySelectProps) {
  const code = value ?? DEFAULT_COUNTRY

  const selected = React.useMemo<Country | null>(
    () => COUNTRIES.find((c) => c.code === code) ?? null,
    [code]
  )

  const handleValueChange = React.useCallback(
    (next: Country | null) => {
      if (next) onChange(next.code)
    },
    [onChange]
  )

  return (
    <ComboboxPrimitive.Root
      items={COUNTRIES as Country[]}
      value={selected}
      onValueChange={handleValueChange}
      itemToStringLabel={(c: Country) => c.name}
      itemToStringValue={(c: Country) => c.code}
    >
      <div className={cn("relative", className)}>
        {selected ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-medium"
          >
            {flagEmoji(selected.code)}
          </span>
        ) : null}
        <ComboboxPrimitive.Input
          id={id}
          aria-label={ariaLabel}
          placeholder="Select a country"
          data-slot="country-select-input"
          className={cn(
            "flex h-9 w-full items-center rounded-lg border border-input bg-transparent py-2 pr-9 text-medium transition-colors outline-none",
            "placeholder:text-muted-foreground",
            "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            selected ? "pl-9" : "pl-3"
          )}
        />
        <ComboboxPrimitive.Trigger
          aria-label="Open"
          className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground"
        >
          <ChevronDownIcon className="size-4" />
        </ComboboxPrimitive.Trigger>
      </div>

      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner sideOffset={4} className="isolate z-50">
          <ComboboxPrimitive.Popup
            data-slot="country-select-content"
            className={cn(
              "max-h-[min(20rem,var(--available-height))] w-[var(--anchor-width)] min-w-[14rem]",
              "overflow-y-auto rounded-lg bg-card p-1 text-foreground shadow-[var(--shadow-card)] ring-1 ring-foreground/10"
            )}
          >
            <ComboboxPrimitive.Empty className="px-3 py-2 text-small text-muted-foreground">
              No countries found
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List>
              {(country: Country) => (
                <ComboboxPrimitive.Item
                  key={country.code}
                  value={country}
                  className={cn(
                    "relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-medium outline-none select-none",
                    "data-highlighted:bg-accent/15 data-highlighted:text-foreground"
                  )}
                >
                  <span aria-hidden="true">{flagEmoji(country.code)}</span>
                  <span className="flex-1 truncate">{country.name}</span>
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
