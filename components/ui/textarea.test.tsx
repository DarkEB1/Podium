import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { Textarea } from "./textarea"

describe("Textarea", () => {
  it("renders with an ink border and no soft ring", () => {
    render(<Textarea aria-label="Bio" />)
    const el = screen.getByLabelText("Bio")
    expect(el.className).toContain("border-border-ink")
    expect(el.className).not.toMatch(/ring-ring/)
  })

  it("throws the focus shadow and primary border on focus-visible", () => {
    render(<Textarea aria-label="Bio" />)
    const el = screen.getByLabelText("Bio")
    expect(el.className).toContain("focus-visible:shadow-focus")
    expect(el.className).toContain("focus-visible:border-primary")
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
