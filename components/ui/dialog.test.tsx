import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./dialog"

function open() {
  return render(
    <Dialog open>
      <DialogContent>
        <DialogTitle>Make your move</DialogTitle>
        <DialogDescription>Pick an athlete to back.</DialogDescription>
      </DialogContent>
    </Dialog>
  )
}

describe("DialogContent surface re-skin (C10 clean airbnb)", () => {
  it("carries a clean light border + soft shadow + rounded-2xl on the surface", () => {
    open()
    const surface = document.querySelector('[data-slot="dialog-content"]')
    expect(surface).not.toBeNull()
    const cls = surface!.className
    expect(cls).toContain("border-border")
    expect(cls).toContain("shadow-card")
    expect(cls).toContain("rounded-2xl")
    // no heavy ink border remains
    expect(cls).not.toContain("border-border-ink")
    expect(cls).not.toContain("border-ink-width")
  })

  it("keeps the v1 scale (zoom) entrance/exit transitions", () => {
    open()
    const cls = document.querySelector('[data-slot="dialog-content"]')!.className
    expect(cls).toContain("data-open:zoom-in-95")
    expect(cls).toContain("data-closed:zoom-out-95")
  })

  it("disables the scale transition under prefers-reduced-motion", () => {
    open()
    const cls = document.querySelector('[data-slot="dialog-content"]')!.className
    expect(cls).toContain("motion-reduce:data-open:zoom-in-100")
    expect(cls).toContain("motion-reduce:data-closed:zoom-out-100")
  })

  it("keeps the close button with an accessible label", () => {
    open()
    expect(screen.getByText("Close")).toBeInTheDocument()
  })
})
