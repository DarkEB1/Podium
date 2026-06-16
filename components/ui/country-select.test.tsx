import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { useState } from "react"
import { CountrySelect } from "./country-select"
import { COUNTRIES, flagEmoji } from "@/lib/data/countries"

function Controlled({ onChange }: { onChange?: (iso: string) => void }) {
  const [value, setValue] = useState<string | null>("GB")
  return (
    <CountrySelect
      value={value}
      onChange={(iso) => {
        setValue(iso)
        onChange?.(iso)
      }}
    />
  )
}

describe("countries data", () => {
  it("includes the full ISO-3166 list (well over 190 entries)", () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(195)
  })

  it("uses two-letter ISO codes", () => {
    expect(COUNTRIES.every((c) => /^[A-Z]{2}$/.test(c.code))).toBe(true)
  })

  it("derives a flag emoji from a country code", () => {
    expect(flagEmoji("GB")).toBe("\u{1F1EC}\u{1F1E7}")
  })
})

describe("CountrySelect", () => {
  it("defaults to GB and shows the United Kingdom flag in the field", () => {
    render(<Controlled />)
    expect(screen.getByDisplayValue(/united kingdom/i)).toBeInTheDocument()
    expect(screen.getByText("\u{1F1EC}\u{1F1E7}")).toBeInTheDocument()
  })

  it("selecting a country fires onChange with the ISO code and shows its flag", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    const input = screen.getByRole("combobox")
    await user.click(input)
    await user.clear(input)
    await user.type(input, "France")
    await user.click(await screen.findByText(/^France$/))
    expect(onChange).toHaveBeenCalledWith("FR")
    expect(screen.getByText("\u{1F1EB}\u{1F1F7}")).toBeInTheDocument()
  })
})
