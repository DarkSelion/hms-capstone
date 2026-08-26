import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ReservationsPage from './ReservationsPage'
import type { Reservation } from '@/types'

const {
  mockUseReservations,
  mockUseCancelReservation,
  mockUseMarkNoShow,
  mockUseExtendStay,
  mockUseCheckInOutModal,
  mockUseSearchParams,
} = vi.hoisted(() => ({
  mockUseReservations: vi.fn(),
  mockUseCancelReservation: vi.fn(),
  mockUseMarkNoShow: vi.fn(),
  mockUseExtendStay: vi.fn(),
  mockUseCheckInOutModal: vi.fn(),
  mockUseSearchParams: vi.fn(),
}))

vi.mock('@/hooks/useApi', () => ({
  useReservations: (params?: Record<string, unknown>) => mockUseReservations(params),
  useCancelReservation: () => mockUseCancelReservation(),
  useMarkNoShow: () => mockUseMarkNoShow(),
  useExtendStay: () => mockUseExtendStay(),
}))

vi.mock('@/hooks/useCheckInOutModal', () => ({
  useCheckInOutModal: (action: string) => mockUseCheckInOutModal(action),
}))

vi.mock('react-router-dom', () => ({
  useSearchParams: () => mockUseSearchParams(),
}))

// Modal children: render nothing so the page logic is what's under test.
vi.mock('@/components/shared/ReservationDetailModal', () => ({
  ReservationDetailModal: () => null,
}))
vi.mock('@/components/shared/ReservationFormModal', () => ({
  ReservationFormModal: () => null,
}))
vi.mock('@/components/shared/ReservationCheckInOutModal', () => ({
  ReservationCheckInOutModal: () => null,
}))
vi.mock('@/components/shared/ReservationRowActions', () => ({
  ReservationRowActions: ({ onView, onEdit, onCancel, onCheckIn }: Record<string, (r: Reservation) => void>) => (
    <div>
      <button onClick={() => onView(reservationArg)}>View</button>
      <button onClick={() => onEdit(reservationArg)}>Edit</button>
      <button onClick={() => onCancel(reservationArg)}>Cancel Action</button>
      <button onClick={() => onCheckIn(reservationArg)}>Check In Action</button>
    </div>
  ),
}))
vi.mock('@/components/shared/NoShowModal', () => ({ NoShowModal: () => null }))
vi.mock('@/components/shared/CancelReservationModal', () => ({
  CancelReservationModal: ({ reservation }: { reservation: Reservation | null }) =>
    reservation ? <div>Cancel dialog for {reservation.reservation_number}</div> : null,
}))
vi.mock('@/components/shared/ExtendStayModal', () => ({ ExtendStayModal: () => null }))

const reservationArg: Reservation = { id: 0 } as Reservation

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 1,
    reservation_number: 'BK-2026-0001',
    guest: { id: 1, first_name: 'John', last_name: 'Doe', email: 'j@d.com' } as Reservation['guest'],
    room: { id: 1, room_number: '101' } as Reservation['room'],
    status: 'confirmed',
    check_in: '2026-08-01',
    check_out: '2026-08-03',
    adults: 2,
    children: 0,
    total_amount: 3300,
    paid_amount: 0,
    due_amount: 3300,
    payment_status: 'unpaid',
    is_overdue: false,
    created_at: '2026-08-01T00:00:00.000000Z',
    ...overrides,
  }
}

function paginated(reservations: Reservation[], total?: number) {
  return {
    data: reservations,
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: total ?? reservations.length,
  }
}

function renderPage(data: ReturnType<typeof paginated> = paginated([reservation()])) {
  mockUseSearchParams.mockReturnValue([new URLSearchParams(''), vi.fn()])
  mockUseReservations.mockReturnValue({ data, isLoading: false, error: null, refetch: vi.fn() })
  mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn() })
  mockUseMarkNoShow.mockReturnValue({ mutateAsync: vi.fn() })
  mockUseExtendStay.mockReturnValue({ mutateAsync: vi.fn() })
  const modal = {
    target: null,
    error: null,
    isLoading: false,
    isOpen: false,
    open: vi.fn(),
    close: vi.fn(),
    confirm: vi.fn(),
    confirmAfterPayment: vi.fn(),
  }
  mockUseCheckInOutModal.mockReturnValue(modal)
  return render(<ReservationsPage />)
}

