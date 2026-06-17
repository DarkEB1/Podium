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
  it("trigger renders with an ink border and no soft ring", () => {
    renderSelect()
    const trigger = screen.getByLabelText("Sport")
    expect(trigger.className).toContain("border-border-ink")
    expect(trigger.className).not.toMatch(/ring-ring/)
  })

  it("trigger throws the focus shadow and primary border on focus-visible", () => {
    renderSelect()
    const trigger = screen.getByLabelText("Sport")
    expect(trigger.className).toContain("focus-visible:shadow-focus")
    expect(trigger.className).toContain("focus-visible:border-primary")
  })

  it("renders the placeholder label text", () => {
    renderSelect()
    expect(screen.getByText("Pick a sport")).toBeInTheDocument()
  })
})
