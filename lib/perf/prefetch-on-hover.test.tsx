import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

const prefetch = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ prefetch }),
}))

import { PREFETCH_HOVER_DELAY_MS, usePrefetchOnHover } from "./prefetch-on-hover"

describe("usePrefetchOnHover", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    prefetch.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("exposes the 300ms intent delay from the spec", () => {
    expect(PREFETCH_HOVER_DELAY_MS).toBe(300)
  })

  it("prefetches the href only after the hover delay elapses", () => {
    const { result } = renderHook(() => usePrefetchOnHover("/athletes/42"))

    act(() => result.current.onMouseEnter())
    expect(prefetch).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(PREFETCH_HOVER_DELAY_MS))
    expect(prefetch).toHaveBeenCalledExactlyOnceWith("/athletes/42")
  })

  it("does not prefetch when the pointer leaves before the delay", () => {
    const { result } = renderHook(() => usePrefetchOnHover("/athletes/42"))

    act(() => result.current.onMouseEnter())
    act(() => vi.advanceTimersByTime(PREFETCH_HOVER_DELAY_MS - 50))
    act(() => result.current.onMouseLeave())
    act(() => vi.advanceTimersByTime(100))

    expect(prefetch).not.toHaveBeenCalled()
  })

  it("prefetches at most once per sustained hover", () => {
    const { result } = renderHook(() => usePrefetchOnHover("/athletes/42"))

    act(() => result.current.onMouseEnter())
    act(() => vi.advanceTimersByTime(PREFETCH_HOVER_DELAY_MS))
    act(() => result.current.onMouseEnter())
    act(() => vi.advanceTimersByTime(PREFETCH_HOVER_DELAY_MS))

    expect(prefetch).toHaveBeenCalledTimes(1)
  })

  it("also prefetches on keyboard focus for accessibility parity", () => {
    const { result } = renderHook(() => usePrefetchOnHover("/athletes/42"))

    act(() => result.current.onFocus())
    act(() => vi.advanceTimersByTime(PREFETCH_HOVER_DELAY_MS))

    expect(prefetch).toHaveBeenCalledExactlyOnceWith("/athletes/42")
  })

  it("does nothing when href is null", () => {
    const { result } = renderHook(() => usePrefetchOnHover(null))

    act(() => result.current.onMouseEnter())
    act(() => vi.advanceTimersByTime(PREFETCH_HOVER_DELAY_MS))

    expect(prefetch).not.toHaveBeenCalled()
  })
})
