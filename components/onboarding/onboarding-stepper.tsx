'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface OnboardingStepperProps {
  /** Ordered, 0-based list of steps to render as pills. */
  steps: { label: string }[]
  /** 0-based index of the active step. */
  current: number
  /** Highest 0-based index the user may navigate to. */
  maxReachable: number
  /** Called with the target index when a non-locked, non-current pill is clicked. */
  onNavigate: (index: number) => void
  className?: string
}

/**
 * Accessible "go back to any step" selector for the onboarding wizards.
 *
 * State per pill (index `i` relative to `current`/`maxReachable`):
 *   - completed  (i < current)                -> filled + checked, clickable
 *   - current    (i === current)              -> highlighted, aria-current="step"
 *   - reachable  (current < i <= maxReachable) -> muted, clickable
 *   - locked     (i > maxReachable)           -> muted + disabled, not clickable
 *
 * Forward jumps past `maxReachable` are always locked so a user can never skip a
 * step's required-field validation. Backward navigation to any reached step is
 * always allowed — that is the whole point of the control.
 *
 * The row scrolls horizontally on narrow screens (pills never shrink or wrap
 * mid-label), and a slim progress bar under the row keeps the % feel of the
 * original wizard header.
 */
export function OnboardingStepper({
  steps,
  current,
  maxReachable,
  onNavigate,
  className,
}: OnboardingStepperProps) {
  const total = steps.length
  // Mirror the wizard's original progressPct: position through the sequence.
  const progressPct =
    total > 0 ? Math.min(100, Math.round(((current + 1) / total) * 100)) : 0

  return (
    <nav aria-label="Onboarding steps" className={cn('space-y-3', className)}>
      <ol className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1 [scrollbar-width:thin]">
        {steps.map((s, i) => {
          const isCompleted = i < current
          const isCurrent = i === current
          const isLocked = i > maxReachable
          const isClickable = !isLocked && !isCurrent

          return (
            <li key={i} className="shrink-0">
              <button
                type="button"
                disabled={isLocked}
                aria-disabled={isLocked || undefined}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Go to step ${i + 1}: ${s.label}`}
                onClick={() => {
                  if (isClickable) onNavigate(i)
                }}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-small font-medium transition-colors',
                  'focus-visible:ring-3 focus-visible:ring-ring/50 outline-none',
                  isCurrent && 'border-primary bg-primary/10 text-foreground',
                  isCompleted &&
                    'cursor-pointer border-primary bg-primary text-primary-foreground hover:bg-primary/90',
                  !isCurrent &&
                    !isCompleted &&
                    !isLocked &&
                    'cursor-pointer border-border bg-card text-muted-foreground hover:border-foreground/50 hover:text-foreground',
                  isLocked && 'cursor-not-allowed border-border bg-muted text-muted-foreground/50'
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full text-small tabular-nums',
                    isCurrent && 'bg-primary text-primary-foreground',
                    isCompleted && 'bg-primary-foreground/20 text-primary-foreground',
                    !isCurrent && !isCompleted && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span>{s.label}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-foreground transition-[width]"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </nav>
  )
}

export default OnboardingStepper
