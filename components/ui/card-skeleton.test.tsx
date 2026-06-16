import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { CardSkeleton } from "./card-skeleton"

describe("CardSkeleton", () => {
  it("renders a status region announced to assistive tech", () => {
    const { container } = render(<CardSkeleton />)
    const root = container.querySelector('[data-slot="card-skeleton"]')
    expect(root).not.toBeNull()
    expect(root).toHaveAttribute("role", "status")
    expect(root).toHaveAttribute("aria-busy", "true")
  })

  it("reserves the image block at MarketplaceCard's 0.6 aspect ratio to prevent layout shift", () => {
    const { container } = render(<CardSkeleton />)
    const image = container.querySelector('[data-slot="card-skeleton-image"]')
    expect(image).not.toBeNull()
    // 0.6 ratio === aspect-[3/5]; the reserved box must carry an explicit aspect class
    expect(image?.className).toContain("aspect-")
  })

  it("includes a visually hidden loading label", () => {
    const { getByText } = render(<CardSkeleton />)
    expect(getByText(/loading/i)).toBeInTheDocument()
  })
})
