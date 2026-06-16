import { describe, it, expect, vi } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"

import { useOptimisticAction } from "./optimistic-ui"

describe("useOptimisticAction", () => {
  it("applies the optimistic value immediately, before the commit resolves", async () => {
    let resolve: (v: number) => void = () => {}
    const commit = vi.fn(
      () => new Promise<number>((r) => (resolve = r)),
    )

    const { result } = renderHook(() =>
      useOptimisticAction<number>({ initial: 1, commit }),
    )

    expect(result.current.value).toBe(1)

    act(() => {
      result.current.run(5)
    })

    // Optimistic value is shown synchronously, while pending.
    expect(result.current.value).toBe(5)
    expect(result.current.pending).toBe(true)

    await act(async () => {
      resolve(5)
    })

    await waitFor(() => expect(result.current.pending).toBe(false))
    expect(result.current.value).toBe(5)
  })

  it("rolls back to the previous value when the commit rejects", async () => {
    const error = new Error("boom")
    const commit = vi.fn(() => Promise.reject(error))
    const onError = vi.fn()

    const { result } = renderHook(() =>
      useOptimisticAction<number>({ initial: 3, commit, onError }),
    )

    await act(async () => {
      await result.current.run(9).catch(() => {})
    })

    // Reverted to the pre-action value, not the optimistic one.
    expect(result.current.value).toBe(3)
    expect(result.current.pending).toBe(false)
    expect(result.current.error).toBe(error)
    expect(onError).toHaveBeenCalledWith(error)
  })

  it("uses the server-returned value when the commit resolves to a different value", async () => {
    const commit = vi.fn(() => Promise.resolve(42))

    const { result } = renderHook(() =>
      useOptimisticAction<number>({ initial: 0, commit }),
    )

    await act(async () => {
      await result.current.run(10)
    })

    expect(result.current.value).toBe(42)
  })
})
