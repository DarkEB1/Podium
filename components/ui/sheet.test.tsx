import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./sheet"

function open() {
  return render(
    <Sheet open>
      <SheetContent side="right">
        <SheetTitle>Filters</SheetTitle>
        <SheetDescription>Narrow the field.</SheetDescription>
      </SheetContent>
    </Sheet>
  )
}

describe("SheetContent surface re-skin (C10 clean airbnb)", () => {
  it("carries a clean light border + soft shadow on the surface", () => {
    open()
    const surface = document.querySelector('[data-slot="sheet-content"]')
    expect(surface).not.toBeNull()
    const cls = surface!.className
    expect(cls).toContain("border-border")
    expect(cls).toContain("shadow-card")
    // no heavy ink border / fixed ink width remains
    expect(cls).not.toContain("border-border-ink")
    expect(cls).not.toContain("border-ink-width")
  })

  it("keeps the v1 slide (translate) entrance/exit transitions", () => {
    open()
    const cls = document.querySelector('[data-slot="sheet-content"]')!.className
    expect(cls).toContain("data-[side=right]:data-ending-style:translate-x-[2.5rem]")
    expect(cls).toContain("data-[side=right]:data-starting-style:translate-x-[2.5rem]")
  })

  it("disables the slide transition under prefers-reduced-motion", () => {
    open()
    const cls = document.querySelector('[data-slot="sheet-content"]')!.className
    expect(cls).toContain("motion-reduce:transition-opacity")
  })

  it("keeps the close button with an accessible label", () => {
    open()
    expect(screen.getByText("Close")).toBeInTheDocument()
  })
})
