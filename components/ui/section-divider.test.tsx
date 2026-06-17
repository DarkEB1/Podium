import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { SectionDivider } from "./section-divider"

describe("SectionDivider", () => {
  it("renders the label in a solid chip", () => {
    render(<SectionDivider label="Your shortlist" />)
    expect(screen.getByText("Your shortlist")).toBeInTheDocument()
  })

  it("renders an ink rule alongside the label chip", () => {
    const { container } = render(<SectionDivider label="Deals" />)
    // a separator role represents the rule
    const rule = container.querySelector('[data-slot="divider-rule"]')
    expect(rule).not.toBeNull()
    expect(rule?.getAttribute("class") ?? "").toContain("bg-border-ink")
  })

  it("the label chip carries an ink border and solid fill", () => {
    const { container } = render(<SectionDivider label="Stats" />)
    const chip = container.querySelector('[data-slot="divider-label"]') as HTMLElement
    const cls = chip.getAttribute("class") ?? ""
    expect(cls).toContain("border-border-ink")
    expect(cls).toContain("bg-foreground")
    expect(cls).toContain("text-background")
  })

  it("merges a custom className on the root", () => {
    const { container } = render(
      <SectionDivider label="X" className="custom-y" />
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute("class")).toContain("custom-y")
  })
})
