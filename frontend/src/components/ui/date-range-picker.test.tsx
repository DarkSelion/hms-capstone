import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DateRangePicker } from './date-range-picker'

function Harness({ min, max }: { min?: string; max?: string }) {
  const [range, setRange] = useState({ from: '', to: '' })
  return <DateRangePicker value={range} onChange={setRange} min={min} max={max} clearable />
}

describe('DateRangePicker range selection', () => {
  it('shows the start-date hint and guides through both bounds', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: /Select dates/ }))
    expect(screen.getByText('Select start date')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '18' }))
    expect(screen.getByText('Select end date')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '20' }))
    expect(screen.queryByText('Select end date')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Aug 18, 2026 — Aug 20, 2026/ })).toBeInTheDocument()
  })

  it('highlights the range while hovering the end bound', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: /Select dates/ }))
    fireEvent.click(screen.getByRole('button', { name: '18' }))

    fireEvent.mouseEnter(screen.getByRole('button', { name: '21' }))
    const middle = screen.getByRole('button', { name: '19' })
    expect(middle.className).toContain('bg-primary/10')
  })

  it('closes the popup once both bounds are selected', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: /Select dates/ }))
    fireEvent.click(screen.getByRole('button', { name: '18' }))
    fireEvent.click(screen.getByRole('button', { name: '20' }))

    expect(screen.queryByText('Su')).not.toBeInTheDocument()
  })
})

describe('DateRangePicker clearable', () => {
  it('shows the clear button only when a full range is set', () => {
    const result = render(<DateRangePicker value={{ from: '', to: '' }} onChange={vi.fn()} clearable />)
    expect(screen.queryByRole('button', { name: 'Clear date range' })).not.toBeInTheDocument()

    result.rerender(<DateRangePicker value={{ from: '2026-10-10', to: '2026-10-12' }} onChange={vi.fn()} clearable />)
    expect(screen.getByRole('button', { name: 'Clear date range' })).toBeInTheDocument()
  })

  it('clears the range without opening the popup', () => {
    const onChange = vi.fn()
    render(<DateRangePicker value={{ from: '2026-10-10', to: '2026-10-12' }} onChange={onChange} clearable />)

    fireEvent.click(screen.getByRole('button', { name: 'Clear date range' }))

    expect(onChange).toHaveBeenCalledWith({ from: '', to: '' })
    expect(screen.queryByText('Su')).not.toBeInTheDocument()
  })

  it('does not render the clear button when clearable is not set', () => {
    render(<DateRangePicker value={{ from: '2026-10-10', to: '2026-10-12' }} onChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Clear date range' })).not.toBeInTheDocument()
  })
})

describe('DateRangePicker grid navigation', () => {
  function openPicker() {
    render(<DateRangePicker value={{ from: '2026-10-10', to: '2026-10-12' }} onChange={vi.fn()} min="2000-01-01" />)
    fireEvent.click(screen.getByRole('button', { name: /Oct 10, 2026/ }))
  }

  it('opens the months grid when the header label is clicked', () => {
    openPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Switch view' }))
    expect(screen.getByText('Oct')).toBeInTheDocument()
    expect(screen.queryByText('Su')).not.toBeInTheDocument()
  })

  it('selecting a month returns to the days grid', () => {
    openPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Switch view' }))
    fireEvent.click(screen.getByRole('button', { name: 'Feb' }))
    expect(screen.getByText('Su')).toBeInTheDocument()
  })

  it('opens the years grid from the months view', () => {
    openPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Switch view' }))
    fireEvent.click(screen.getByRole('button', { name: 'Switch view' }))
    expect(screen.getByText('2026')).toBeInTheDocument()
  })

  it('selecting a year returns to the months grid', () => {
    openPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Switch view' }))
    fireEvent.click(screen.getByRole('button', { name: 'Switch view' }))
    fireEvent.click(screen.getByRole('button', { name: '2020' }))
    expect(screen.getByText('Jan')).toBeInTheDocument()
  })

  it('decade chevron changes the years shown', () => {
    openPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Switch view' }))
    fireEvent.click(screen.getByRole('button', { name: 'Switch view' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(screen.getByText('2014')).toBeInTheDocument()
  })

  it('max disables out-of-range years', () => {
    render(<DateRangePicker value={{ from: '2026-10-10', to: '2026-10-12' }} onChange={vi.fn()} min="2000-01-01" max="2026-10-15" />)
    fireEvent.click(screen.getByRole('button', { name: /Oct 10, 2026/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Switch view' }))
    fireEvent.click(screen.getByRole('button', { name: 'Switch view' }))
    const futureYear = screen.getByRole('button', { name: '2027' })
    expect((futureYear as HTMLButtonElement).disabled).toBe(true)
  })

  it('max disables future days', () => {
    render(<DateRangePicker value={{ from: '2026-10-10', to: '2026-10-12' }} onChange={vi.fn()} min="2000-01-01" max="2026-10-15" />)
    fireEvent.click(screen.getByRole('button', { name: /Oct 10, 2026/ }))
    const futureDay = screen.getByRole('button', { name: '20' })
    expect((futureDay as HTMLButtonElement).disabled).toBe(true)
  })
})
