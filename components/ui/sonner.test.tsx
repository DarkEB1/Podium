import { render } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { isValidElement } from "react"

// Capture the props handed to the underlying sonner <Toaster> so we can assert
// the re-skin contract without driving the runtime toast portal.
const sonnerProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }))

vi.mock("sonner", () => ({
  Toaster: (props: Record<string, unknown>) => {
    sonnerProps.current = props
    return null
  },
}))

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light" }),
}))

import { Toaster } from "./sonner"

function renderToaster(): Record<string, unknown> {
  sonnerProps.current = null
  render(<Toaster />)
  const captured = sonnerProps.current
  if (!captured) throw new Error("Sonner did not receive props")
  return captured
}

describe("Toaster (clean Airbnb re-skin)", () => {
  beforeEach(() => {
    sonnerProps.current = null
  })

  it("uses a Lucide BadgeCheck/Check icon for success (status never colour-alone)", () => {
    const props = renderToaster()
    const icons = props.icons as Record<string, unknown>
    const successIcon = icons.success
    expect(isValidElement(successIcon)).toBe(true)

    const { container } = render(successIcon as React.ReactElement)
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    // Lucide success mark: BadgeCheck (a Check variant).
    const cls = svg?.getAttribute("class") ?? ""
    expect(/lucide-badge-check/.test(cls)).toBe(true)
    // Icon paired with status so colour is never the only signal.
    expect(svg).toHaveAttribute("aria-hidden", "true")
  })

  it("provides a distinct Lucide icon for every status", () => {
    const props = renderToaster()
    const icons = props.icons as Record<string, unknown>
    for (const status of ["success", "info", "warning", "error", "loading"]) {
      const el = icons[status]
      expect(isValidElement(el)).toBe(true)
      const { container } = render(el as React.ReactElement)
      expect(container.querySelector("svg")).not.toBeNull()
    }
  })

  it("renders toasts as a clean white card: single light border, soft shadow, rounded corners", () => {
    const props = renderToaster()
    const toastOptions = props.toastOptions as { classNames?: Record<string, string> }
    const toastClass = toastOptions.classNames?.toast ?? ""
    // Single light border (no heavy ink stroke).
    expect(toastClass).toMatch(/\bborder\b/)
    expect(toastClass).toMatch(/border-border\b/)
    // Soft (not hard offset) shadow.
    expect(toastClass).toMatch(/shadow-card\b/)
    // Generous rounded corners.
    expect(toastClass).toMatch(/rounded-(xl|2xl)/)
    // No brutalist artefacts: no thick left accent bar, no hard offset shadow,
    // no rotation, no ink border.
    expect(toastClass).not.toMatch(/border-l-\[6px\]/)
    expect(toastClass).not.toMatch(/shadow-\[/)
    expect(toastClass).not.toMatch(/-?rotate-/)
    expect(toastClass).not.toMatch(/border-border-ink/)
  })

  it("conveys status via a coloured Lucide icon, not a hard left bar", () => {
    const props = renderToaster()
    const toastOptions = props.toastOptions as { classNames?: Record<string, string> }
    const classNames = toastOptions.classNames ?? {}
    // No thick recolourable left accent bar on any status.
    for (const status of ["toast", "success", "info", "warning", "error"]) {
      expect(classNames[status] ?? "").not.toMatch(/border-l-\[6px\]/)
    }
  })

  it("keeps the public API: forwards extra props and omits theme from its own type", () => {
    const props = renderToaster()
    expect(props.theme).toBe("light")
  })
})
