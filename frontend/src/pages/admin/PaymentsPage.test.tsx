import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PaymentsPage from './PaymentsPage'
import type { Payment, Reservation } from '@/types'

const { mockUsePayments, mockUseReservations } = vi.hoisted(() => ({
  mockUsePayments: vi.fn(),
  mockUseReservations: vi.fn(),
}))

vi.mock('@/hooks/useApi', () => ({
  usePayments: (params?: Record<string, unknown>) => mockUsePayments(params),
  useReservations: (params?: Record<string, unknown>) => mockUseReservations(params),
  useCreatePayment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePayment: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdatePayment: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('@/components/shared/PaymentModal', () => ({
  PaymentModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="payment-modal-stub" /> : null,
}))

function payment(overrides: Partial<Payment & { reservation?: Reservation }> = {}): Payment & { reservation?: Reservation } {
  return {
    id: 1,
    reservation_id: 1,
    amount: 330,
    payment_method: 'cash',
    status: 'completed',
    paid_at: '2026-10-01T00:00:00.000000Z',
    created_at: '2026-10-01T00:00:00.000000Z',
    reference_number: 'REF-001',
    reservation: {
      id: 1,
      reservation_number: 'BK-2026-0001',
      total_amount: 330,
      guest: { first_name: 'John', last_name: 'Doe' },
      room: { room_number: '101' },
    } as unknown as Reservation,
    ...overrides,
  }
}

function renderPage() {
  mockUsePayments.mockReturnValue({
    data: {
      data: [payment()],
      current_page: 1,
      last_page: 1,
      per_page: 10,
      total: 1,
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
  mockUseReservations.mockReturnValue({ data: { data: [] }, isLoading: false })
  return render(<PaymentsPage />)
}

describe('PaymentsPage', () => {
  beforeEach(() => {
    mockUsePayments.mockReset()
    mockUseReservations.mockReset()
  })

  it('defaults to a paid_at sort with page 1', () => {
    renderPage()
    expect(mockUsePayments).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, sort: '-paid_at' }),
    )
  })

  it('passes search, method and status filters to the API', () => {
    renderPage()

    fireEvent.change(screen.getByPlaceholderText('Search by reference or guest name...'), {
      target: { value: 'REF-001' },
    })
    const combos = screen.getAllByRole('combobox')
    fireEvent.change(combos[0], { target: { value: 'gcash' } })
    fireEvent.change(combos[1], { target: { value: 'pending' } })

    const params = mockUsePayments.mock.calls.at(-1)?.[0]
    expect(params).toEqual(
      expect.objectContaining({
        page: 1,
        sort: '-paid_at',
        search: 'REF-001',
        payment_method: 'gcash',
        status: 'pending',
      }),
    )
  })

  it('passes date range filters to the API', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /From date/ }))
    fireEvent.click(screen.getAllByRole('button', { name: '1' }).at(-1)!)

    const params = mockUsePayments.mock.calls.at(-1)?.[0]
    expect(params).toEqual(expect.objectContaining({ date_from: expect.stringMatching(/^\d{4}-\d{2}-01$/) }))
  })

  it('opens the record payment modal', () => {
    renderPage()
    expect(screen.queryByTestId('payment-modal-stub')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }))
    expect(screen.getByTestId('payment-modal-stub')).toBeInTheDocument()
  })

  it('opens the payment detail modal from a reference link', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'REF-001' }))
    expect(screen.getByText('Payment Details')).toBeInTheDocument()
    expect(screen.getByText('Reference Number')).toBeInTheDocument()
    expect(screen.getAllByText('₱330.00').length).toBeGreaterThan(0)
  })

  it('renders a friendly detail modal with amount, method, and reservation details', () => {
    mockUsePayments.mockReturnValue({
      data: {
        data: [
          payment({
            id: 7,
            reference_number: 'REF-042',
            amount: 1250,
            payment_method: 'gcash',
            status: 'completed',
            payment_type: 'partial',
            transaction_id: 'TXN-88',
            notes: 'GCash pending reference',
            paid_at: '2026-10-01T00:00:00.000000Z',
            reservation: {
              id: 9,
              reservation_number: 'BK-2026-0009',
              total_amount: 2500,
              paid_amount: 1250,
              due_amount: 1250,
              check_in: '2026-10-05',
              check_out: '2026-10-07',
              guest: { first_name: 'John', last_name: 'Doe', email: 'john@test.com' },
              room: { room_number: '204', room_type: { name: 'Deluxe' } },
            } as unknown as Reservation,
          }),
        ],
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 1,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseReservations.mockReturnValue({ data: { data: [] }, isLoading: false })
    render(<PaymentsPage />)

    fireEvent.click(screen.getByRole('button', { name: 'REF-042' }))

    expect(screen.getByText('Amount Collected')).toBeInTheDocument()
    expect(screen.getAllByText('₱1,250.00').length).toBeGreaterThan(0)
    expect(screen.getByText('Partial')).toBeInTheDocument()
    expect(screen.getByText('TXN-88')).toBeInTheDocument()
    expect(screen.getByText('GCash pending reference')).toBeInTheDocument()
    expect(screen.getByText('Reservation Details')).toBeInTheDocument()
    expect(screen.getAllByText('BK-2026-0009').length).toBeGreaterThan(0)
    expect(screen.getByText('john@test.com')).toBeInTheDocument()
    expect(screen.getByText('Deluxe')).toBeInTheDocument()
    expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0)
    expect(screen.getByText('2 nights')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Close'))
    expect(screen.queryByText('Amount Collected')).toBeNull()
  })

  it('shows em dash placeholders when optional fields are absent', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'REF-001' }))
    expect(screen.getByText('Payment Type')).toBeInTheDocument()
    expect(screen.getByText('Transaction ID')).toBeInTheDocument()
  })

  it('renders merged guest identity cell with avatar initials and booking number', () => {
    renderPage()

    expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0)
    expect(screen.getAllByText('BK-2026-0001').length).toBeGreaterThan(0)
    expect(screen.getAllByText('JD').length).toBeGreaterThan(0)
  })

  it('shows payment type subline under amount when recorded', () => {
    mockUsePayments.mockReturnValue({
      data: {
        data: [payment({ payment_type: 'full' })],
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 1,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseReservations.mockReturnValue({ data: { data: [] }, isLoading: false })
    render(<PaymentsPage />)

    expect(screen.getByText('full')).toBeInTheDocument()
  })

  it('shows active filter bar with clear all after filtering', () => {
    renderPage()

    const combos = screen.getAllByRole('combobox')
    fireEvent.change(combos[0], { target: { value: 'cash' } })

    expect(screen.getByText('Active filters:')).toBeInTheDocument()
    expect(screen.getByText('Method: Cash')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Clear all/ })).toBeInTheDocument()
  })

  it('shows custom empty state when no payments match', () => {
    mockUsePayments.mockReturnValue({
      data: { data: [], current_page: 1, last_page: 1, per_page: 10, total: 0 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseReservations.mockReturnValue({ data: { data: [] }, isLoading: false })
    render(<PaymentsPage />)

    expect(screen.getByText('No payments match your filters')).toBeInTheDocument()
  })
})
