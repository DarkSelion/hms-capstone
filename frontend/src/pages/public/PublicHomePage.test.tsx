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
} = vi.hoisted(() => ({
  mockUsePublicRoomTypes: vi.fn(),
  mockUseHotelName: vi.fn(),
  mockUsePublicSettings: vi.fn(),
  mockUseBrandingSettings: vi.fn(),
  mockUseSearchParams: vi.fn(),
}))

vi.mock('@/hooks/usePublicApi', () => ({
  usePublicRoomTypes: () => mockUsePublicRoomTypes(),
  useHotelName: () => mockUseHotelName(),
  usePublicSettings: (group: string) => mockUsePublicSettings(group),
  useBrandingSettings: () => mockUseBrandingSettings(),
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
    useSearchParams: () => mockUseSearchParams(),
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
    expect(screen.getByText('Premier')).toBeInTheDocument()
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