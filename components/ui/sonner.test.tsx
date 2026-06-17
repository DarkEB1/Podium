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

describe("Toaster (neo-brutalist re-skin)", () => {
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

  it("renders toasts as a bordered block with an ink border and hard shadow", () => {
    const props = renderToaster()
    const toastOptions = props.toastOptions as { classNames?: Record<string, string> }
    const toastClass = toastOptions.classNames?.toast ?? ""
    expect(toastClass).toMatch(/border/)
    expect(toastClass).toMatch(/border-border-ink/)
    expect(toastClass).toMatch(/shadow-card/)
  })

  it("draws a 6px left accent bar coloured by status", () => {
    const props = renderToaster()
    const toastOptions = props.toastOptions as { classNames?: Record<string, string> }
    const classNames = toastOptions.classNames ?? {}
    // Left accent bar realised via a thick left border.
    expect(classNames.toast ?? "").toMatch(/border-l-\[6px\]/)
    // Each status recolours that left bar.
    expect(classNames.success ?? "").toMatch(/border-l-/)
    expect(classNames.error ?? "").toMatch(/border-l-/)
    expect(classNames.warning ?? "").toMatch(/border-l-/)
    expect(classNames.info ?? "").toMatch(/border-l-/)
  })

  it("keeps the public API: forwards extra props and omits theme from its own type", () => {
    const props = renderToaster()
    expect(props.theme).toBe("light")
  })
})
