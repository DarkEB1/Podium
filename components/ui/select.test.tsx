import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"

function renderSelect() {
  return render(
    <Select>
      <SelectTrigger aria-label="Sport">
        <SelectValue placeholder="Pick a sport" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="football">Football</SelectItem>
      </SelectContent>
    </Select>
  )
}

describe("Select", () => {
  it("trigger renders with a clean light border and no hard ink border", () => {
    renderSelect()
    const trigger = screen.getByLabelText("Sport")
    expect(trigger.className).toContain("border-border")
    expect(trigger.className).not.toMatch(/border-border-ink/)
    // No heavy ink border: no fixed-width border and no full-opacity foreground border.
    expect(trigger.className).not.toMatch(/border-\[1\.5px\]/)
    expect(trigger.className).not.toMatch(/(?:^|\s)border-foreground(?:\s|$)/)
  })

  it("trigger uses a soft focus ring, not the hard offset focus shadow", () => {
    renderSelect()
    const trigger = screen.getByLabelText("Sport")
    expect(trigger.className).toContain("focus-visible:ring-2")
    expect(trigger.className).toContain("focus-visible:ring-primary/40")
    expect(trigger.className).not.toMatch(/shadow-focus/)
  })

  it("renders the placeholder label text", () => {
    renderSelect()
    expect(screen.getByText("Pick a sport")).toBeInTheDocument()
  })
})
