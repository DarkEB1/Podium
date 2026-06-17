import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { Sticker } from "./sticker"

describe("Sticker", () => {
  it("renders its label text", () => {
    render(<Sticker>Most popular</Sticker>)
    expect(screen.getByText("Most popular")).toBeInTheDocument()
  })

  it("is a flat, upright accent pill with a soft look (no rotation)", () => {
    const { container } = render(<Sticker>Featured</Sticker>)
    const el = container.firstElementChild as HTMLElement
    const cls = el.getAttribute("class") ?? ""
    expect(cls).toContain("bg-accent")
    expect(cls).toContain("text-accent-foreground")
    expect(cls).toContain("rounded-full")
    expect(cls).not.toContain("border-border-ink")
    expect(cls).not.toMatch(/shadow-\[/)
    expect(el.style.transform ?? "").not.toContain("rotate")
  })

  it("ignores any rotate prop and stays upright (back-compat API)", () => {
    const { container } = render(<Sticker rotate={5}>Hot</Sticker>)
    const el = container.firstElementChild as HTMLElement
    expect(el.style.transform ?? "").not.toContain("rotate")
  })

  it("merges a custom className", () => {
    const { container } = render(<Sticker className="custom-x">Hi</Sticker>)
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute("class")).toContain("custom-x")
  })
})
