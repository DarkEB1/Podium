import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { RequiredKey } from "./required-key"

describe("RequiredKey", () => {
  it("renders the '* Required field' key", () => {
    render(<RequiredKey />)
    expect(screen.getByText(/required field/i)).toBeInTheDocument()
  })

  it("marks the asterisk decorative so it is not read twice by screen readers", () => {
    const { container } = render(<RequiredKey />)
    const star = container.querySelector('[aria-hidden="true"]')
    expect(star).not.toBeNull()
    expect(star?.textContent).toContain("*")
  })

  it("accepts a className for layout composition", () => {
    const { container } = render(<RequiredKey className="mt-2" />)
    expect((container.firstChild as HTMLElement).className).toContain("mt-2")
  })
})
