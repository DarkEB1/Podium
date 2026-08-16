import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeAll } from "vitest"

import { SwipeCard, SwipeDeck } from "./swipe-card"

// Framer Motion's useReducedMotion() reads window.matchMedia, which jsdom does
// not implement. Shim it (default: motion enabled) so motion.article renders.
beforeAll(() => {
  if (typeof window.matchMedia === "undefined") {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal test shim
      }) as any
  }
})

const base = {
  image: "/athlete.jpg",
  imageAlt: "Jane Doe sprinting",
  title: "Jane Doe",
}

describe("SwipeCard (PR-23)", () => {
  // Commit is now async: the card flings/cross-fades OUT, then onSwipe fires on
  // the animation's onComplete (audit H1). The accessible paths still drive the
  // same commit, so we assert onSwipe eventually fires with the right direction.
  it("offers keyboard-accessible actions, not swipe-only", async () => {
    const onSwipe = vi.fn()
    render(<SwipeCard {...base} onSwipe={onSwipe} />)

    fireEvent.click(screen.getByRole("button", { name: "Interested" }))
    await waitFor(() => expect(onSwipe).toHaveBeenCalledWith("right"))
  })

  it("passes via the Pass button", async () => {
    const onSwipe = vi.fn()
    render(<SwipeCard {...base} onSwipe={onSwipe} />)

    fireEvent.click(screen.getByRole("button", { name: "Pass" }))
    await waitFor(() => expect(onSwipe).toHaveBeenCalledWith("left"))
  })

  it("maps the arrow keys onto the same actions", async () => {
    const onSwipe = vi.fn()
    render(<SwipeCard {...base} onSwipe={onSwipe} />)
    const card = screen.getByTestId("swipe-card")

    fireEvent.keyDown(card, { key: "ArrowRight" })
    await waitFor(() => expect(onSwipe).toHaveBeenLastCalledWith("right"))
  })

  it("maps the left arrow key onto Pass", async () => {
    const onSwipe = vi.fn()
    render(<SwipeCard {...base} onSwipe={onSwipe} />)
    const card = screen.getByTestId("swipe-card")

    fireEvent.keyDown(card, { key: "ArrowLeft" })
    await waitFor(() => expect(onSwipe).toHaveBeenLastCalledWith("left"))
  })

  // The old pointer-drag threshold test drove the OLD mechanism via
  // fireEvent.pointerDown/Move/Up. Drag is now a Framer gesture that jsdom's
  // synthetic pointer events cannot drive (Framer measures real pointer/layout),
  // so the throw + velocity projection is covered manually / by e2e. Here we
  // just assert the card still renders as an interactive, unswiped card.
  it("renders as an interactive card that has not yet committed", () => {
    const onSwipe = vi.fn()
    render(<SwipeCard {...base} onSwipe={onSwipe} />)
    const card = screen.getByTestId("swipe-card")

    expect(card).toBeInTheDocument()
    expect(card).toHaveAttribute("data-intent", "none")
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it("renders name, seeking and availability in that order", () => {
    render(<SwipeCard {...base} seeking="Kit sponsorship" availability="Open now" />)
    const html = screen.getByTestId("swipe-card").innerHTML
    expect(html.indexOf("Kit sponsorship")).toBeGreaterThan(html.indexOf(">Jane Doe<"))
    expect(html.indexOf("Open now")).toBeGreaterThan(html.indexOf("Kit sponsorship"))
  })

  it("falls back to the placeholder image (B-5)", () => {
    render(<SwipeCard {...base} image="" />)
    expect(screen.getByAltText("Jane Doe sprinting").getAttribute("src")).toContain(
      "placeholder-athlete.svg"
    )
  })

  it("renders no gloss layer by default (opt-in, backward compatible)", () => {
    render(<SwipeCard {...base} />)
    expect(screen.queryByTestId("swipe-gloss")).not.toBeInTheDocument()
  })

  it("renders a gloss sheen layer when glossy is set", () => {
    render(<SwipeCard {...base} glossy />)
    expect(screen.getByTestId("swipe-gloss")).toBeInTheDocument()
  })

  it("renders no overlay content by default (opt-in, backward compatible)", () => {
    render(<SwipeCard {...base} />)
    expect(screen.queryByText("92")).not.toBeInTheDocument()
  })

  it("renders the overlay node in the figure when provided", () => {
    render(<SwipeCard {...base} overlay={<span>92</span>} />)
    expect(screen.getByText("92")).toBeInTheDocument()
  })
})

describe("SwipeDeck (PR-23)", () => {
  it("renders only the head card interactively", () => {
    render(
      <SwipeDeck
        cards={[
          { ...base, id: "a", title: "Jane Doe" },
          { ...base, id: "b", title: "Ade Ola" },
        ]}
      />
    )
    expect(screen.getAllByTestId("swipe-card")).toHaveLength(1)
    expect(screen.getByTestId("swipe-deck-peek")).toBeInTheDocument()
    // Exactly one Pass/Interested pair in the tab order.
    expect(screen.getAllByRole("button", { name: "Pass" })).toHaveLength(1)
  })

  it("reports which card was swiped", async () => {
    const onSwipe = vi.fn()
    render(<SwipeDeck cards={[{ ...base, id: "a" }]} onSwipe={onSwipe} />)
    fireEvent.click(screen.getByRole("button", { name: "Interested" }))
    await waitFor(() => expect(onSwipe).toHaveBeenCalledWith("a", "right"))
  })

  it("shows an empty state rather than a blank screen when the queue runs dry (UX-1)", () => {
    render(<SwipeDeck cards={[]} />)
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument()
  })
})
