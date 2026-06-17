import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { AccentHeading } from "./accent-heading"

describe("AccentHeading", () => {
  it("renders the heading text", () => {
    render(<AccentHeading>Your dashboard</AccentHeading>)
    expect(screen.getByText("Your dashboard")).toBeInTheDocument()
  })

  it("renders an h2 by default and honours the `as` level", () => {
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

  it("renders a decorative accent swipe behind the text", () => {
    const { container } = render(<AccentHeading>Hi</AccentHeading>)
    const swipe = container.querySelector('[data-slot="accent-swipe"]') as HTMLElement
    expect(swipe).not.toBeNull()
    expect(swipe.getAttribute("aria-hidden")).toBe("true")
    expect(swipe.getAttribute("class") ?? "").toContain("bg-accent")
  })

  it("merges a custom className on the heading", () => {
    const { container } = render(
      <AccentHeading className="custom-z">Hi</AccentHeading>
    )
    const heading = container.querySelector("h2") as HTMLElement
    expect(heading.getAttribute("class")).toContain("custom-z")
  })
})
