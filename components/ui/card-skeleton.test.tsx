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

  it("matches the clean card silhouette: soft rounded box, single light border, no hard shadow", () => {
    const { container } = render(<CardSkeleton />)
    const root = container.querySelector('[data-slot="card-skeleton"]')
    // Clean Airbnb silhouette: a softly rounded surface with a single light border.
    expect(root?.className).toContain("rounded-2xl")
    expect(root?.className).toContain("border-border")
    // No heavy ink border and no hard-offset / settled card shadow while loading —
    // the reserved frame stays calm and flat until data lands.
    expect(root?.className).not.toContain("border-border-ink")
    expect(root?.className).not.toContain("border-[length:--border-ink-width]")
    expect(root?.className).not.toContain("shadow-card")
    expect(root?.className).not.toMatch(/shadow-\[/)
  })

  it("reserves the image block at MarketplaceCard's 0.6 aspect ratio to prevent layout shift", () => {
    const { container } = render(<CardSkeleton />)
    const image = container.querySelector('[data-slot="card-skeleton-image"]')
    expect(image).not.toBeNull()
    // 0.6 ratio === aspect-[3/5]; the reserved box must carry an explicit aspect class
    expect(image?.className).toContain("aspect-[3/5]")
  })

  it("includes a visually hidden loading label", () => {
    const { getByText } = render(<CardSkeleton />)
    expect(getByText(/loading/i)).toBeInTheDocument()
  })
})
