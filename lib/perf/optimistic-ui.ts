"use client"

import { useCallback, useRef, useState } from "react"

export interface UseOptimisticActionOptions<T> {
  /** Value rendered before any action runs. */
  initial: T
  /**
   * Performs the real (async) mutation. Resolve with the authoritative value
   * from the server; that value replaces the optimistic one. Reject to trigger
   * a rollback to the value held before the action started.
   */
  commit: (next: T) => Promise<T | void>
  /** Called with the rejection reason after a rollback. */
  onError?: (error: unknown) => void
}

export interface UseOptimisticAction<T> {
  /** Current value: optimistic while pending, authoritative once committed. */
  value: T
  /** True while a commit is in flight. */
  pending: boolean
  /** The last rejection reason, or null if the last action succeeded. */
  error: unknown
  /** Apply `next` optimistically, then commit. Resolves/rejects with `commit`. */
  run: (next: T) => Promise<T | void>
}

/**
 * useOptimisticAction — perceived-performance helper (spec §10.3.3).
 *
 * Renders an optimistic value the instant the user acts, runs the real mutation
 * in the background, then either keeps the server's authoritative value or rolls
 * back to the pre-action value on failure. Keeps interactions feeling instant
 * without lying about the persisted state.
 */
export function useOptimisticAction<T>({
  initial,
  commit,
  onError,
}: UseOptimisticActionOptions<T>): UseOptimisticAction<T> {
  const [value, setValue] = useState<T>(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  // Tracks the committed value so a rollback restores the right baseline even
  // across rapid successive actions.
  const committedRef = useRef<T>(initial)

  const run = useCallback(
    async (next: T) => {
      const previous = committedRef.current
      setValue(next)
      setPending(true)
      setError(null)
      try {
        const result = await commit(next)
        const settled = (result === undefined ? next : result) as T
        committedRef.current = settled
        setValue(settled)
        return result
      } catch (err) {
        committedRef.current = previous
        setValue(previous)
        setError(err)
        onError?.(err)
        throw err
      } finally {
        setPending(false)
      }
    },
    [commit, onError],
  )

  return { value, pending, error, run }
}
