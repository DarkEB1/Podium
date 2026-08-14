import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs"

function renderTabs() {
  return render(
    <Tabs defaultValue="a">
      <TabsList>
        <TabsTrigger value="a">Athletes</TabsTrigger>
        <TabsTrigger value="b">Brands</TabsTrigger>
      </TabsList>
      <TabsContent value="a">A</TabsContent>
      <TabsContent value="b">B</TabsContent>
    </Tabs>
  )
}

describe("Tabs surface re-skin (C10 clean airbnb)", () => {
  it("gives the default tabs list a clean light border + soft shadow surface", () => {
    renderTabs()
    const list = document.querySelector('[data-slot="tabs-list"]')
    expect(list).not.toBeNull()
    const cls = list!.className
    expect(cls).toContain("border-border")
    expect(cls).toContain("shadow-sm")
    // no heavy ink border / hard offset shadow remains
    expect(cls).not.toContain("border-border-ink")
    expect(cls).not.toContain("border-ink-width")
  })

  it("keeps the active trigger transition intact", () => {
    renderTabs()
    const trigger = document.querySelector('[data-slot="tabs-trigger"]')
    expect(trigger!.className).toContain("transition-[color,background-color,box-shadow]")
  })

  it("renders visible trigger labels", () => {
    const { getByText } = renderTabs()
    expect(getByText("Athletes")).toBeInTheDocument()
    expect(getByText("Brands")).toBeInTheDocument()
  })
})
