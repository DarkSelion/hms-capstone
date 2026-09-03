import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PublicMyReservationsPage from './PublicMyReservationsPage'
import type { PublicReservation } from '@/types'

const {
  mockUsePublicMe,
  mockUsePublicReservations,
  mockUsePublicCancelReservation,
  mockUsePublicInitiateOnlinePayment,
  mockUsePublicSettings,
  mockUsePaymentSettings,
  mockUsePortalCurrency,
  mockUseAuthStore,
  mockUseToast,
} = vi.hoisted(() => ({
  mockUsePublicMe: vi.fn(),
  mockUsePublicReservations: vi.fn(),
  mockUsePublicCancelReservation: vi.fn(),
  mockUsePublicInitiateOnlinePayment: vi.fn(),
  mockUsePublicSettings: vi.fn(),
  mockUsePaymentSettings: vi.fn(),
  mockUsePortalCurrency: vi.fn(),
  mockUseAuthStore: vi.fn(),
  mockUseToast: vi.fn(),
}))

vi.mock('@/hooks/usePublicApi', () => ({
  usePublicMe: () => mockUsePublicMe(),
  usePublicReservations: () => mockUsePublicReservations(),
  usePublicCancelReservation: () => mockUsePublicCancelReservation(),
  usePublicInitiateOnlinePayment: () => mockUsePublicInitiateOnlinePayment(),
  usePublicSettings: (group: string) => mockUsePublicSettings(group),
  usePaymentSettings: () => mockUsePaymentSettings(),
  usePortalCurrency: () => mockUsePortalCurrency(),
}))

