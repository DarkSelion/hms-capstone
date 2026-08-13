import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DatePicker } from './date-picker'

function renderPicker(value = '', onChange = vi.fn()) {
  return { onChange, ...render(<DatePicker value={value} onChange={onChange} clearable />) }
}

describe('DatePicker clearable', () => {
  it('hides the clear button when no date is selected', () => {
    renderPicker('')
    expect(screen.queryByRole('button', { name: 'Clear date' })).not.toBeInTheDocument()
  })

  it('shows the clear button when a date is selected', () => {
    renderPicker('2026-10-10')
    expect(screen.getByRole('button', { name: 'Clear date' })).toBeInTheDocument()
  })

  it('clears the date without opening the popup', () => {
    const { onChange } = renderPicker('2026-10-10')

    fireEvent.click(screen.getByRole('button', { name: 'Clear date' }))

    expect(onChange).toHaveBeenCalledWith('')
    expect(screen.queryByText('Su')).not.toBeInTheDocument()
  })

  it('returns to the placeholder after the value is cleared', () => {
    const onChange = vi.fn()
    const result = renderPicker('2026-10-10', onChange)

    fireEvent.click(screen.getByRole('button', { name: 'Clear date' }))
    expect(onChange).toHaveBeenCalledWith('')

    result.rerender(<DatePicker value="" onChange={onChange} clearable />)
    expect(screen.getByText('Select date')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear date' })).not.toBeInTheDocument()
  })

  it('does not render the clear button when clearable is not set', () => {
    render(<DatePicker value="2026-10-10" onChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Clear date' })).not.toBeInTheDocument()
  })
})

describe('DatePicker portal variant', () => {
  it('renders a dark-themed trigger with placeholder', () => {
    render(<DatePicker value="" onChange={vi.fn()} portal />)
    expect(screen.getByText('Select date')).toBeInTheDocument()
  })

  it('opens a dark-themed calendar popup', () => {
    render(<DatePicker value="" onChange={vi.fn()} portal />)
    fireEvent.click(screen.getByRole('button', { name: /Select date/ }))
    expect(screen.getByText('Su')).toBeInTheDocument()
  })

  it('selects a date through the popup', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-10-10" onChange={onChange} portal />)

    fireEvent.click(screen.getByRole('button', { name: /Oct 10, 2026/ }))
    fireEvent.click(screen.getByRole('button', { name: '12' }))

    expect(onChange).toHaveBeenCalledWith('2026-10-12')
  })
})

describe('DatePicker grid navigation', () => {
  function openPicker() {
    render(<DatePicker value="2026-10-10" onChange={vi.fn()} />)
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
    render(<DatePicker value="2026-10-10" onChange={vi.fn()} max="2026-10-15" />)
    fireEvent.click(screen.getByRole('button', { name: /Oct 10, 2026/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Switch view' }))
    fireEvent.click(screen.getByRole('button', { name: 'Switch view' }))
    const futureYear = screen.getByRole('button', { name: '2027' })
    expect((futureYear as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('DatePicker mobile popup positioning', () => {
  it('clamps the popup within a narrow viewport so it never overflows', () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { value: 320, configurable: true })

    try {
      render(<DatePicker value="2026-10-10" onChange={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: /Oct 10, 2026/ }))

      let root = screen.getByText('October 2026') as HTMLElement
      while (root && root.style?.position !== 'fixed') {
        root = root.parentElement as HTMLElement
      }
      expect(root).toBeTruthy()

      const left = Number.parseInt(root.style.left, 10)
      const width = Number.parseInt(root.style.minWidth, 10)
      expect(left).toBeGreaterThanOrEqual(0)
      expect(width).toBeLessThanOrEqual(320)
      expect(left + width).toBeLessThanOrEqual(320)
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true })
    }
  })
})
