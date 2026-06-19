"use client"

import * as React from "react"

/**
 * Form-validation standard for Podium (spec §9.3 / §9.4).
 *
 * Goals:
 *  - Inline-on-blur validation (don't shout at users while they type).
 *  - Field-specific, human-readable messages — NEVER a generic "Invalid input".
 *  - Scroll-to-first-error + focus on submit failure.
 *  - A success state (`isValid`) callers can use to show confirmation.
 *  - Accessibility baseline: stable ids, `aria-invalid`, `aria-describedby`.
 *
 * A `Validator` returns `null` when the value is acceptable, or a complete
 * human-readable sentence describing what to fix.
 */
export type Validator = (value: string) => string | null

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Field is required — message names the field so it is never generic. */
export function required(label: string): Validator {
  return (value) => (value.trim().length === 0 ? `${label} is required` : null)
}

/** Minimum length. Empty values pass (use `required` to forbid empty). */
export function minLength(label: string, min: number): Validator {
  return (value) =>
    value.length > 0 && value.length < min
      ? `${label} must be at least ${min} characters`
      : null
}

/** Maximum length. */
export function maxLength(label: string, max: number): Validator {
  return (value) =>
    value.length > max ? `${label} must be ${max} characters or fewer` : null
}

/** Valid email address. Empty passes (compose with `required` if mandatory). */
export function email(): Validator {
  return (value) =>
    value.trim().length > 0 && !EMAIL_RE.test(value.trim())
      ? "Please enter a valid email address"
      : null
}

/** Valid absolute URL. Empty passes. */
export function url(): Validator {
  return (value) => {
    const trimmed = value.trim()
    if (trimmed.length === 0) return null
    try {
      const parsed = new URL(trimmed)
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "Please enter a valid URL (including https://)"
      }
      return null
    } catch {
      return "Please enter a valid URL (including https://)"
    }
  }
}

/** Run validators in order; return the first failing message, else null. */
export function composeValidators(...validators: Validator[]): Validator {
  return (value) => {
    for (const validate of validators) {
      const message = validate(value)
      if (message) return message
    }
    return null
  }
}

export interface FieldConfig {
  /** Current value of the field (controlled by the caller). */
  value: string
  /** Validator producing a field-specific message, or null when valid. */
  validate?: Validator
}

export type FieldsConfig = Record<string, FieldConfig>

export interface FieldProps {
  id: string
  name: string
  "aria-invalid": boolean
  "aria-describedby": string | undefined
  onBlur: () => void
}

export interface UseFieldValidationResult<K extends string> {
  errors: Partial<Record<K, string>>
  touched: Partial<Record<K, true>>
  /** True when every configured field currently passes validation. */
  isValid: boolean
  handleBlur: (name: K) => void
  /** Validate every field, mark all touched, scroll/focus first error. Returns true if valid. */
  validateAll: () => boolean
  /** Spread onto an input/select for accessible wiring. */
  getFieldProps: (name: K) => FieldProps
  /** Stable id used for the field's error message element. */
  errorId: (name: K) => string
}

function fieldId(name: string): string {
  return `field-${name}`
}

function errorElementId(name: string): string {
  return `field-${name}-error`
}

/**
 * Inline-on-blur validation hook. Validation runs lazily: a field is only
 * marked with an error after it has been blurred (or after `validateAll`).
 */
export function useFieldValidation<K extends string>(
  fields: Record<K, FieldConfig>
): UseFieldValidationResult<K> {
  const [touched, setTouched] = React.useState<Partial<Record<K, true>>>({})

  // Keep the latest config in a ref so callbacks stay stable across renders.
  const fieldsRef = React.useRef(fields)
  fieldsRef.current = fields

  const computeError = React.useCallback((name: K): string | undefined => {
    const config = fieldsRef.current[name]
    if (!config?.validate) return undefined
    return config.validate(config.value) ?? undefined
  }, [])

  // Errors are derived for touched fields on every render.
  const errors = React.useMemo(() => {
    const out: Partial<Record<K, string>> = {}
    for (const name of Object.keys(fields) as K[]) {
      if (touched[name]) {
        const message = computeError(name)
        if (message) out[name] = message
      }
    }
    return out
    // `fields` values change on each keystroke; that is intentional so a
    // touched field's error clears as soon as the value becomes valid.
  }, [fields, touched, computeError])

  const isValid = React.useMemo(() => {
    for (const name of Object.keys(fields) as K[]) {
      if (computeError(name)) return false
    }
    return true
  }, [fields, computeError])

  const handleBlur = React.useCallback((name: K) => {
    setTouched((prev) => (prev[name] ? prev : { ...prev, [name]: true }))
  }, [])

  const validateAll = React.useCallback((): boolean => {
    const names = Object.keys(fieldsRef.current) as K[]
    const allTouched: Partial<Record<K, true>> = {}
    let firstInvalid: K | null = null
    for (const name of names) {
      allTouched[name] = true
      if (firstInvalid === null && computeError(name)) {
        firstInvalid = name
      }
    }
    setTouched(allTouched)

    if (firstInvalid !== null) {
      if (typeof document !== "undefined") {
        const el = document.getElementById(fieldId(firstInvalid))
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" })
          if (typeof (el as HTMLElement).focus === "function") {
            ;(el as HTMLElement).focus({ preventScroll: true })
          }
        }
      }
      return false
    }
    return true
  }, [computeError])

  const getFieldProps = React.useCallback(
    (name: K): FieldProps => {
      const hasError = Boolean(touched[name] && computeError(name))
      return {
        id: fieldId(name),
        name,
        "aria-invalid": hasError,
        "aria-describedby": hasError ? errorElementId(name) : undefined,
        onBlur: () => handleBlur(name),
      }
    },
    [touched, computeError, handleBlur]
  )

  const errorId = React.useCallback((name: K) => errorElementId(name), [])

  return {
    errors,
    touched,
    isValid,
    handleBlur,
    validateAll,
    getFieldProps,
    errorId,
  }
}
