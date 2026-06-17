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
      <div role="group" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                "pressable group flex flex-col items-start gap-1 rounded-xl border-[length:--border-ink-width] bg-card p-4 text-left outline-none",
                "focus-visible:ring-3 focus-visible:ring-ring/50",
                selected
                  ? "border-border-ink bg-accent/20 shadow-press"
                  : "border-transparent hover:border-border-ink/40"
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
