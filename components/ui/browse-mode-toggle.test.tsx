import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"

import { BrowseModeToggle } from "./browse-mode-toggle"

describe("BrowseModeToggle (PR-23)", () => {
  it("exposes both launch modes as a radiogroup", () => {
    render(<BrowseModeToggle value="marketplace" onChange={() => {}} />)
    const group = screen.getByRole("radiogroup", { name: "Browse mode" })
    expect(group).toBeInTheDocument()
    expect(screen.getAllByRole("radio")).toHaveLength(2)
  })

  it("reflects the current ui_mode value", () => {
    render(<BrowseModeToggle value="swipe" onChange={() => {}} />)
    expect(screen.getByRole("radio", { name: /swipe/i })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("radio", { name: /grid/i })).toHaveAttribute("aria-checked", "false")
  })

  it("reports the new mode on click — it is not dead", () => {
    const onChange = vi.fn()
    render(<BrowseModeToggle value="marketplace" onChange={onChange} />)
    fireEvent.click(screen.getByRole("radio", { name: /swipe/i }))
    expect(onChange).toHaveBeenCalledWith("swipe")
  })

  it("moves between modes with the arrow keys", () => {
    const onChange = vi.fn()
    render(<BrowseModeToggle value="marketplace" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" })
    expect(onChange).toHaveBeenCalledWith("swipe")
  })

  it("uses a roving tabindex so the group is a single tab stop", () => {
    render(<BrowseModeToggle value="marketplace" onChange={() => {}} />)
    expect(screen.getByRole("radio", { name: /grid/i })).toHaveAttribute("tabindex", "0")
    expect(screen.getByRole("radio", { name: /swipe/i })).toHaveAttribute("tabindex", "-1")
  })

  it("locks out interaction while the preference is persisting", () => {
    render(<BrowseModeToggle value="swipe" onChange={() => {}} pending />)
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeDisabled()
    }
  })
})
