import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ReportsPage from './ReportsPage'
import { toLocalDateStr, formatDateDisplay } from '@/lib/format'

const { mockUseRevenueReport, mockUseOccupancyReport, mockUseReservationReport, mockDownloadFile } = vi.hoisted(() => ({
  mockUseRevenueReport: vi.fn(),
  mockUseOccupancyReport: vi.fn(),
  mockUseReservationReport: vi.fn(),
  mockDownloadFile: vi.fn(),
}))

vi.mock('@/hooks/useApi', () => ({
  useRevenueReport: (params?: Record<string, unknown>) => mockUseRevenueReport(params),
  useOccupancyReport: (params?: Record<string, unknown>) => mockUseOccupancyReport(params),
  useReservationReport: (params?: Record<string, unknown>) => mockUseReservationReport(params),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('@/lib/api', () => ({
  downloadFile: (...args: unknown[]) => mockDownloadFile(...args),
}))

function lastNDays(n: number): { from: string; to: string } {
  const today = new Date()
  return {
    from: toLocalDateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (n - 1))),
    to: toLocalDateStr(today),
  }
}

function shortDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function renderPage() {
  mockUseRevenueReport.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() })
  mockUseOccupancyReport.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() })
  mockUseReservationReport.mockReturnValue({ data: { total: 0, status_breakdown: [] }, isLoading: false, error: null, refetch: vi.fn() })
  return render(<ReportsPage />)
}

describe('ReportsPage', () => {
  beforeEach(() => {
    mockUseRevenueReport.mockReset()
    mockUseOccupancyReport.mockReset()
    mockUseReservationReport.mockReset()
    mockDownloadFile.mockReset()
  })

  it('defaults the Revenue report to the last 30 days', () => {
    renderPage()
    const expected = lastNDays(30)
    expect(mockUseRevenueReport).toHaveBeenCalledWith(expect.objectContaining({ from: expected.from, to: expected.to }))
  })

  it('applies a preset range instantly', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }))

    const expected = lastNDays(7)
    expect(mockUseRevenueReport).toHaveBeenLastCalledWith(expect.objectContaining({ from: expected.from, to: expected.to }))
  })

  it('shows the applied range summary', () => {
    renderPage()
    const expected = lastNDays(30)
    expect(screen.getByText(new RegExp(`${formatDateDisplay(expected.from)} — ${formatDateDisplay(expected.to)}`))).toBeInTheDocument()
    expect(screen.getByText(/\(30 days\)/)).toBeInTheDocument()
  })

  it('applies a custom calendar range', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Custom range/ }))

    const expected = lastNDays(30)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${shortDate(expected.from)} — ${shortDate(expected.to)}`) }))

    const vf = new Date(`${expected.from}T00:00:00`)
    const customFrom = toLocalDateStr(new Date(vf.getFullYear(), vf.getMonth(), 20))
    const customTo = toLocalDateStr(new Date(vf.getFullYear(), vf.getMonth(), 25))
    fireEvent.click(screen.getByRole('button', { name: '20' }))
    fireEvent.click(screen.getByRole('button', { name: '25' }))

    expect(mockUseRevenueReport).toHaveBeenLastCalledWith(expect.objectContaining({ from: customFrom, to: customTo }))
  })

  it('keeps per-tab ranges independent', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'This month' }))
    fireEvent.click(screen.getByRole('button', { name: 'Occupancy' }))

    const occupancyCalls = mockUseOccupancyReport.mock.calls
    expect(occupancyCalls[occupancyCalls.length - 1][0]).toEqual(
      expect.objectContaining(lastNDays(30)),
    )
  })

  it('exports the selected range from the Export tab', () => {
    mockDownloadFile.mockResolvedValue({ blob: new Blob(['x']), filename: 'revenue-report.csv' })
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:test'), writable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    const exportBtns = screen.getAllByRole('button', { name: 'Export' })
    const actionBtn = exportBtns.find((b) => b.querySelector('svg'))
    fireEvent.click(actionBtn!)

    const expected = lastNDays(30)
    expect(mockDownloadFile).toHaveBeenCalledWith(
      expect.stringContaining('/reports/export/revenue?format=csv'),
      'text/csv',
    )
    expect(mockDownloadFile.mock.calls[0][0]).toContain(`from=${expected.from}`)
    expect(mockDownloadFile.mock.calls[0][0]).toContain(`to=${expected.to}`)
  })
})
