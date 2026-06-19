import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import {
  required,
  minLength,
  maxLength,
  email,
  url,
  composeValidators,
  useFieldValidation,
} from "./validation"

describe("field validators (human-readable, field-specific messages)", () => {
  it("required() names the field and never says 'Invalid input'", () => {
    const v = required("Full name")
    expect(v("")).toBe("Full name is required")
    expect(v("   ")).toBe("Full name is required")
    expect(v("Ada")).toBeNull()
    expect(v("")).not.toBe("Invalid input")
  })

  it("minLength() states the minimum and the field", () => {
    const v = minLength("Bio", 10)
    expect(v("short")).toBe("Bio must be at least 10 characters")
    expect(v("a long enough value")).toBeNull()
  })

  it("maxLength() states the maximum and the field", () => {
    const v = maxLength("Bio", 5)
    expect(v("toolong")).toBe("Bio must be 5 characters or fewer")
    expect(v("ok")).toBeNull()
  })

  it("email() gives a specific message", () => {
    const v = email()
    expect(v("nope")).toBe("Please enter a valid email address")
    expect(v("a@b.co")).toBeNull()
  })

  it("url() gives a specific message", () => {
    const v = url()
    expect(v("not a url")).toBe("Please enter a valid URL (including https://)")
    expect(v("https://example.com")).toBeNull()
  })

  it("composeValidators() returns the first failing message, skips empty optional values", () => {
    const v = composeValidators(minLength("Bio", 3), maxLength("Bio", 10))
    expect(v("")).toBeNull() // optional: empty passes composition
    expect(v("ab")).toBe("Bio must be at least 3 characters")
    expect(v("abcdefghijk")).toBe("Bio must be 10 characters or fewer")
    expect(v("abcd")).toBeNull()
  })
})

describe("useFieldValidation", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("does not show an error before blur, then validates on blur", () => {
    const { result } = renderHook(() =>
      useFieldValidation({ name: { value: "", validate: required("Name") } })
    )
    expect(result.current.errors.name).toBeUndefined()
    expect(result.current.touched.name).toBeUndefined()

    act(() => result.current.handleBlur("name"))
    expect(result.current.errors.name).toBe("Name is required")
    expect(result.current.touched.name).toBe(true)
  })

  it("clears a field error once the value becomes valid and re-validated", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) =>
        useFieldValidation({ name: { value, validate: required("Name") } }),
      { initialProps: { value: "" } }
    )
    act(() => result.current.handleBlur("name"))
    expect(result.current.errors.name).toBe("Name is required")

    rerender({ value: "Ada" })
    act(() => result.current.handleBlur("name"))
    expect(result.current.errors.name).toBeUndefined()
  })

  it("reports field props with accessibility attributes when invalid", () => {
    const { result } = renderHook(() =>
      useFieldValidation({ email: { value: "bad", validate: email() } })
    )
    act(() => result.current.handleBlur("email"))
    const props = result.current.getFieldProps("email")
    expect(props.id).toBe("field-email")
    expect(props["aria-invalid"]).toBe(true)
    expect(props["aria-describedby"]).toBe("field-email-error")
    expect(props.name).toBe("email")
  })

  it("validateAll returns false and marks all fields touched on submit failure", () => {
    const { result } = renderHook(() =>
      useFieldValidation({
        name: { value: "", validate: required("Name") },
        email: { value: "x", validate: email() },
      })
    )
    let ok = true
    act(() => {
      ok = result.current.validateAll()
    })
    expect(ok).toBe(false)
    expect(result.current.errors.name).toBe("Name is required")
    expect(result.current.errors.email).toBe("Please enter a valid email address")
    expect(result.current.touched.name).toBe(true)
    expect(result.current.touched.email).toBe(true)
  })

  it("scrolls to the first invalid field on submit failure", () => {
    const el = document.createElement("input")
    el.id = "field-name"
    const scrollSpy = vi.fn()
    const focusSpy = vi.fn()
    el.scrollIntoView = scrollSpy
    el.focus = focusSpy
    document.body.appendChild(el)

    const { result } = renderHook(() =>
      useFieldValidation({
        name: { value: "", validate: required("Name") },
        bio: { value: "", validate: required("Bio") },
      })
    )
    act(() => {
      result.current.validateAll()
    })
    expect(scrollSpy).toHaveBeenCalledWith(
      expect.objectContaining({ block: "center" })
    )
    expect(focusSpy).toHaveBeenCalled()
  })

  it("sets isValid true and allows a success state when all fields pass", () => {
    const { result } = renderHook(() =>
      useFieldValidation({ name: { value: "Ada", validate: required("Name") } })
    )
    let ok = false
    act(() => {
      ok = result.current.validateAll()
    })
    expect(ok).toBe(true)
    expect(result.current.isValid).toBe(true)
    expect(result.current.errors.name).toBeUndefined()
  })
})
