import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeAll } from "vitest"

import { SwipeCard, SwipeDeck } from "./swipe-card"

// jsdom ships no PointerEvent, so Testing Library degrades pointer events to a
// bare Event and drops clientX. Polyfill it from MouseEvent so drag can be tested.
beforeAll(() => {
  if (typeof window.PointerEvent === "undefined") {
    class PointerEventPolyfill extends MouseEvent {
      readonly pointerId: number
      constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 0
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only polyfill
    ;(window as any).PointerEvent = PointerEventPolyfill
  }
})

const base = {
  image: "/athlete.jpg",
  imageAlt: "Jane Doe sprinting",
  title: "Jane Doe",
}

describe("SwipeCard (PR-23)", () => {
  it("offers keyboard-accessible actions, not swipe-only", () => {
    const onSwipe = vi.fn()
    render(<SwipeCard {...base} onSwipe={onSwipe} />)

    fireEvent.click(screen.getByRole("button", { name: "Interested" }))
    expect(onSwipe).toHaveBeenCalledWith("right")

    fireEvent.click(screen.getByRole("button", { name: "Pass" }))
    expect(onSwipe).toHaveBeenCalledWith("left")
  })

  it("maps the arrow keys onto the same actions", () => {
    const onSwipe = vi.fn()
    render(<SwipeCard {...base} onSwipe={onSwipe} />)
    const card = screen.getByTestId("swipe-card")

    fireEvent.keyDown(card, { key: "ArrowRight" })
    expect(onSwipe).toHaveBeenLastCalledWith("right")

    fireEvent.keyDown(card, { key: "ArrowLeft" })
    expect(onSwipe).toHaveBeenLastCalledWith("left")
  })

  it("commits a drag only once it passes the threshold", () => {
    const onSwipe = vi.fn()
    render(<SwipeCard {...base} onSwipe={onSwipe} />)
    const card = screen.getByTestId("swipe-card")

    fireEvent.pointerDown(card, { clientX: 0, pointerId: 1 })
    fireEvent.pointerMove(card, { clientX: 40, pointerId: 1 })
    fireEvent.pointerUp(card, { pointerId: 1 })
    expect(onSwipe).not.toHaveBeenCalled()

    fireEvent.pointerDown(card, { clientX: 0, pointerId: 1 })
    fireEvent.pointerMove(card, { clientX: 200, pointerId: 1 })
    fireEvent.pointerUp(card, { pointerId: 1 })
    expect(onSwipe).toHaveBeenCalledWith("right")
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

  it("reports which card was swiped", () => {
    const onSwipe = vi.fn()
    render(<SwipeDeck cards={[{ ...base, id: "a" }]} onSwipe={onSwipe} />)
    fireEvent.click(screen.getByRole("button", { name: "Interested" }))
    expect(onSwipe).toHaveBeenCalledWith("a", "right")
  })

  it("shows an empty state rather than a blank screen when the queue runs dry (UX-1)", () => {
    render(<SwipeDeck cards={[]} />)
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument()
  })
})
