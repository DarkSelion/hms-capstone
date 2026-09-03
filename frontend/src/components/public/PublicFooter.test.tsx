import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PublicFooter } from './PublicFooter'

const {
  mockUseHotelName,
  mockUseHotelSettings,
  mockUseBrandingSettings,
  mockUsePublicAuthStore,
  mockUseToast,
  mockUseNavigate,
} = vi.hoisted(() => ({
  mockUseHotelName: vi.fn(),
  mockUseHotelSettings: vi.fn(),
  mockUseBrandingSettings: vi.fn(),
  mockUsePublicAuthStore: vi.fn(),
  mockUseToast: vi.fn(),
  mockUseNavigate: vi.fn(),
}))

vi.mock('@/hooks/usePublicApi', () => ({
  useHotelName: () => mockUseHotelName(),
  useHotelSettings: () => mockUseHotelSettings(),
  useBrandingSettings: () => mockUseBrandingSettings(),
}))

vi.mock('@/stores/publicAuthStore', () => ({
  usePublicAuthStore: () => mockUsePublicAuthStore(),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => mockUseToast(),
}))

vi.mock('@/lib/publicApi', () => ({
  publicApi: { post: vi.fn().mockResolvedValue({}) },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
    useNavigate: () => mockUseNavigate(),
  }
})

const mockAddToast = vi.fn()
const mockLogout = vi.fn()
const mockNavigate = vi.fn()

function setup({
  token = null as string | null,
  hotelName = 'Pampanga Home Suites',
  hotel = {} as Record<string, string>,
  branding = {} as Record<string, string>,
} = {}) {
  mockUseHotelName.mockReturnValue(hotelName)
  mockUseHotelSettings.mockReturnValue(hotel)
  mockUseBrandingSettings.mockReturnValue(branding)
  mockUsePublicAuthStore.mockReturnValue({ token, logout: mockLogout })
  mockUseToast.mockReturnValue({ addToast: mockAddToast })
  mockUseNavigate.mockReturnValue(mockNavigate)
  return render(<PublicFooter />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAddToast.mockReset()
  mockLogout.mockReset()
  mockNavigate.mockReset()
  mockUseToast.mockReturnValue({ addToast: mockAddToast })
  mockUsePublicAuthStore.mockReturnValue({ token: null, logout: mockLogout })
})

describe('PublicFooter', () => {
  it('renders the hotel name and tagline', () => {
    setup({
      branding: { footer_tagline: 'Cozy stays, warm smiles.' },
    })

    expect(screen.getByText('Pampanga Home Suites')).toBeInTheDocument()
    expect(screen.getByText('Cozy stays, warm smiles.')).toBeInTheDocument()
    expect(screen.getByText('Home Suites')).toBeInTheDocument()
  })

  it('falls back to the default tagline when not configured', () => {
    setup()

    expect(
      screen.getByText('Cozy stays, warm smiles — right here in Pampanga.'),
    ).toBeInTheDocument()
  })

  it('renders the four column titles', () => {
    setup()

    // Contact appears in two places (column title + Explore link) — disambiguate by role
    expect(screen.getByText('Explore')).toBeInTheDocument()
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getAllByText('Contact').length).toBeGreaterThanOrEqual(1)
    // The column title is an h4, the Explore link is an anchor
    expect(screen.getByRole('heading', { level: 4, name: 'Contact' })).toBeInTheDocument()
  })

  it('renders the explore links', () => {
    setup()

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/public')
    expect(screen.getByRole('link', { name: 'Our Rooms' })).toHaveAttribute('href', '/public/rooms')
    expect(screen.getByRole('link', { name: 'Gallery' })).toHaveAttribute('href', '/public/gallery')
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/public/contact')
  })

  it('shows Sign In + Create Account when logged out', () => {
    setup({ token: null })

    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/public/login')
    expect(screen.getByRole('link', { name: 'Create Account' })).toHaveAttribute('href', '/public/register')
    expect(screen.queryByText('Sign Out')).not.toBeInTheDocument()
  })

  it('shows My Bookings + Profile + Sign Out when signed in', () => {
    setup({ token: 'test-token' })

    expect(screen.getByRole('link', { name: 'My Bookings' })).toHaveAttribute('href', '/public/my-reservations')
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/public/profile')
    expect(screen.getByText('Sign Out')).toBeInTheDocument()
  })

  it('renders address, phone, and email as contact items', () => {
    setup({
      hotel: {
        hotel_address: '123 Test St, Pampanga',
        hotel_phone: '+63 999 111 2222',
        hotel_email: 'hello@test.com',
      },
    })

    expect(screen.getByText('123 Test St, Pampanga')).toBeInTheDocument()
    const phoneLink = screen.getByRole('link', { name: '+63 999 111 2222' })
    expect(phoneLink).toHaveAttribute('href', 'tel:+639991112222')
    const emailLink = screen.getByRole('link', { name: 'hello@test.com' })
    expect(emailLink).toHaveAttribute('href', 'mailto:hello@test.com')
  })

  it('falls back to default address/phone/email when not configured', () => {
    setup()

    expect(screen.getByText('Pampanga, Philippines')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '+63 912 345 6789' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'info@pampangahomesuites.com' })).toBeInTheDocument()
  })

  it('renders the social icons for configured URLs only', () => {
    setup({
      hotel: {
        contact_facebook: 'https://facebook.com/test',
        contact_instagram: '',
        contact_tiktok: '#',
      },
    })

    // Facebook renders, Instagram and TikTok do not (empty / '#')
    expect(screen.getByLabelText('Facebook')).toBeInTheDocument()
    expect(screen.queryByLabelText('Instagram')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('TikTok')).not.toBeInTheDocument()
  })

  it('hides social icons entirely when no URLs are configured', () => {
    setup()

    expect(screen.queryByLabelText('Facebook')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Instagram')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('TikTok')).not.toBeInTheDocument()
  })

  it('renders the hotel logo when hotel_logo URL is configured', () => {
    setup({ hotel: { hotel_logo: '/storage/branding/logo.png' } })

    const logo = screen.getByAltText('Pampanga Home Suites') as HTMLImageElement
    expect(logo).toBeInTheDocument()
    expect(logo.src).toContain('/storage/branding/logo.png')
  })

  it('falls back to a gold initial avatar when no logo is configured', () => {
    setup()

    const avatar = screen.getByText('P')
    expect(avatar).toBeInTheDocument()
  })

  it('renders the copyright line with the current year and hotel name', () => {
    setup()

    const year = new Date().getFullYear()
    expect(
      screen.getByText(new RegExp(`© ${year} Pampanga Home Suites`)),
    ).toBeInTheDocument()
  })

  it('renders a Back to top button that scrolls the window', () => {
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    setup()

    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }))

    expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    scrollSpy.mockRestore()
  })

  it('signs out, navigates home, and toasts when the footer Sign Out is clicked', () => {
    setup({ token: 'test-token' })

    fireEvent.click(screen.getByText('Sign Out'))

    expect(mockLogout).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith('/public')
    expect(mockAddToast).toHaveBeenCalledWith('Signed out', 'success')
  })
})
