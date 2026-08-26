import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PublicHomePage from './PublicHomePage'
import type { PublicRoomType } from '@/types'

const {
  mockUsePublicRoomTypes,
  mockUseHotelName,
  mockUsePublicSettings,
  mockUseBrandingSettings,
  mockUseSearchParams,
  mockUsePublicReservations,
  mockUsePublicConfirmOnlinePayment,
  mockUsePublicAuthStore,
  mockUsePaymentSettings,
} = vi.hoisted(() => ({
  mockUsePublicRoomTypes: vi.fn(),
  mockUseHotelName: vi.fn(),
  mockUsePublicSettings: vi.fn(),
  mockUseBrandingSettings: vi.fn(),
  mockUseSearchParams: vi.fn(),
  mockUsePublicReservations: vi.fn(),
  mockUsePublicConfirmOnlinePayment: vi.fn(),
  mockUsePublicAuthStore: vi.fn(),
  mockUsePaymentSettings: vi.fn(),
}))

vi.mock('@/hooks/usePublicApi', () => ({
  usePublicRoomTypes: () => mockUsePublicRoomTypes(),
  useHotelName: () => mockUseHotelName(),
  usePublicSettings: (group: string) => mockUsePublicSettings(group),
  useBrandingSettings: () => mockUseBrandingSettings(),
  usePublicReservations: () => mockUsePublicReservations(),
  usePublicConfirmOnlinePayment: () => mockUsePublicConfirmOnlinePayment(),
  usePaymentSettings: () => mockUsePaymentSettings(),
}))

