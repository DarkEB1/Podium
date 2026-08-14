import { render, screen } from "@testing-library/react"
import { describe, it, expect, beforeAll } from "vitest"

import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "./drawer"

// Vaul reads matchMedia (reduced-motion) and observes element size; jsdom ships
// neither. Shim both so the drawer can mount in the test environment.
beforeAll(() => {
  if (!window.matchMedia) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false
      },
    })) as unknown as typeof window.matchMedia
  }
  if (!("ResizeObserver" in globalThis)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
})

describe("Drawer", () => {
  it("renders its title and description when open (Vaul-backed)", () => {
    render(
      <Drawer open>
        <DrawerContent>
          <DrawerTitle>Filters</DrawerTitle>
          <DrawerDescription>Refine your results</DrawerDescription>
        </DrawerContent>
      </Drawer>
    )

    expect(screen.getByText("Filters")).toBeInTheDocument()
    expect(screen.getByText("Refine your results")).toBeInTheDocument()
  })
})
