import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Slider } from './slider'

describe('Slider', () => {
  it('renders an accessible slider input reflecting min/max/value', () => {
    render(<Slider min={0} max={100} value={40} onChange={() => {}} />)
    const input = screen.getByRole('slider')
    expect(input).toHaveAttribute('min', '0')
    expect(input).toHaveAttribute('max', '100')
    expect(input).toHaveAttribute('aria-valuenow', '40')
  })

  it('shows the raw value when no format is provided', () => {
    render(<Slider min={0} max={100} value={40} onChange={() => {}} />)
    expect(screen.getByText('40')).toBeInTheDocument()
  })

  it('shows the formatted value when format is provided', () => {
    render(
      <Slider
        min={0}
        max={1000}
        value={250}
        onChange={() => {}}
        format={(n) => `£${n}`}
      />
    )
    expect(screen.getByText('£250')).toBeInTheDocument()
  })

  it('calls onChange with the new numeric value on keyboard interaction', () => {
    const onChange = vi.fn()
    render(<Slider min={0} max={10} step={1} value={5} onChange={onChange} />)
    const input = screen.getByRole('slider')
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith(6)
  })
})
