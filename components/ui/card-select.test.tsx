import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"

import { CardSelectGroup } from "./card-select"

const options = [
  { value: "running", label: "Running", description: "Track & road", icon: <span data-testid="icon-running">R</span> },
  { value: "cycling", label: "Cycling", icon: <span>C</span> },
  { value: "swimming", label: "Swimming" },
]

function Controlled(props: {
  multiple?: boolean
  max?: number
  maxError?: string
  initial?: string[]
}) {
  const [value, setValue] = React.useState<string[]>(props.initial ?? [])
  return (
    <CardSelectGroup
      options={options}
      value={value}
      onChange={setValue}
      {...(props.multiple !== undefined ? { multiple: props.multiple } : {})}
      {...(props.max !== undefined ? { max: props.max } : {})}
      {...(props.maxError !== undefined ? { maxError: props.maxError } : {})}
    />
  )
}

describe("CardSelectGroup", () => {
  it("renders a tile per option with label, description and icon", () => {
    render(<CardSelectGroup options={options} value={[]} onChange={() => {}} />)
    expect(screen.getByText("Running")).toBeInTheDocument()
    expect(screen.getByText("Track & road")).toBeInTheDocument()
    expect(screen.getByTestId("icon-running")).toBeInTheDocument()
    expect(screen.getAllByRole("button")).toHaveLength(3)
  })

  it("single-select: selecting one tile replaces the selection", async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    await user.click(screen.getByRole("button", { name: /Running/ }))
    expect(screen.getByRole("button", { name: /Running/ })).toHaveAttribute("aria-pressed", "true")

    await user.click(screen.getByRole("button", { name: /Cycling/ }))
    expect(screen.getByRole("button", { name: /Cycling/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: /Running/ })).toHaveAttribute("aria-pressed", "false")
  })

  it("single-select: clicking a selected tile deselects it", async () => {
    const user = userEvent.setup()
    render(<Controlled initial={["running"]} />)
    await user.click(screen.getByRole("button", { name: /Running/ }))
    expect(screen.getByRole("button", { name: /Running/ })).toHaveAttribute("aria-pressed", "false")
  })

  it("multiple-select: toggles each tile independently", async () => {
    const user = userEvent.setup()
    render(<Controlled multiple />)
    await user.click(screen.getByRole("button", { name: /Running/ }))
    await user.click(screen.getByRole("button", { name: /Cycling/ }))
    expect(screen.getByRole("button", { name: /Running/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: /Cycling/ })).toHaveAttribute("aria-pressed", "true")
  })

  it("enforces max in multiple mode and shows maxError", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <CardSelectGroup
        options={options}
        value={["running", "cycling"]}
        onChange={onChange}
        multiple
        max={2}
        maxError="Pick at most 2"
      />
    )
    await user.click(screen.getByRole("button", { name: /Swimming/ }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText("Pick at most 2")).toBeInTheDocument()
    expect(screen.getByText("Pick at most 2")).toHaveAttribute("role", "alert")
  })

  it("at max, an already-selected tile can still be deselected", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <CardSelectGroup
        options={options}
        value={["running", "cycling"]}
        onChange={onChange}
        multiple
        max={2}
      />
    )
    await user.click(screen.getByRole("button", { name: /Running/ }))
    expect(onChange).toHaveBeenCalledWith(["cycling"])
  })

  it("uses aria-pressed for toggle semantics (not colour alone)", () => {
    render(<CardSelectGroup options={options} value={["running"]} onChange={() => {}} />)
    expect(screen.getByRole("button", { name: /Running/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: /Cycling/ })).toHaveAttribute("aria-pressed", "false")
  })

  it("selected tile carries the clean Airbnb selected classes (primary border + light tint + soft ring)", () => {
    render(<CardSelectGroup options={options} value={["running"]} onChange={() => {}} />)
    const selected = screen.getByRole("button", { name: /Running/ })
    expect(selected.className).toContain("border-primary")
    expect(selected.className).toContain("bg-primary/5")
    expect(selected.className).toContain("ring-primary/20")
    // No hard offset/press shadow on the clean selected state.
    expect(selected.className).not.toContain("shadow-press")
    expect(selected.className).not.toContain("border-border-ink")

    const unselected = screen.getByRole("button", { name: /Cycling/ })
    expect(unselected.className).not.toContain("ring-primary/20")
    expect(unselected.className).not.toContain("bg-primary/5")
  })

  it("rests on a single light border with a soft shadow and gentle hover lift", () => {
    render(<CardSelectGroup options={options} value={[]} onChange={() => {}} />)
    for (const tile of screen.getAllByRole("button")) {
      expect(tile.className).toContain("border-border")
      expect(tile.className).toContain("shadow-sm")
      // Gentle lift, not a hard press-into-shadow translate.
      expect(tile.className).toContain("hover:-translate-y-0.5")
    }
  })

  it("lays tiles out on an intrinsic auto-fill grid, not viewport breakpoints", () => {
    render(<CardSelectGroup options={options} value={[]} onChange={() => {}} />)
    const group = screen.getByRole("group")
    // Container-driven columns: viewport breakpoints lied inside narrow
    // containers (e.g. the settings content column at tablet widths).
    expect(group.className).toContain("auto-fill")
    expect(group.className).not.toContain("sm:grid-cols-2")
    expect(group.className).not.toContain("md:grid-cols-3")
  })

  it("every tile is pressable (gentle micro-interaction, reduced-motion safe via global util)", () => {
    render(<CardSelectGroup options={options} value={[]} onChange={() => {}} />)
    for (const tile of screen.getAllByRole("button")) {
      expect(tile.className).toContain("pressable")
    }
  })
})
