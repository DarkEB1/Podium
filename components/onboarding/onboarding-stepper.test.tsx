import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

import { OnboardingStepper } from './onboarding-stepper'

const steps = [
  { label: 'Basics' },
  { label: 'Sport' },
  { label: 'Availability' },
  { label: 'Review' },
]

describe('OnboardingStepper', () => {
  it('renders one pill per step, numbered and labelled', () => {
    render(<OnboardingStepper steps={steps} current={1} maxReachable={2} onNavigate={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Go to step 1: Basics' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go to step 4: Review' })).toBeInTheDocument()
  })

  it('marks the current step with aria-current="step"', () => {
    render(<OnboardingStepper steps={steps} current={1} maxReachable={2} onNavigate={() => {}} />)
    const current = screen.getByRole('button', { name: 'Go to step 2: Sport' })
    expect(current).toHaveAttribute('aria-current', 'step')
    // No other pill is current.
    expect(screen.getByRole('button', { name: 'Go to step 1: Basics' })).not.toHaveAttribute('aria-current')
  })

  it('locks steps beyond maxReachable (disabled + aria-disabled)', () => {
    render(<OnboardingStepper steps={steps} current={1} maxReachable={2} onNavigate={() => {}} />)
    const locked = screen.getByRole('button', { name: 'Go to step 4: Review' })
    expect(locked).toBeDisabled()
    expect(locked).toHaveAttribute('aria-disabled', 'true')
  })

  it('a completed step (index < current) is clickable and navigates', async () => {
    const onNavigate = vi.fn()
    render(<OnboardingStepper steps={steps} current={2} maxReachable={2} onNavigate={onNavigate} />)
    await userEvent.click(screen.getByRole('button', { name: 'Go to step 1: Basics' }))
    expect(onNavigate).toHaveBeenCalledWith(0)
  })

  it('a reachable-but-ahead step (current < index <= maxReachable) navigates forward', async () => {
    const onNavigate = vi.fn()
    render(<OnboardingStepper steps={steps} current={0} maxReachable={2} onNavigate={onNavigate} />)
    await userEvent.click(screen.getByRole('button', { name: 'Go to step 3: Availability' }))
    expect(onNavigate).toHaveBeenCalledWith(2)
  })

  it('does not navigate when the current step is clicked', async () => {
    const onNavigate = vi.fn()
    render(<OnboardingStepper steps={steps} current={1} maxReachable={2} onNavigate={onNavigate} />)
    await userEvent.click(screen.getByRole('button', { name: 'Go to step 2: Sport' }))
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('does not navigate when a locked step is clicked', async () => {
    const onNavigate = vi.fn()
    render(<OnboardingStepper steps={steps} current={1} maxReachable={1} onNavigate={onNavigate} />)
    // Step 4 (index 3) is beyond maxReachable = 1.
    await userEvent.click(screen.getByRole('button', { name: 'Go to step 4: Review' }))
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('always allows backward navigation to any step at or before current', async () => {
    const onNavigate = vi.fn()
    // On the final step; every earlier step must be reachable regardless of maxReachable.
    render(<OnboardingStepper steps={steps} current={3} maxReachable={3} onNavigate={onNavigate} />)
    await userEvent.click(screen.getByRole('button', { name: 'Go to step 1: Basics' }))
    await userEvent.click(screen.getByRole('button', { name: 'Go to step 2: Sport' }))
    await userEvent.click(screen.getByRole('button', { name: 'Go to step 3: Availability' }))
    expect(onNavigate.mock.calls.map((c) => c[0])).toEqual([0, 1, 2])
  })
})
