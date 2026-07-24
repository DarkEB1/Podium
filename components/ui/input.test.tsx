import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { Input } from "./input"

describe("Input", () => {
  it("renders with the accessible control boundary token (A-3), not the decorative hairline", () => {
    render(<Input aria-label="Email" />)
    const input = screen.getByLabelText("Email")
    expect(input.className).toContain("border-input")
    expect(input.className).not.toMatch(/border-border-ink/)
    // No heavy ink border: no fixed-width border and no full-opacity foreground border.
    expect(input.className).not.toMatch(/border-\[1\.5px\]/)
    expect(input.className).not.toMatch(/(?:^|\s)border-foreground(?:\s|$)/)
  })

  it("uses a visible full-opacity focus ring with an offset (A-4), not the hard offset focus shadow", () => {
    render(<Input aria-label="Email" />)
    const input = screen.getByLabelText("Email")
    expect(input.className).toContain("focus-visible:ring-2")
    expect(input.className).toContain("focus-visible:ring-ring")
    expect(input.className).not.toMatch(/shadow-focus/)
  })

  it("keeps its public props (type, placeholder, value)", () => {
    render(
      <Input type="email" placeholder="you@club.com" defaultValue="hi" aria-label="Email" />
    )
    const input = screen.getByLabelText<HTMLInputElement>("Email")
    expect(input.type).toBe("email")
    expect(input.placeholder).toBe("you@club.com")
    expect(input.value).toBe("hi")
  })
})
