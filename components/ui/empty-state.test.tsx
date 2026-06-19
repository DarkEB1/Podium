import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Search } from "lucide-react"
import { describe, it, expect, vi } from "vitest"

import { copy } from "@/lib/copy"

import { EmptyState } from "./empty-state"

describe("EmptyState", () => {
  it("renders the title and description", () => {
    render(<EmptyState title="No results" description="Try a different search." />)
    expect(screen.getByText("No results")).toBeInTheDocument()
    expect(screen.getByText("Try a different search.")).toBeInTheDocument()
  })

  it("renders a node icon when provided and hides it from assistive tech", () => {
    const { container } = render(
      <EmptyState icon={<svg data-testid="icon" />} title="Empty" />
    )
    const disc = container.querySelector('[data-slot="empty-state-icon"]')
    expect(disc).not.toBeNull()
    expect(disc).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByTestId("icon")).toBeInTheDocument()
  })

  it("renders a Lucide icon component via the iconComponent prop inside the accent disc", () => {
    const { container } = render(<EmptyState title="Empty" iconComponent={Search} />)
    const disc = container.querySelector('[data-slot="empty-state-icon"]')
    expect(disc).not.toBeNull()
    // the accent disc carries an svg (the Lucide icon) and stays decorative
    expect(disc?.querySelector("svg")).not.toBeNull()
    expect(disc).toHaveAttribute("aria-hidden", "true")
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

  it("title is exposed as a heading for assistive tech", () => {
    render(<EmptyState title="No results" />)
    expect(screen.getByRole("heading", { name: "No results" })).toBeInTheDocument()
  })

  describe("variant defaults from copy.emptyStates", () => {
    it("uses the locked noMatches copy for title, body and CTA label", () => {
      render(
        <EmptyState variant="noMatches" action={{ href: "/profile" }} />
      )
      expect(
        screen.getByRole("heading", { name: copy.emptyStates.noMatches.title })
      ).toBeInTheDocument()
      expect(screen.getByText(copy.emptyStates.noMatches.body)).toBeInTheDocument()
      const link = screen.getByRole("link", { name: copy.emptyStates.noMatches.cta })
      expect(link).toHaveAttribute("href", "/profile")
    })

    it("uses noResults copy", () => {
      render(<EmptyState variant="noResults" />)
      expect(
        screen.getByRole("heading", { name: copy.emptyStates.noResults.title })
      ).toBeInTheDocument()
      expect(screen.getByText(copy.emptyStates.noResults.body)).toBeInTheDocument()
    })

    it("renders no action when the variant's cta is null and no action is given", () => {
      render(<EmptyState variant="emptyInbox" />)
      expect(
        screen.getByRole("heading", { name: copy.emptyStates.emptyInbox.title })
      ).toBeInTheDocument()
      expect(screen.queryByRole("button")).toBeNull()
      expect(screen.queryByRole("link")).toBeNull()
    })

    it("lets explicit props override the variant copy", () => {
      render(
        <EmptyState
          variant="noResults"
          title="Custom title"
          description="Custom body"
          action={{ label: "Custom CTA", href: "/x" }}
        />
      )
      expect(screen.getByRole("heading", { name: "Custom title" })).toBeInTheDocument()
      expect(screen.getByText("Custom body")).toBeInTheDocument()
      expect(screen.getByRole("link", { name: "Custom CTA" })).toBeInTheDocument()
      expect(
        screen.queryByText(copy.emptyStates.noResults.title)
      ).not.toBeInTheDocument()
    })
  })
})
