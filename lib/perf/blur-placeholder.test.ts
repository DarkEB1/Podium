import { describe, it, expect } from "vitest"

import { solidBlurDataURL, DEFAULT_BLUR_RGB } from "./blur-placeholder"

function decode(url: string): string {
  const payload = url.split(",")[1]
  expect(payload).toBeDefined()
  // Narrowed by the assertion above; data URLs always have a payload segment.
  return Buffer.from(payload as string, "base64").toString("utf8")
}

describe("solidBlurDataURL", () => {
  it("returns a base64 SVG data URL usable as BlurImage blurDataURL", () => {
    const url = solidBlurDataURL()
    expect(url.startsWith("data:image/svg+xml;base64,")).toBe(true)

    const decoded = decode(url)
    expect(decoded).toContain("<svg")
    expect(decoded).toContain("<rect")
  })

  it("defaults to the light-mode placeholder surface tint", () => {
    const decoded = decode(solidBlurDataURL())
    expect(decoded).toContain(DEFAULT_BLUR_RGB)
  })

  it("embeds a custom rgb tint when provided", () => {
    const decoded = decode(solidBlurDataURL("rgb(10,20,30)"))
    expect(decoded).toContain("rgb(10,20,30)")
  })

  it("is deterministic for the same input", () => {
    expect(solidBlurDataURL("rgb(1,2,3)")).toBe(solidBlurDataURL("rgb(1,2,3)"))
  })
})
