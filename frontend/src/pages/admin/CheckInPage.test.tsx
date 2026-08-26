import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import CheckInPage from './CheckInPage'
import type { Reservation } from '@/types'

const {
  mockUseReservations,
  mockUseCancelReservation,
  mockUseMarkNoShow,
  mockUseCheckInOutModal,
} = vi.hoisted(() => ({
  mockUseReservations: vi.fn(),
  mockUseCancelReservation: vi.fn(),
  mockUseMarkNoShow: vi.fn(),
  mockUseCheckInOutModal: vi.fn(),
}))

vi.mock('@/hooks/useApi', () => ({
  useReservations: (params?: Record<string, unknown>) => mockUseReservations(params),
  useCancelReservation: () => mockUseCancelReservation(),
  useMarkNoShow: () => mockUseMarkNoShow(),
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
vi.mock('@/components/shared/NoShowModal', () => ({ NoShowModal: () => null }))
vi.mock('@/components/shared/CancelReservationModal', () => ({
  CancelReservationModal: () => null,
}))
vi.mock('@/components/shared/ReservationRowActions', () => ({
  ReservationRowActions: ({ onView }: Record<string, (r: Reservation) => void>) => (
    <button onClick={() => onView(reservationArg)}>View</button>
  ),
}))

const reservationArg: Reservation = { id: 0 } as Reservation

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 1,
    reservation_number: 'BK-2026-0001',
    guest: { id: 1, first_name: 'John', last_name: 'Doe', email: 'j@d.com' } as Reservation['guest'],
    room: {
      id: 1,
      room_number: '101',
      room_type: { id: 1, name: 'Deluxe', base_price: '3500.00' },
    } as unknown as Reservation['room'],
    status: 'confirmed',
    check_in: '2026-08-01',
    check_out: '2026-08-03',
    adults: 2,
    children: 0,
    total_amount: 3300,
    paid_amount: 2800,
    due_amount: 500,
    payment_status: 'partial',
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
  mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mockUseMarkNoShow.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mockUseCheckInOutModal.mockReturnValue({
    target: null, error: null, isLoading: false, isOpen: false,
    open: vi.fn(), close: vi.fn(), confirm: vi.fn(), confirmAfterPayment: vi.fn(),
  })
}

describe('CheckInPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page header', () => {
    setupMocks({ listData: [reservation()] })

    render(<CheckInPage />)

    expect(screen.getByText('Check In')).toBeInTheDocument()
  })

  it('renders rich guest, room and arrival columns', () => {
    setupMocks({ listData: [reservation()] })

    render(<CheckInPage />)

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('j@d.com')).toBeInTheDocument()
    expect(screen.getByText('101')).toBeInTheDocument()
    expect(screen.getByText('Deluxe')).toBeInTheDocument()
    expect(screen.getByText('1 Aug 2026')).toBeInTheDocument()
    expect(screen.getByText(/departs 3 Aug 2026/)).toBeInTheDocument()
    expect(screen.getByText('2 Adults')).toBeInTheDocument()
  })

  it('renders billing cell with payment badge and due line', () => {
    setupMocks({ listData: [reservation()] })

    render(<CheckInPage />)

    expect(screen.getAllByText('₱3,300.00').length).toBeGreaterThan(0)
    expect(screen.getByText('Due ₱500.00')).toBeInTheDocument()
  })

  it('shows Overdue indicator for overdue reservations', () => {
    setupMocks({ listData: [reservation({ is_overdue: true })] })

    render(<CheckInPage />)

    expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0)
  })

  it('shows custom empty state when no arrivals match', () => {
    setupMocks({ listData: [] })

    render(<CheckInPage />)

    expect(screen.getByText('No arrivals match your search')).toBeInTheDocument()
    // Clear search button only appears when a search is active
    expect(screen.queryByText('Clear search')).not.toBeInTheDocument()
  })
})