describe('ReservationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page header with New Reservation button', () => {
    renderPage()

    expect(screen.getByText('Reservations')).toBeInTheDocument()
    expect(screen.getByText('Manage hotel reservations')).toBeInTheDocument()
    expect(screen.getByText('New Reservation')).toBeInTheDocument()
  })

  it('renders reservation rows with guest, room and total', () => {
    renderPage()

    expect(screen.getByText('BK-2026-0001')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('101')).toBeInTheDocument()
    expect(screen.getByText('₱3,300.00')).toBeInTheDocument()
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThanOrEqual(1)
  })

  it('shows Overdue badge when reservation is overdue', () => {
    renderPage(paginated([reservation({ status: 'confirmed', is_overdue: true })]))

    expect(screen.getByText('Overdue')).toBeInTheDocument()
  })

  it('passes search term to useReservations', () => {
    renderPage()

    fireEvent.change(screen.getByPlaceholderText(/Search by reservation/), {
      target: { value: 'juan' },
    })

    expect(mockUseReservations).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'juan', page: 1 }),
    )
  })

  it('shows loading state', () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams(''), vi.fn()])
    mockUseReservations.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() })
    mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn() })
    mockUseMarkNoShow.mockReturnValue({ mutateAsync: vi.fn() })
    mockUseExtendStay.mockReturnValue({ mutateAsync: vi.fn() })
    mockUseCheckInOutModal.mockReturnValue({
      target: null, error: null, isLoading: false, isOpen: false,
      open: vi.fn(), close: vi.fn(), confirm: vi.fn(), confirmAfterPayment: vi.fn(),
    })

    render(<ReservationsPage />)

    expect(screen.getByText('New Reservation')).toBeInTheDocument()
  })

  it('shows error state with retry', () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams(''), vi.fn()])
    mockUseReservations.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom'), refetch: vi.fn() })
    mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn() })
    mockUseMarkNoShow.mockReturnValue({ mutateAsync: vi.fn() })
    mockUseExtendStay.mockReturnValue({ mutateAsync: vi.fn() })
    mockUseCheckInOutModal.mockReturnValue({
      target: null, error: null, isLoading: false, isOpen: false,
      open: vi.fn(), close: vi.fn(), confirm: vi.fn(), confirmAfterPayment: vi.fn(),
    })

    render(<ReservationsPage />)

    expect(screen.getByText('Failed to load reservations')).toBeInTheDocument()
  })

  it('shows custom empty state when no reservations', () => {
    renderPage(paginated([]))

    expect(screen.getByText('No reservations match your filters')).toBeInTheDocument()
  })

  it('updates the status URL param when the status dropdown changes', () => {
    const setParams = vi.fn()
    mockUseSearchParams.mockReturnValue([new URLSearchParams(''), setParams])
    mockUseReservations.mockReturnValue({
      data: paginated([reservation()]),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn() })
    mockUseMarkNoShow.mockReturnValue({ mutateAsync: vi.fn() })
    mockUseExtendStay.mockReturnValue({ mutateAsync: vi.fn() })
    mockUseCheckInOutModal.mockReturnValue({
      target: null, error: null, isLoading: false, isOpen: false,
      open: vi.fn(), close: vi.fn(), confirm: vi.fn(), confirmAfterPayment: vi.fn(),
    })

    render(<ReservationsPage />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'confirmed' } })

    expect(setParams).toHaveBeenCalledWith(expect.any(Function))
  })

  it('renders stay range with nights count', () => {
    renderPage()

    expect(screen.getByText('1 Aug 2026')).toBeInTheDocument()
    expect(screen.getByText('3 Aug 2026')).toBeInTheDocument()
    expect(screen.getByText('2 nights')).toBeInTheDocument()
  })

  it('shows due amount under total for unpaid reservations', () => {
    renderPage()

    expect(screen.getByText('Due ₱3,300.00')).toBeInTheDocument()
  })

  it('shows Fully paid under total for settled reservations', () => {
    renderPage(paginated([reservation({ payment_status: 'paid', paid_amount: 3300, due_amount: 0 })]))

    expect(screen.getByText('Fully paid')).toBeInTheDocument()
  })

  it('shows active filter bar with clear all after searching', () => {
    renderPage()

    fireEvent.change(screen.getByPlaceholderText(/Search by reservation/), {
      target: { value: 'juan' },
    })

    expect(screen.getByText('Active filters:')).toBeInTheDocument()
    expect(screen.getByText(/Clear all/)).toBeInTheDocument()
  })

  it('passes status filter from URL to the query', () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams('status=checked_in'), vi.fn()])
    mockUseReservations.mockReturnValue({
      data: paginated([reservation({ status: 'checked_in' })]),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn() })
    mockUseMarkNoShow.mockReturnValue({ mutateAsync: vi.fn() })
    mockUseExtendStay.mockReturnValue({ mutateAsync: vi.fn() })
    mockUseCheckInOutModal.mockReturnValue({
      target: null, error: null, isLoading: false, isOpen: false,
      open: vi.fn(), close: vi.fn(), confirm: vi.fn(), confirmAfterPayment: vi.fn(),
    })

    render(<ReservationsPage />)

    expect(mockUseReservations).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'checked_in' }),
    )
    expect(screen.getAllByText('Checked In').length).toBeGreaterThanOrEqual(1)
  })

  it('opens cancel dialog from row action', () => {
    renderPage()

    fireEvent.click(screen.getByText('Cancel Action'))

    expect(screen.getByText('Cancel dialog for BK-2026-0001')).toBeInTheDocument()
  })

  it('opens check-in modal from row action', () => {
    renderPage()

    const modal = mockUseCheckInOutModal.mock.results[0]?.value
    fireEvent.click(screen.getByText('Check In Action'))

    expect(modal.open).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
  })
})