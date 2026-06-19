import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { useState } from "react"
import { Combobox } from "./combobox"

const OPTIONS = [
  { value: "uk-sport", label: "UK Sport" },
  { value: "loughborough", label: "Loughborough University" },
  { value: "leeds", label: "University of Leeds" },
]

function Controlled({
  onChange,
  searchable,
  allowCreate,
}: {
  onChange?: (v: string) => void
  searchable?: boolean
  allowCreate?: boolean
}) {
  const [value, setValue] = useState<string | null>(null)
  return (
    <Combobox
      options={OPTIONS}
      value={value}
      onChange={(v) => {
        setValue(v)
        onChange?.(v)
      }}
      placeholder="Select a university"
      searchable={searchable}
      allowCreate={allowCreate}
    />
  )
}

describe("Combobox", () => {
  it("renders the placeholder when no value is selected", () => {
    render(<Controlled />)
    expect(screen.getByPlaceholderText("Select a university")).toBeInTheDocument()
  })

  it("input has a clean light border and a soft focus ring", () => {
    render(<Controlled />)
    const input = screen.getByPlaceholderText("Select a university")
    expect(input.className).toContain("border-border")
    expect(input.className).not.toMatch(/border-border-ink/)
    expect(input.className).toContain("focus-visible:ring-2")
    expect(input.className).toContain("focus-visible:ring-primary/40")
    expect(input.className).not.toMatch(/shadow-focus/)
  })

  it("type-to-filter narrows the visible options", async () => {
    const user = userEvent.setup()
    render(<Controlled searchable />)
    const input = screen.getByPlaceholderText("Select a university")
    await user.click(input)
    await user.type(input, "Leeds")

    await waitFor(() => {
      expect(screen.getByText("University of Leeds")).toBeInTheDocument()
    })
    expect(screen.queryByText("UK Sport")).not.toBeInTheDocument()
  })

  it("selecting an option calls onChange with its value", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Controlled searchable onChange={onChange} />)
    const input = screen.getByPlaceholderText("Select a university")
    await user.click(input)
    await user.click(await screen.findByText("UK Sport"))
    expect(onChange).toHaveBeenCalledWith("uk-sport")
  })

  it("allowCreate offers a create entry for an unknown query", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Controlled searchable allowCreate onChange={onChange} />)
    const input = screen.getByPlaceholderText("Select a university")
    await user.click(input)
    await user.type(input, "Wibble Academy")
    const createOption = await screen.findByText(/create.*wibble academy/i)
    await user.click(createOption)
    expect(onChange).toHaveBeenCalledWith("Wibble Academy")
  })
})
