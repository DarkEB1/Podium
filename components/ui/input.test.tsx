import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { Input } from "./input"

describe("Input", () => {
  it("renders with an ink border and no soft ring", () => {
    render(<Input aria-label="Email" />)
    const input = screen.getByLabelText("Email")
    expect(input.className).toContain("border-border-ink")
    // Soft ring replaced by the hard focus shadow.
    expect(input.className).not.toMatch(/ring-ring/)
  })

  it("throws the focus shadow and primary border on focus-visible", () => {
    render(<Input aria-label="Email" />)
    const input = screen.getByLabelText("Email")
    expect(input.className).toContain("focus-visible:shadow-focus")
    expect(input.className).toContain("focus-visible:border-primary")
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
