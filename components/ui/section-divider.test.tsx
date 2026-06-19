import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { SectionDivider } from "./section-divider"

describe("SectionDivider", () => {
  it("renders the optional soft label", () => {
    render(<SectionDivider label="Your shortlist" />)
    expect(screen.getByText("Your shortlist")).toBeInTheDocument()
  })

  it("renders a light hairline rule alongside the label", () => {
    const { container } = render(<SectionDivider label="Deals" />)
    const rule = container.querySelector('[data-slot="divider-rule"]')
    expect(rule).not.toBeNull()
    const cls = rule?.getAttribute("class") ?? ""
    expect(cls).toContain("h-px")
    expect(cls).toContain("bg-border")
  })

  it("the label is a soft, borderless muted eyebrow", () => {
    const { container } = render(<SectionDivider label="Stats" />)
    const chip = container.querySelector('[data-slot="divider-label"]') as HTMLElement
    const cls = chip.getAttribute("class") ?? ""
    expect(cls).not.toContain("border-border-ink")
    expect(cls).not.toContain("bg-foreground")
    expect(cls).toContain("text-muted-foreground")
  })

  it("renders just the hairline when no label is given", () => {
    const { container } = render(<SectionDivider />)
    expect(container.querySelector('[data-slot="divider-label"]')).toBeNull()
    expect(container.querySelector('[data-slot="divider-rule"]')).not.toBeNull()
  })

  it("merges a custom className on the root", () => {
    const { container } = render(
      <SectionDivider label="X" className="custom-y" />
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute("class")).toContain("custom-y")
  })
})
