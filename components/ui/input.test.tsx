import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { Input } from "./input"

describe("Input", () => {
  it("renders with a clean light border and no hard ink border", () => {
    render(<Input aria-label="Email" />)
    const input = screen.getByLabelText("Email")
    expect(input.className).toContain("border-border")
    expect(input.className).not.toMatch(/border-border-ink/)
    expect(input.className).not.toMatch(/border-foreground\b/)
  })

  it("uses a soft focus ring, not the hard offset focus shadow", () => {
    render(<Input aria-label="Email" />)
    const input = screen.getByLabelText("Email")
    expect(input.className).toContain("focus-visible:ring-2")
    expect(input.className).toContain("focus-visible:ring-primary/40")
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
