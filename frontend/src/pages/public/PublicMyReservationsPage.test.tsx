import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PublicMyReservationsPage from './PublicMyReservationsPage'
import type { PublicReservation } from '@/types'

const {
  mockUsePublicReservations,
  mockUsePublicCancelReservation,
  mockUsePublicInitiateOnlinePayment,
  mockUsePublicConfirmOnlinePayment,
  mockUsePublicSettings,
  mockUsePaymentSettings,
  mockUsePortalCurrency,
  mockUseAuthStore,
} = vi.hoisted(() => ({
  mockUsePublicReservations: vi.fn(),
  mockUsePublicCancelReservation: vi.fn(),
  mockUsePublicInitiateOnlinePayment: vi.fn(),
  mockUsePublicConfirmOnlinePayment: vi.fn(),
  mockUsePublicSettings: vi.fn(),
  mockUsePaymentSettings: vi.fn(),
  mockUsePortalCurrency: vi.fn(),
  mockUseAuthStore: vi.fn(),
}))

vi.mock('@/hooks/usePublicApi', () => ({
  usePublicReservations: () => mockUsePublicReservations(),
  usePublicCancelReservation: () => mockUsePublicCancelReservation(),
  usePublicInitiateOnlinePayment: () => mockUsePublicInitiateOnlinePayment(),
  usePublicConfirmOnlinePayment: () => mockUsePublicConfirmOnlinePayment(),
  usePublicSettings: (group: string) => mockUsePublicSettings(group),
  usePaymentSettings: () => mockUsePaymentSettings(),
  usePortalCurrency: () => mockUsePortalCurrency(),
}))

