import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import CheckOutPage from './CheckOutPage'
import type { Reservation } from '@/types'

const { mockUseReservations, mockUseExtendStay, mockUseCheckInOutModal } = vi.hoisted(() => ({
  mockUseReservations: vi.fn(),
  mockUseExtendStay: vi.fn(),
  mockUseCheckInOutModal: vi.fn(),
}))

vi.mock('@/hooks/useApi', () => ({
  useReservations: (params?: Record<string, unknown>) => mockUseReservations(params),
  useExtendStay: () => mockUseExtendStay(),
}))

vi.mock('@/hooks/useCheckInOutModal', () => ({
  useCheckInOutModal: (action: string) => mockUseCheckInOutModal(action),
}))

vi.mock('@/components/shared/ReservationDetailModal', () => ({
  ReservationDetailModal: () => null,
}))
vi.mock('@/components/shared/ReservationFormModal', () => ({
  ReservationFormModal: () => null,
}))
vi.mock('@/components/shared/ReservationCheckInOutModal', () => ({
  ReservationCheckInOutModal: () => null,
}))
vi.mock('@/components/shared/ExtendStayModal', () => ({ ExtendStayModal: () => null }))
vi.mock('@/components/shared/ReservationRowActions', () => ({
  ReservationRowActions: ({ onView }: Record<string, (r: Reservation) => void>) => (
    <button onClick={() => onView(reservationArg)}>View</button>
  ),
}))

const reservationArg: Reservation = { id: 0 } as Reservation

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 1,
    reservation_number: 'BK-2026-0002',
    guest: { id: 1, first_name: 'Jane', last_name: 'Smith', email: 'jane@s.com' } as Reservation['guest'],
    room: {
      id: 2,
      room_number: '102',
      room_type: { id: 1, name: 'Deluxe', base_price: '3500.00' },
    } as unknown as Reservation['room'],
    status: 'checked_in',
    check_in: '2026-08-01',
    check_out: '2026-08-03',
    adults: 2,
    children: 0,
    total_amount: 3300,
    paid_amount: 3300,
    due_amount: 0,
    payment_status: 'paid',
    is_overdue: false,
    created_at: '2026-08-01T00:00:00.000000Z',
    ...overrides,
  }
}

function paginated(reservations: Reservation[]) {
  return {
    data: reservations,
    current_page: 1,
    last_page: 1,
    per_page: reservations.length || 10,
    total: reservations.length,
  }
}

function setupMocks({ listData }: { listData: Reservation[] }) {
  mockUseReservations.mockImplementation(() => ({
    data: paginated(listData),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }))
  mockUseExtendStay.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mockUseCheckInOutModal.mockReturnValue({
    target: null, error: null, isLoading: false, isOpen: false,
    open: vi.fn(), close: vi.fn(), confirm: vi.fn(), confirmAfterPayment: vi.fn(),
  })
}

describe('CheckOutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page header', () => {
    setupMocks({ listData: [reservation()] })

    render(<CheckOutPage />)

    expect(screen.getByText('Check Out')).toBeInTheDocument()
  })

  it('renders rich guest, room and departure columns with nights', () => {
    setupMocks({ listData: [reservation()] })

    render(<CheckOutPage />)

    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('jane@s.com')).toBeInTheDocument()
    expect(screen.getByText('102')).toBeInTheDocument()
    expect(screen.getByText('Deluxe')).toBeInTheDocument()
    expect(screen.getByText('3 Aug 2026')).toBeInTheDocument()
    expect(screen.getByText(/arrived 1 Aug 2026 · 2 nights/)).toBeInTheDocument()
  })

  it('shows Settled line for fully-paid reservations', () => {
    setupMocks({ listData: [reservation()] })

    render(<CheckOutPage />)

    expect(screen.getByText('Settled')).toBeInTheDocument()
  })

  it('shows Due line for reservations with balance', () => {
    setupMocks({
      listData: [reservation({ due_amount: 300, paid_amount: 3000, payment_status: 'partial' })],
    })

    render(<CheckOutPage />)

    expect(screen.getByText('Due ₱300.00')).toBeInTheDocument()
  })

  it('shows custom empty state when no departures match', () => {
    setupMocks({ listData: [] })

    render(<CheckOutPage />)

    expect(screen.getByText('No departures match your search')).toBeInTheDocument()
  })
})