vi.mock('@/stores/publicAuthStore', () => ({
  usePublicAuthStore: (selector?: (s: unknown) => unknown) => mockUseAuthStore(selector),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => mockUseToast(),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

function reservation(overrides: Partial<PublicReservation> = {}): PublicReservation {
  return {
    id: 1,
    reservation_number: 'BK-2026-0001',
    room: {
      id: 1,
      room_number: '101',
      room_type: {
        id: 1,
        name: 'Deluxe Room',
        slug: 'deluxe-room',
        base_price: 1500,
        capacity: 2,
        max_adults: 2,
        max_children: 1,
        is_active: true,
      },
      floor: 1,
      status: 'available',
    },
    status: 'confirmed',
    check_in: '2026-09-01',
    check_out: '2026-09-03',
    adults: 2,
    children: 0,
    total_amount: 3300,
    paid_amount: 0,
    due_amount: 3300,
    payment_status: 'unpaid',
    created_at: '2026-08-01T00:00:00.000000Z',
    ...overrides,
  }
}

function renderPage(reservations: PublicReservation[] = [reservation()], bookingSettings: Record<string, string> = {}) {
  mockUseAuthStore.mockReturnValue({ token: 'test-token' })
  mockUsePublicReservations.mockReturnValue({
    data: { data: reservations, current_page: 1, last_page: 1, per_page: 10, total: reservations.length },
    isLoading: false,
    error: null,
  })
  mockUsePublicSettings.mockImplementation((group: string) => {
    if (group === 'booking') return { data: { check_out_time: '23:00', ...bookingSettings }, isLoading: false, error: null }
    return { data: {}, isLoading: false, error: null }
  })
  return render(<PublicMyReservationsPage />)
}

describe('PublicMyReservationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePaymentSettings.mockReturnValue({ online_gateway_enabled: '1' })
    mockUsePortalCurrency.mockReturnValue('PHP')
    mockUsePublicMe.mockReturnValue({
      data: { id: 99, first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
      isLoading: false,
    })
    mockUseToast.mockReturnValue({ addToast: vi.fn() })
    mockUsePublicCancelReservation.mockReturnValue({ mutate: vi.fn(), isPending: false })
    mockUsePublicInitiateOnlinePayment.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null })
  })

  it('shows sign-in prompt when not authenticated', () => {
    mockUseAuthStore.mockReturnValue({ token: null })
    mockUsePublicReservations.mockReturnValue({
      data: { data: [], current_page: 1, last_page: 1, per_page: 10, total: 0 },
      isLoading: false,
      error: null,
    })
    mockUsePublicSettings.mockReturnValue({ data: {}, isLoading: false, error: null })

    render(<PublicMyReservationsPage />)

    expect(screen.getByText('Please sign in to view your reservations.')).toBeInTheDocument()
    expect(screen.getByText('Sign In')).toBeInTheDocument()
  })

  it('renders reservation card with room and price details', () => {
    renderPage()

    expect(screen.getByText('BK-2026-0001')).toBeInTheDocument()
    expect(screen.getByText('Deluxe Room')).toBeInTheDocument()
    expect(screen.getByText(/Room 101/)).toBeInTheDocument()
    expect(screen.getByText('₱3,300.00')).toBeInTheDocument()
    // Both nights and adults are 2 — assert via the cell labels
    expect(screen.getByText('Nights')).toBeInTheDocument()
    expect(screen.getByText('Guests')).toBeInTheDocument()
  })

  it('shows full check-in → check-out date range in the Stay cell', () => {
    renderPage([
      reservation({ check_in: '2026-08-17', check_out: '2026-08-19' }),
    ])

    // Should show the full range, not just check-in with a dangling arrow
    expect(screen.getByText('Aug 17 → Aug 19')).toBeInTheDocument()
  })

  it('shows Pay Now button when gateway enabled and unpaid', () => {
    renderPage()

    expect(screen.getByText(/Pay ₱3,300\.00/)).toBeInTheDocument()
  })

  it('shows unavailable notice when gateway disabled', () => {
    mockUsePaymentSettings.mockReturnValue({ online_gateway_enabled: '0' })

    renderPage()

    expect(screen.getByText('Online Payment Unavailable')).toBeInTheDocument()
    expect(screen.queryByText(/Pay ₱/)).not.toBeInTheDocument()
  })

  it('hides pay actions for no-show reservations', () => {
    renderPage([
      reservation({ status: 'no_show', payment_status: 'unpaid' }),
    ])

    expect(screen.queryByText(/Pay ₱/)).not.toBeInTheDocument()
    expect(screen.queryByText('Online Payment Unavailable')).not.toBeInTheDocument()
  })

  it('hides pay actions for checked-out reservations', () => {
    renderPage([
      reservation({ status: 'checked_out', payment_status: 'unpaid' }),
    ])

    expect(screen.queryByText(/Pay ₱/)).not.toBeInTheDocument()
    expect(screen.queryByText('Online Payment Unavailable')).not.toBeInTheDocument()
  })

  it('hides pay actions for cancelled reservations', () => {
    renderPage([
      reservation({ status: 'cancelled', payment_status: 'unpaid' }),
    ])

    expect(screen.queryByText(/Pay ₱/)).not.toBeInTheDocument()
    expect(screen.queryByText('Online Payment Unavailable')).not.toBeInTheDocument()
  })

  it('keeps Pay Now for checked-in reservations with a balance', () => {
    renderPage([
      reservation({ status: 'checked_in', payment_status: 'partial', paid_amount: 1000, due_amount: 2300 }),
    ])

    expect(screen.getByText(/Pay ₱2,300\.00/)).toBeInTheDocument()
  })

  it('hides both pay actions for no-show when gateway disabled', () => {
    mockUsePaymentSettings.mockReturnValue({ online_gateway_enabled: '0' })

    renderPage([
      reservation({ status: 'no_show', payment_status: 'unpaid' }),
    ])

    expect(screen.queryByText(/Pay ₱/)).not.toBeInTheDocument()
    expect(screen.queryByText('Online Payment Unavailable')).not.toBeInTheDocument()
  })

  it('shows partial payment balance', () => {
    renderPage([
      reservation({
        payment_status: 'partial',
        paid_amount: 1000,
        due_amount: 2300,
      }),
    ])

    expect(screen.getByText(/Balance ₱2,300\.00/)).toBeInTheDocument()
  })

  it('opens cancel dialog and shows error inline when cancel fails', async () => {
    const cancelMutate = vi.fn((_id: number, opts: { onSuccess?: () => void; onError?: (e: Error) => void }) => {
      opts.onError?.(new Error('Cannot cancel checked-in reservations.'))
    })
    mockUsePublicCancelReservation.mockReturnValue({
      mutate: cancelMutate,
      isPending: false,
    })

    renderPage()

    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.getByText('Cancel Reservation')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Yes, Cancel'))

    await waitFor(() => {
      expect(screen.getByText('Cannot cancel checked-in reservations.')).toBeInTheDocument()
    })

    expect(screen.getByText('Cancel Reservation')).toBeInTheDocument()
    expect(cancelMutate).toHaveBeenCalledWith(1, expect.objectContaining({ onError: expect.any(Function) }))
  })

  it('closes cancel dialog on success', async () => {
    const cancelMutate = vi.fn((_id: number, opts: { onSuccess?: () => void }) => {
      opts.onSuccess?.()
    })
    mockUsePublicCancelReservation.mockReturnValue({
      mutate: cancelMutate,
      isPending: false,
    })

    renderPage()

    fireEvent.click(screen.getByText('Cancel'))
    fireEvent.click(screen.getByText('Yes, Cancel'))

    await waitFor(() => {
      expect(screen.queryByText('Yes, Cancel')).not.toBeInTheDocument()
    })
  })

  it('opens payment modal and redirects on successful initiate', async () => {
    const redirectUrl = 'https://gateway.test/pay?token=abc'
    const initiateMutate = vi.fn((_id: number, opts: { onSuccess: (res: { redirect_url: string }) => void }) => {
      opts.onSuccess({ redirect_url: redirectUrl })
    })
    mockUsePublicInitiateOnlinePayment.mockReturnValue({
      mutate: initiateMutate,
      isPending: false,
      isError: false,
      error: null,
    })
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '' },
    })

    renderPage()

    fireEvent.click(screen.getByText(/Pay ₱3,300\.00/))
    expect(screen.getByText('Make Payment')).toBeInTheDocument()
    expect(screen.getByText('Continue to Secure Payment')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Continue to Secure Payment'))

    await waitFor(() => {
      expect(window.location.href).toBe(redirectUrl)
    })

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    })
  })

  it('shows initiate error inline in payment modal', async () => {
    mockUsePublicInitiateOnlinePayment.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: new Error('Gateway not configured yet.'),
    })

    renderPage()

    fireEvent.click(screen.getByText(/Pay ₱3,300\.00/))

    expect(screen.getByText('Gateway not configured yet.')).toBeInTheDocument()
  })

  it('shows status badges with no_show mapping', () => {
    renderPage([
      reservation({ status: 'no_show', payment_status: 'refunded' }),
    ])

    expect(screen.getByText('no show')).toBeInTheDocument()
    expect(screen.getByText('refunded')).toBeInTheDocument()
  })

  it('filters by upcoming when tab clicked', () => {
    const upcoming = reservation({ id: 1, check_in: '2026-09-01', check_out: '2026-09-03' })
    const past = reservation({
      id: 2,
      reservation_number: 'BK-2026-0002',
      status: 'checked_out',
      check_in: '2026-01-01',
      check_out: '2026-01-03',
    })

    renderPage([upcoming, past])

    fireEvent.click(screen.getByRole('button', { name: /Upcoming/ }))

    expect(screen.getByText('BK-2026-0001')).toBeInTheDocument()
    expect(screen.queryByText('BK-2026-0002')).not.toBeInTheDocument()
  })

  it('shows empty state when no reservations', () => {
    renderPage([])

    expect(screen.getByText('No bookings yet')).toBeInTheDocument()
    expect(screen.getByText('Browse Rooms')).toBeInTheDocument()
  })

  it('uses configured currency code', () => {
    mockUsePortalCurrency.mockReturnValue('USD')

    renderPage()

    expect(screen.getByText('$3,300.00')).toBeInTheDocument()
  })

  it('shows booking count in hero badge', () => {
    renderPage([reservation(), reservation({ id: 2, reservation_number: 'BK-2026-0002' })])

    expect(screen.getByText(/2 bookings/)).toBeInTheDocument()
  })

  it('opens reservation details modal when Details clicked', () => {
    renderPage()

    fireEvent.click(screen.getByText('Details'))

    expect(screen.getByText(/Booking BK-2026-0001/)).toBeInTheDocument()
  })

  it('sorts upcoming first, then past (incl. no_show), then cancelled', () => {
    const upcomingFar = reservation({
      id: 1, reservation_number: 'BK-UPCOMING-FAR',
      status: 'confirmed', check_in: '2026-12-01', check_out: '2026-12-03',
    })
    const upcomingNear = reservation({
      id: 2, reservation_number: 'BK-UPCOMING-NEAR',
      status: 'confirmed', check_in: '2026-09-05', check_out: '2026-09-07',
    })
    const past = reservation({
      id: 3, reservation_number: 'BK-PAST',
      status: 'checked_out', check_in: '2026-01-01', check_out: '2026-01-03',
    })
    const noShow = reservation({
      id: 4, reservation_number: 'BK-NO-SHOW',
      status: 'no_show', check_in: '2026-06-01', check_out: '2026-06-03',
    })
    const cancelled = reservation({
      id: 5, reservation_number: 'BK-CANCELLED',
      status: 'cancelled', check_in: '2026-03-01', check_out: '2026-03-03',
    })

    // Render in a non-sorted order to prove the page is sorting
    renderPage([cancelled, noShow, past, upcomingFar, upcomingNear])

    const refs = screen.getAllByText(/BK-/).map((el) => el.textContent)
    expect(refs).toEqual([
      'BK-UPCOMING-NEAR',
      'BK-UPCOMING-FAR',
      'BK-NO-SHOW',
      'BK-PAST',
      'BK-CANCELLED',
    ])
  })

  it('does not show ₱NaN when paid_amount is null or non-numeric', () => {
    // Simulate the API returning null/NaN for paid_amount
    const bad = reservation({
      payment_status: 'paid',
      paid_amount: null as unknown as number,
    })
    renderPage([bad])

    // The "Spent" stat should show ₱0.00, not ₱NaN
    expect(screen.getByText('₱0.00')).toBeInTheDocument()
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
  })

  describe('check-out time card', () => {
    it('shows prominent check-out time on card body', () => {
      renderPage([reservation()], { check_out_time: '23:00' })
      expect(screen.getByText(/Check-out by 11:00 PM/)).toBeInTheDocument()
    })

    it('shows late checkout fee amount when configured', () => {
      renderPage([reservation()], { check_out_time: '23:00', late_checkout_fee: '500' })
      // Fee text is split across elements — check the parent paragraph's full text
      const cardFeeText = screen.getAllByText(/Late check-out fee/)[0]
      expect(cardFeeText).toHaveTextContent(/Late check-out fee:.*₱500/)
    })

    it('shows generic late fee message when no fee configured', () => {
      renderPage([reservation()], { check_out_time: '23:00', late_checkout_fee: '' })
      // Appears on both card body + details modal, so at least 2 matches
      const matches = screen.getAllByText(/Late check-out fees may apply/)
      expect(matches.length).toBeGreaterThanOrEqual(1)
      expect(screen.queryByText(/Late check-out fee:.*₱/)).not.toBeInTheDocument()
    })

    it('shows check-out time in details modal', () => {
      renderPage([reservation()], { check_out_time: '23:00', late_checkout_fee: '500' })
      fireEvent.click(screen.getByRole('button', { name: /details/i }))
      const checkoutLines = screen.getAllByText(/Check-out by 11:00 PM/)
      expect(checkoutLines.length).toBeGreaterThanOrEqual(2)
      const feeLines = screen.getAllByText(/Late check-out fee/)
      expect(feeLines.some(el => el.textContent?.includes('₱500'))).toBe(true)
    })

    it('shows generic message in details modal when no fee', () => {
      renderPage([reservation()], { check_out_time: '11:00', late_checkout_fee: '' })
      fireEvent.click(screen.getByRole('button', { name: /details/i }))
      const checkoutLines = screen.getAllByText(/Check-out by 11:00 AM/)
      expect(checkoutLines.length).toBeGreaterThanOrEqual(2)
      const lateFeeLines = screen.getAllByText(/Late check-out fees may apply/)
      expect(lateFeeLines.length).toBeGreaterThanOrEqual(2)
    })
  })
})