vi.mock('@/stores/publicAuthStore', () => ({
  usePublicAuthStore: (selector?: (s: unknown) => unknown) => mockUseAuthStore(selector),
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

function renderPage(reservations: PublicReservation[] = [reservation()]) {
  mockUseAuthStore.mockReturnValue({ token: 'test-token' })
  mockUsePublicReservations.mockReturnValue({
    data: { data: reservations, current_page: 1, last_page: 1, per_page: 10, total: reservations.length },
    isLoading: false,
    error: null,
  })
  mockUsePublicSettings.mockReturnValue({ data: {}, isLoading: false, error: null })
  return render(<PublicMyReservationsPage />)
}

describe('PublicMyReservationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePaymentSettings.mockReturnValue({ online_gateway_enabled: '1' })
    mockUsePortalCurrency.mockReturnValue('PHP')
    mockUsePublicConfirmOnlinePayment.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null })
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
    expect(screen.getByText('2 nights')).toBeInTheDocument()
  })

  it('shows Pay Now button when gateway enabled and unpaid', () => {
    renderPage()

    expect(screen.getByText('Pay Now')).toBeInTheDocument()
  })

  it('shows unavailable notice when gateway disabled', () => {
    mockUsePaymentSettings.mockReturnValue({ online_gateway_enabled: '0' })

    renderPage()

    expect(screen.getByText('Online Payment Unavailable')).toBeInTheDocument()
    expect(screen.queryByText('Pay Now')).not.toBeInTheDocument()
  })

  it('hides pay actions for no-show reservations', () => {
    renderPage([
      reservation({ status: 'no_show', payment_status: 'unpaid' }),
    ])

    expect(screen.queryByText('Pay Now')).not.toBeInTheDocument()
    expect(screen.queryByText('Online Payment Unavailable')).not.toBeInTheDocument()
  })

  it('hides pay actions for checked-out reservations', () => {
    renderPage([
      reservation({ status: 'checked_out', payment_status: 'unpaid' }),
    ])

    expect(screen.queryByText('Pay Now')).not.toBeInTheDocument()
    expect(screen.queryByText('Online Payment Unavailable')).not.toBeInTheDocument()
  })

  it('hides pay actions for cancelled reservations', () => {
    renderPage([
      reservation({ status: 'cancelled', payment_status: 'unpaid' }),
    ])

    expect(screen.queryByText('Pay Now')).not.toBeInTheDocument()
    expect(screen.queryByText('Online Payment Unavailable')).not.toBeInTheDocument()
  })

  it('keeps Pay Now for checked-in reservations with a balance', () => {
    renderPage([
      reservation({ status: 'checked_in', payment_status: 'partial', paid_amount: 1000, due_amount: 2300 }),
    ])

    expect(screen.getByText('Pay Now')).toBeInTheDocument()
  })

  it('hides both pay actions for no-show when gateway disabled', () => {
    mockUsePaymentSettings.mockReturnValue({ online_gateway_enabled: '0' })

    renderPage([
      reservation({ status: 'no_show', payment_status: 'unpaid' }),
    ])

    expect(screen.queryByText('Pay Now')).not.toBeInTheDocument()
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

  it('confirms payment via confirm-online button', async () => {
    const confirmMutate = vi.fn((_id: number, opts: { onSettled?: () => void }) => opts?.onSettled?.())
    mockUsePublicConfirmOnlinePayment.mockReturnValue({
      mutate: confirmMutate,
      isPending: false,
      isError: false,
      error: null,
    })

    renderPage()

    fireEvent.click(screen.getByText('Confirm Payment'))

    await waitFor(() => {
      expect(confirmMutate).toHaveBeenCalledWith(1, expect.objectContaining({ onSettled: expect.any(Function) }))
    })
  })

  it('shows pending state on confirm button while confirming', () => {
    const confirmMutate = vi.fn()
    mockUsePublicConfirmOnlinePayment.mockReturnValue({
      mutate: confirmMutate,
      isPending: false,
      isError: false,
      error: null,
    })

    renderPage()

    fireEvent.click(screen.getByText('Confirm Payment'))

    const btn = screen.getByText('Confirming...')
    expect(btn).toBeInTheDocument()
    expect((btn as HTMLElement).closest('button')).toBeDisabled()
  })

  it('hides confirm-payment button when gateway disabled', () => {
    mockUsePaymentSettings.mockReturnValue({ online_gateway_enabled: '0' })

    renderPage()

    expect(screen.queryByText('Confirm Payment')).not.toBeInTheDocument()
  })

  it('hides confirm-payment button for paid reservations', () => {
    renderPage([
      reservation({ payment_status: 'paid', paid_amount: 3300, due_amount: 0 }),
    ])

    expect(screen.queryByText('Confirm Payment')).not.toBeInTheDocument()
  })

  it('opens cancel modal and shows error inline when cancel fails', async () => {
    const cancelMutate = vi.fn((_id: number, opts: { onSuccess?: () => void; onError?: (e: Error) => void }) => {
      opts.onError?.(new Error('Cannot cancel checked-in reservations.'))
    })
    mockUsePublicCancelReservation.mockReturnValue({
      mutate: cancelMutate,
      isPending: false,
    })

    renderPage()

    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.getByText('Keep It')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Cancel Reservation', { selector: 'button' }))

    await waitFor(() => {
      expect(screen.getByText('Cannot cancel checked-in reservations.')).toBeInTheDocument()
    })

    // modal stays open so the guest can retry
    expect(screen.getByText('Keep It')).toBeInTheDocument()
    expect(cancelMutate).toHaveBeenCalledWith(1, expect.objectContaining({ onError: expect.any(Function) }))
  })

  it('closes cancel modal on success', async () => {
    const cancelMutate = vi.fn((_id: number, opts: { onSuccess?: () => void }) => {
      opts.onSuccess?.()
    })
    mockUsePublicCancelReservation.mockReturnValue({
      mutate: cancelMutate,
      isPending: false,
    })

    renderPage()

    fireEvent.click(screen.getByText('Cancel'))
    fireEvent.click(screen.getByText('Cancel Reservation', { selector: 'button' }))

    await waitFor(() => {
      expect(screen.queryByText('Keep It')).not.toBeInTheDocument()
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

    fireEvent.click(screen.getByText('Pay Now'))
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

    fireEvent.click(screen.getByText('Pay Now'))

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

    fireEvent.click(screen.getByText(/Upcoming/))

    expect(screen.getByText('BK-2026-0001')).toBeInTheDocument()
    expect(screen.queryByText('BK-2026-0002')).not.toBeInTheDocument()
  })

  it('shows empty state when no reservations', () => {
    renderPage([])

    expect(screen.getByText('No upcoming stays yet')).toBeInTheDocument()
    expect(screen.getByText('Browse Rooms')).toBeInTheDocument()
  })

  it('uses configured currency code', () => {
    mockUsePortalCurrency.mockReturnValue('USD')

    renderPage()

    expect(screen.getByText('$3,300.00')).toBeInTheDocument()
  })

  it('shows booking count summary', () => {
    renderPage([reservation(), reservation({ id: 2, reservation_number: 'BK-2026-0002' })])

    expect(screen.getByText(/2 bookings/)).toBeInTheDocument()
  })
})