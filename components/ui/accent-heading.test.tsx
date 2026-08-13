import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { AccentHeading } from "./accent-heading"

describe("AccentHeading", () => {
  it("renders the heading text", () => {
    render(<AccentHeading>Your dashboard</AccentHeading>)
    expect(screen.getByText("Your dashboard")).toBeInTheDocument()
  })

  it("renders an h2 by default and honours the as-level prop", () => {
    const { rerender } = render(<AccentHeading>Title</AccentHeading>)
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument()

    rerender(<AccentHeading as="h1">Title</AccentHeading>)
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
  })

  it("uses the heading font", () => {
    const { container } = render(<AccentHeading>Hi</AccentHeading>)
    const heading = container.querySelector("h2") as HTMLElement
    expect(heading.getAttribute("class") ?? "").toContain("font-heading")
  })

  it("renders a subtle decorative accent dot, not a highlighter swipe", () => {
    const { container } = render(<AccentHeading>Hi</AccentHeading>)
    const dot = container.querySelector('[data-slot="accent-dot"]') as HTMLElement
    expect(dot).not.toBeNull()
    expect(dot.getAttribute("aria-hidden")).toBe("true")
    // Brand lime accent dot (landing-feel sweep 2026-08): the section-heading
    // marker carries the lime brand accent, not the old neutral grey.
    expect(dot.getAttribute("class") ?? "").toContain("bg-lime")
    expect(container.querySelector('[data-slot="accent-swipe"]')).toBeNull()
  })

  it("merges a custom className on the heading", () => {
    const { container } = render(
      <AccentHeading className="custom-z">Hi</AccentHeading>
    )
    const heading = container.querySelector("h2") as HTMLElement
    expect(heading.getAttribute("class")).toContain("custom-z")
  })
})
