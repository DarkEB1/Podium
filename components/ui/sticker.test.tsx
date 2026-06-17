import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { Sticker } from "./sticker"

describe("Sticker", () => {
  it("renders its label text", () => {
    render(<Sticker>Most popular</Sticker>)
    expect(screen.getByText("Most popular")).toBeInTheDocument()
  })

  it("is an accent pill with ink border and hard shadow", () => {
    const { container } = render(<Sticker>Featured</Sticker>)
    const el = container.firstElementChild as HTMLElement
    const cls = el.getAttribute("class") ?? ""
    expect(cls).toContain("bg-accent")
    expect(cls).toContain("text-accent-foreground")
    expect(cls).toContain("border-border-ink")
    expect(cls).toContain("shadow-card")
  })

  it("is rotated by default and exposes a rotate prop", () => {
    const { container } = render(<Sticker>Hot</Sticker>)
    const def = container.firstElementChild as HTMLElement
    // default tilt applied as an inline rotation
    expect(def.style.transform).toContain("rotate(-3deg)")

    const { container: c2 } = render(<Sticker rotate={5}>Hot</Sticker>)
    const rotated = c2.firstElementChild as HTMLElement
    expect(rotated.style.transform).toContain("rotate(5deg)")
  })

  it("merges a custom className", () => {
    const { container } = render(<Sticker className="custom-x">Hi</Sticker>)
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute("class")).toContain("custom-x")
  })
})
