import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { BlurImage } from "./blur-image"

describe("BlurImage", () => {
  it("renders an accessible image with src and alt", () => {
    render(<BlurImage src="/cover.webp" alt="Cover photo" />)
    const img = screen.getByAltText("Cover photo")
    expect(img).toHaveAttribute("src", "/cover.webp")
  })

  it("starts blurred and reveals the image once loaded (blur-up)", () => {
    render(<BlurImage src="/cover.webp" alt="Cover photo" />)
    const img = screen.getByAltText("Cover photo")
    expect(img).toHaveAttribute("data-loaded", "false")
    fireEvent.load(img)
    expect(img).toHaveAttribute("data-loaded", "true")
  })

  it("applies the dominant-colour blur placeholder when blurDataURL is given", () => {
    const { container } = render(
      <BlurImage src="/cover.webp" alt="Cover" blurDataURL="data:image/png;base64,AAAA" />
    )
    const wrap = container.querySelector('[data-slot="blur-image"]') as HTMLElement
    expect(wrap.style.backgroundImage).toContain("data:image/png;base64,AAAA")
  })

  it("merges a custom className onto the wrapper", () => {
    const { container } = render(
      <BlurImage src="/c.webp" alt="C" className="rounded-xl" />
    )
    const wrap = container.querySelector('[data-slot="blur-image"]')
    expect(wrap?.className).toContain("rounded-xl")
  })
})
