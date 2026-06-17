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

  it("matches the new bordered card silhouette: ink border, no shadow while loading", () => {
    const { container } = render(<CardSkeleton />)
    const root = container.querySelector('[data-slot="card-skeleton"]')
    // Neo-brutalist silhouette = ink border at the locked ink-border width (plan §1.1).
    expect(root?.className).toContain("border-border-ink")
    expect(root?.className).toContain("border-[length:--border-ink-width]")
    // No hard-offset card shadow while loading — the bordered box reserves space without
    // pretending to be a settled, interactive surface.
    expect(root?.className).not.toContain("shadow-card")
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
