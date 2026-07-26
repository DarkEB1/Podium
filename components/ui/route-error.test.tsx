import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"

import { RouteError } from "./route-error"
import { PageSkeleton } from "./page-skeleton"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("RouteError (B-11 / UX-1)", () => {
  const error = Object.assign(
    new Error('relation "public.profiles" does not exist: connection to 10.0.0.4:5432 failed'),
    { digest: "abc123" }
  )

  it("never leaks the raw error message to the user", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    render(<RouteError error={error} reset={() => {}} />)
    expect(document.body.textContent).not.toContain("public.profiles")
    expect(document.body.textContent).not.toContain("5432")
  })

  it("logs the error to console.error for the operator", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    render(<RouteError error={error} reset={() => {}} />)
    expect(spy).toHaveBeenCalledWith("[route-error]", error)
  })

  it("shows the opaque digest as a support reference", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    render(<RouteError error={error} reset={() => {}} />)
    expect(screen.getByText("abc123")).toBeInTheDocument()
  })

  it("offers a retry that calls reset()", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const reset = vi.fn()
    render(<RouteError error={error} reset={reset} />)
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it("announces itself as an alert", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    render(<RouteError error={error} reset={() => {}} />)
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })
})

describe("PageSkeleton (B-11 / UX-1)", () => {
  it("announces a single busy region, not one per tile", () => {
    render(<PageSkeleton variant="grid" count={6} />)
    expect(screen.getAllByRole("status").filter((n) => n.dataset.slot === "page-skeleton")).toHaveLength(1)
    expect(screen.getByTestId("page-skeleton")).toHaveAttribute("aria-busy", "true")
  })

  it("reserves the requested number of card footprints", () => {
    render(<PageSkeleton variant="grid" count={4} />)
    const root = screen.getByTestId("page-skeleton")
    expect(root.querySelectorAll('[data-slot="card-skeleton"]')).toHaveLength(4)
  })

  it("supports the list, detail, chat and form silhouettes", () => {
    for (const variant of ["list", "detail", "chat", "form"] as const) {
      const { unmount } = render(<PageSkeleton variant={variant} />)
      expect(screen.getByTestId("page-skeleton")).toHaveAttribute("data-variant", variant)
      unmount()
    }
  })
})
