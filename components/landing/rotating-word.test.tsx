import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import RotatingWord from './rotating-word'

const WORDS = ['athletes', 'teams', 'brands', 'you']

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('RotatingWord', () => {
  it('renders the first word initially', () => {
    render(<RotatingWord words={WORDS} />)
    expect(screen.getByText('athletes')).toBeInTheDocument()
  })

  it('advances to the next word after the interval and wraps around', () => {
    render(<RotatingWord words={WORDS} intervalMs={2500} />)
    act(() => vi.advanceTimersByTime(2500))
    expect(screen.getByText('teams')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2500 * 3))
    expect(screen.getByText('athletes')).toBeInTheDocument()
  })

  it('hides the animated word from screen readers and provides a static list', () => {
    const { container } = render(<RotatingWord words={WORDS} />)
    expect(container.querySelector('[aria-hidden="true"]')!.textContent).toContain('athletes')
    expect(screen.getByText('athletes, teams, brands and you')).toHaveClass('sr-only')
  })
})
