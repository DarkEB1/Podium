import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const setTheme = vi.fn()
let resolvedTheme = 'light'

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme, setTheme, theme: resolvedTheme }),
}))

import ThemeToggle from './theme-toggle'

beforeEach(() => {
  setTheme.mockClear()
  resolvedTheme = 'light'
})

describe('ThemeToggle (NX-2 / A-1)', () => {
  it('switches to dark from a light page', async () => {
    await act(async () => {
      render(<ThemeToggle />)
    })
    const button = screen.getByTestId('theme-toggle')
    fireEvent.click(button)
    expect(setTheme).toHaveBeenCalledWith('dark')
  })

  it('switches back to light from a dark page', async () => {
    resolvedTheme = 'dark'
    await act(async () => {
      render(<ThemeToggle />)
    })
    fireEvent.click(screen.getByTestId('theme-toggle'))
    expect(setTheme).toHaveBeenCalledWith('light')
  })

  it('drives off resolvedTheme so "system" does not produce a dead first click', async () => {
    // next-themes reports theme="system" but resolvedTheme is what is painted.
    resolvedTheme = 'dark'
    await act(async () => {
      render(<ThemeToggle />)
    })
    fireEvent.click(screen.getByTestId('theme-toggle'))
    expect(setTheme).toHaveBeenCalledWith('light')
    expect(setTheme).not.toHaveBeenCalledWith('dark')
  })

  it('exposes the action it will perform, and its current state', async () => {
    await act(async () => {
      render(<ThemeToggle />)
    })
    const button = screen.getByRole('button', { name: 'Switch to dark theme' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })
})
