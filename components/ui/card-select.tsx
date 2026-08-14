"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface CardSelectOption {
  value: string
  label: string
  description?: string
  icon?: React.ReactNode
}

export interface CardSelectGroupProps {
  options: CardSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  multiple?: boolean
  max?: number
  maxError?: string
  className?: string
}

export function CardSelectGroup({
  options,
  value,
  onChange,
  multiple = false,
  max,
  maxError,
  className,
}: CardSelectGroupProps) {
  const [showMaxError, setShowMaxError] = React.useState(false)
  const errorId = React.useId()

  function handleSelect(optionValue: string) {
    const isSelected = value.includes(optionValue)

    if (!multiple) {
      // Single-select: toggle the one tile; selecting another replaces.
      onChange(isSelected ? [] : [optionValue])
      return
    }

    if (isSelected) {
      // Deselect is always allowed, even at max.
      setShowMaxError(false)
      onChange(value.filter((v) => v !== optionValue))
      return
    }

    if (typeof max === "number" && value.length >= max) {
      setShowMaxError(true)
      return
    }

    setShowMaxError(false)
    onChange([...value, optionValue])
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Intrinsic (container-driven) columns: viewport breakpoints lied inside
          narrow containers (e.g. the ~344px settings column at tablet widths),
          forcing three squashed columns. auto-fill sizes to the actual row. */}
      <div role="group" className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
        {options.map((option) => {
          const selected = value.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              role="button"
              aria-pressed={selected}
              onClick={() => handleSelect(option.value)}
              className={cn(
                "pressable group flex flex-col items-start gap-2 rounded-2xl border bg-card p-4 text-left shadow-sm outline-none transition-shadow sm:p-5",
                "hover:-translate-y-0.5 hover:shadow-lg",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                selected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/30"
              )}
            >
              {option.icon ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-8 items-center justify-center",
                    selected ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {option.icon}
                </span>
              ) : null}
              <span className="text-medium font-medium text-foreground">
                {option.label}
              </span>
              {option.description ? (
                <span className="text-small text-muted-foreground">
                  {option.description}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      {showMaxError && maxError ? (
        <p id={errorId} role="alert" className="text-small text-destructive">
          {maxError}
        </p>
      ) : null}
    </div>
  )
}