vi.mock('@/stores/publicAuthStore', () => ({
  usePublicAuthStore: () => mockUsePublicAuthStore(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
    useNavigate: () => (to: string) => {
      window.__nav = to
    },
    useSearchParams: () => {
      const [params] = mockUseSearchParams()
      return [params, vi.fn()]
    },
  }
})

declare global {
  interface Window {
    __nav?: string
  }
}

function roomType(overrides: Partial<PublicRoomType> = {}): PublicRoomType {
  return {
    id: 1,
    name: 'Deluxe Room',
    slug: 'deluxe-room',
    base_price: 1500,
    capacity: 2,
    max_adults: 2,
    max_children: 1,
    is_active: true,
    image_url: 'https://images.unsplash.com/test.jpg',
    ...overrides,
  }
}

function renderHome(overrides: { roomTypes?: PublicRoomType[] } = {}) {
  mockUsePublicRoomTypes.mockReturnValue({ data: overrides.roomTypes ?? [], isLoading: false, error: null })
  mockUsePublicSettings.mockReturnValue({ data: {}, isLoading: false, error: null })
  return render(<PublicHomePage />)
}

describe('PublicHomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.__nav = undefined
    mockUseBrandingSettings.mockReturnValue({})
    mockUseHotelName.mockReturnValue('Pampanga Home Suites')
    mockUseSearchParams.mockReturnValue([new URLSearchParams('')])
    mockUsePublicAuthStore.mockReturnValue({ token: null })
    mockUsePublicReservations.mockReturnValue({ data: { data: [] }, isLoading: false, error: null })
    mockUsePublicConfirmOnlinePayment.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, error: null })
    mockUsePaymentSettings.mockReturnValue({ online_gateway_self_settle: '1' })
  })

  it('renders hero with default branding fallbacks', () => {
    renderHome()

    expect(screen.getByText('Comfortable Stays, Warm Smiles')).toBeInTheDocument()
    expect(screen.getByText(/warm Filipino hospitality/i)).toBeInTheDocument()
    expect(screen.getByText('Explore Stays')).toBeInTheDocument()
  })

  it('renders customized hero copy from branding settings', () => {
    mockUseBrandingSettings.mockReturnValue({
      hero_badge: 'Welcome to {hotel_name}',
      hero_title: 'Your Home Away From Home',
      hero_subtitle: 'Relax and unwind in Pampanga.',
      hero_cta_label: 'Book Now',
    })

    renderHome()

    expect(screen.getByText('Your Home Away From Home')).toBeInTheDocument()
    expect(screen.getByText('Book Now')).toBeInTheDocument()
    expect(screen.getByText('Welcome to Pampanga Home Suites')).toBeInTheDocument()
  })

  it('renders booking widget with Check Availability button', () => {
    renderHome()

    expect(screen.getByText('Check Availability')).toBeInTheDocument()
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Guests')).toBeInTheDocument()
  })

  it('shows room tab section with Discover Our World heading', () => {
    renderHome({ roomTypes: [roomType()] })

    expect(screen.getByText('Discover Our World')).toBeInTheDocument()
    expect(screen.getByText('Rooms')).toBeInTheDocument()
    expect(screen.getByText('Family Rooms')).toBeInTheDocument()
  })

  it('navigates to rooms via hero CTA', () => {
    renderHome()

    fireEvent.click(screen.getByText('Explore Stays'))

    expect(window.__nav).toBe('/public/rooms')
  })

  it('shows payment success redirect banner from URL params', () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams('booking_ref=BK-2026-0001&status=success')])
    renderHome()

    expect(screen.getByText(/Payment received for BK-2026-0001/)).toBeInTheDocument()
    expect(screen.getByText('View booking')).toBeInTheDocument()
  })

  it('shows failed payment banner', () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams('booking_ref=BK-2026-0001&status=failed')])
    renderHome()

    expect(screen.getByText(/Payment for BK-2026-0001 was not completed/)).toBeInTheDocument()
  })

  it('hides payment banner when dismissed', () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams('booking_ref=BK-2026-0001&status=success')])
    renderHome()

    fireEvent.click(screen.getByLabelText('Dismiss notice'))

    expect(screen.queryByText(/Payment received for BK-2026-0001/)).not.toBeInTheDocument()
  })

  it('auto-confirms a matching unpaid reservation on success redirect when logged in', () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams('booking_ref=BK-2026-0001&status=success')])
    mockUsePublicAuthStore.mockReturnValue({ token: 'abc' })
    mockUsePublicReservations.mockReturnValue({
      data: { data: [{ id: 7, reservation_number: 'BK-2026-0001', payment_status: 'unpaid', due_amount: 165 }] },
      isLoading: false,
      error: null,
    })
    const mutate = vi.fn((_id: number, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
    mockUsePublicConfirmOnlinePayment.mockReturnValue({ mutate, isPending: false, isError: false, error: null })

    renderHome()

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate).toHaveBeenCalledWith(7, expect.anything())
    expect(screen.getByText(/Payment confirmed for BK-2026-0001/)).toBeInTheDocument()
  })

  it('does not auto-confirm an already paid booking', () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams('booking_ref=BK-2026-0001&status=success')])
    mockUsePublicAuthStore.mockReturnValue({ token: 'abc' })
    mockUsePublicReservations.mockReturnValue({
      data: { data: [{ id: 7, reservation_number: 'BK-2026-0001', payment_status: 'paid', due_amount: 0 }] },
      isLoading: false,
      error: null,
    })
    const mutate = vi.fn()
    mockUsePublicConfirmOnlinePayment.mockReturnValue({ mutate, isPending: false, isError: false, error: null })

    renderHome()

    expect(mutate).not.toHaveBeenCalled()
  })

  it('does not auto-confirm when the guest is not signed in', () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams('booking_ref=BK-2026-0001&status=success')])
    mockUsePublicAuthStore.mockReturnValue({ token: null })
    mockUsePublicReservations.mockReturnValue({
      data: { data: [{ id: 7, reservation_number: 'BK-2026-0001', payment_status: 'unpaid', due_amount: 165 }] },
      isLoading: false,
      error: null,
    })
    const mutate = vi.fn()
    mockUsePublicConfirmOnlinePayment.mockReturnValue({ mutate, isPending: false, isError: false, error: null })

    renderHome()

    expect(mutate).not.toHaveBeenCalled()
    expect(screen.getByText(/Payment received for BK-2026-0001/)).toBeInTheDocument()
  })

  it('does not auto-confirm when guest self-settlement is disabled', () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams('booking_ref=BK-2026-0001&status=success')])
    mockUsePublicAuthStore.mockReturnValue({ token: 'abc' })
    mockUsePublicReservations.mockReturnValue({
      data: { data: [{ id: 7, reservation_number: 'BK-2026-0001', payment_status: 'unpaid', due_amount: 165 }] },
      isLoading: false,
      error: null,
    })
    mockUsePaymentSettings.mockReturnValue({ online_gateway_self_settle: '0' })
    const mutate = vi.fn()
    mockUsePublicConfirmOnlinePayment.mockReturnValue({ mutate, isPending: false, isError: false, error: null })

    renderHome()

    expect(mutate).not.toHaveBeenCalled()
    expect(screen.getByText(/Payment received for BK-2026-0001/)).toBeInTheDocument()
  })

  it('renders gallery section with section title and configured photo', () => {
    mockUseBrandingSettings.mockReturnValue({
      gallery_1_image: 'https://example.com/gallery1.jpg',
      gallery_1_title: 'Poolside',
    })

    renderHome()

    expect(screen.getByText('A Glimpse of Pampanga Home Suites')).toBeInTheDocument()
    expect(screen.getByText('Poolside')).toBeInTheDocument()
  })

  it('renders why-choose-us and amenities sections', () => {
    renderHome()

    expect(screen.getAllByText('Swimming Pool').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Restaurant').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Free Wi-Fi').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Free Parking').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Event Hall')).toBeInTheDocument()
  })

  it('uses hotel name in hero badge default', () => {
    mockUseHotelName.mockReturnValue('Cozy Inn')
    renderHome()

    expect(screen.getByText('Welcome to Cozy Inn')).toBeInTheDocument()
  })
})