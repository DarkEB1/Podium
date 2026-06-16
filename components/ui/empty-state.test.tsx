import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { EmptyState } from "./empty-state"

describe("EmptyState", () => {
  it("renders the title and description", () => {
    render(<EmptyState title="No results" description="Try a different search." />)
    expect(screen.getByText("No results")).toBeInTheDocument()
    expect(screen.getByText("Try a different search.")).toBeInTheDocument()
  })

  it("renders an icon when provided and hides it from assistive tech", () => {
    const { container } = render(
      <EmptyState icon={<svg data-testid="icon" />} title="Empty" />
    )
    const iconWrap = container.querySelector('[data-slot="empty-state-icon"]')
    expect(iconWrap).not.toBeNull()
    expect(iconWrap).toHaveAttribute("aria-hidden", "true")
  })

  it("renders an onClick action as a button and fires it", async () => {
    const onClick = vi.fn()
    render(<EmptyState title="Empty" action={{ label: "Create", onClick }} />)
    await userEvent.click(screen.getByRole("button", { name: "Create" }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("renders an href action as a link", () => {
    render(<EmptyState title="Empty" action={{ label: "Browse", href: "/discover" }} />)
    const link = screen.getByRole("link", { name: "Browse" })
    expect(link).toHaveAttribute("href", "/discover")
  })

  it("omits description and action when not provided", () => {
    const { container } = render(<EmptyState title="Empty" />)
    expect(container.querySelector('[data-slot="empty-state-description"]')).toBeNull()
    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.queryByRole("link")).toBeNull()
  })
})
