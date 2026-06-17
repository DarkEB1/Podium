import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { Textarea } from "./textarea"

describe("Textarea", () => {
  it("renders with a clean light border and no hard ink border", () => {
    render(<Textarea aria-label="Bio" />)
    const el = screen.getByLabelText("Bio")
    expect(el.className).toContain("border-border")
    expect(el.className).not.toMatch(/border-border-ink/)
    expect(el.className).not.toMatch(/border-foreground\b/)
  })

  it("uses a soft focus ring, not the hard offset focus shadow", () => {
    render(<Textarea aria-label="Bio" />)
    const el = screen.getByLabelText("Bio")
    expect(el.className).toContain("focus-visible:ring-2")
    expect(el.className).toContain("focus-visible:ring-primary/40")
    expect(el.className).not.toMatch(/shadow-focus/)
  })

  it("keeps its public props (placeholder, value, rows)", () => {
    render(
      <Textarea placeholder="Tell your story" defaultValue="hi" rows={5} aria-label="Bio" />
    )
    const el = screen.getByLabelText<HTMLTextAreaElement>("Bio")
    expect(el.placeholder).toBe("Tell your story")
    expect(el.value).toBe("hi")
    expect(el.rows).toBe(5)
  })
})
