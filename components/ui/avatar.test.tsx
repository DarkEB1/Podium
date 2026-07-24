import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { UserAvatar, initialsFrom, PLACEHOLDER_AVATAR_SRC } from "./avatar"

describe("initialsFrom", () => {
  it("takes up to two initials", () => {
    expect(initialsFrom("Jane Doe")).toBe("JD")
    expect(initialsFrom("jane amelia doe")).toBe("JA")
    expect(initialsFrom("cher")).toBe("C")
  })

  it("returns an empty string for missing names", () => {
    expect(initialsFrom(null)).toBe("")
    expect(initialsFrom(undefined)).toBe("")
    expect(initialsFrom("   ")).toBe("")
  })
})

describe("UserAvatar (B-5)", () => {
  it("never renders a photo <img> when src is null — the initials show instead", () => {
    const { container } = render(<UserAvatar src={null} name="Jane Doe" />)
    expect(container.querySelector('[data-slot="avatar-image"]')).toBeNull()
    expect(screen.getByText("JD")).toBeInTheDocument()
  })

  it("degrades to initials when the photo fails to load", () => {
    const { container } = render(<UserAvatar src="/broken.jpg" name="Jane Doe" />)
    const img = container.querySelector('[data-slot="avatar-image"]') as HTMLImageElement
    fireEvent.error(img)
    expect(container.querySelector('[data-slot="avatar-image"]')).toBeNull()
    expect(screen.getByText("JD")).toBeInTheDocument()
  })

  it("treats an empty-string src the same as null", () => {
    const { container } = render(<UserAvatar src="" name="Jane Doe" />)
    expect(container.querySelector('[data-slot="avatar-image"]')).toBeNull()
  })

  it("falls back to the on-brand silhouette when there is no name either", () => {
    const { container } = render(<UserAvatar src={null} name={null} />)
    const img = container.querySelector("img") as HTMLImageElement
    expect(img.getAttribute("src")).toBe(PLACEHOLDER_AVATAR_SRC)
    expect(img).toHaveAttribute("aria-hidden", "true")
    expect(img.getAttribute("alt")).toBe("")
  })

  it("renders the photo when one is supplied", () => {
    render(<UserAvatar src="/photo.jpg" name="Jane Doe" />)
    // A-2: next/image rewrites src through the optimizer
    // (/_next/image?url=<encoded>&w=…), so assert the ORIGINAL source is
    // still what gets requested rather than pinning the exact rewritten URL.
    expect(screen.getByAltText("Jane Doe").getAttribute("src") ?? "").toContain(
      encodeURIComponent("/photo.jpg")
    )
  })
})
