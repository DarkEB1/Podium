import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { FilterGroup, useFilterDisclosure } from "./filter-group"

function Filter({ id }: { id: string }) {
  const { open, onOpenChange } = useFilterDisclosure(id)
  return (
    <div>
      <button type="button" onClick={() => onOpenChange?.(!open)}>
        toggle {id}
      </button>
      <span data-testid={`state-${id}`}>{open ? "open" : "closed"}</span>
    </div>
  )
}

describe("FilterGroup (PR-17)", () => {
  it("opens one filter at a time", () => {
    render(
      <FilterGroup>
        <Filter id="sport" />
        <Filter id="budget" />
      </FilterGroup>
    )

    fireEvent.click(screen.getByText("toggle sport"))
    expect(screen.getByTestId("state-sport")).toHaveTextContent("open")
    expect(screen.getByTestId("state-budget")).toHaveTextContent("closed")

    fireEvent.click(screen.getByText("toggle budget"))
    expect(screen.getByTestId("state-sport")).toHaveTextContent("closed")
    expect(screen.getByTestId("state-budget")).toHaveTextContent("open")
  })

  it("closes the open filter when it is toggled again", () => {
    render(
      <FilterGroup>
        <Filter id="sport" />
      </FilterGroup>
    )
    fireEvent.click(screen.getByText("toggle sport"))
    fireEvent.click(screen.getByText("toggle sport"))
    expect(screen.getByTestId("state-sport")).toHaveTextContent("closed")
  })

  it("leaves primitives uncontrolled outside a FilterGroup", () => {
    render(<Filter id="sport" />)
    // `open` is undefined, so the primitive keeps its own internal state.
    expect(screen.getByTestId("state-sport")).toHaveTextContent("closed")
    fireEvent.click(screen.getByText("toggle sport"))
    expect(screen.getByTestId("state-sport")).toHaveTextContent("closed")
  })

  it("owns a single stacking context so popovers cannot be over-painted", () => {
    render(
      <FilterGroup data-testid="bar">
        <Filter id="sport" />
      </FilterGroup>
    )
    expect(screen.getByTestId("bar").className).toContain("isolate")
    expect(screen.getByTestId("bar").className).toMatch(/\bz-20\b/)
  })
})
