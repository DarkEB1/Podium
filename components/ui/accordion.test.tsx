import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./accordion"

function Faq() {
  return (
    <Accordion>
      <AccordionItem>
        <AccordionTrigger>How does Podium work?</AccordionTrigger>
        <AccordionContent>Brands find athletes.</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

describe("Accordion focus (A-4)", () => {
  it("replaces the suppressed outline with a visible full-opacity focus ring", () => {
    render(<Faq />)
    const trigger = screen.getByRole("button", { name: /how does podium work/i })
    expect(trigger.className).toContain("focus-visible:ring-2")
    expect(trigger.className).toContain("focus-visible:ring-ring")
    expect(trigger.className).toContain("focus-visible:ring-offset-2")
  })

  it("does not rely on a colour-only focus cue", () => {
    render(<Faq />)
    const trigger = screen.getByRole("button", { name: /how does podium work/i })
    // A half-opacity ring composites too light to clear the 3:1 non-text bar.
    expect(trigger.className).not.toMatch(/focus-visible:ring-ring\/\d/)
  })

  it("is keyboard reachable", () => {
    render(<Faq />)
    const trigger = screen.getByRole("button", { name: /how does podium work/i })
    trigger.focus()
    expect(trigger).toHaveFocus()
  })
})
