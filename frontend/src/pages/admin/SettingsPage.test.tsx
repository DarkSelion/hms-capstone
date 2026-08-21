import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingsPage from './SettingsPage'

const { mockUseSettings, mockMutateSettings } = vi.hoisted(() => ({
  mockUseSettings: vi.fn(),
  mockMutateSettings: vi.fn(),
}))

vi.mock('@/hooks/useApi', () => ({
  useSettings: () => mockUseSettings(),
  useUpdateSettings: () => ({ mutate: mockMutateSettings, isPending: false }),
  useUpdateLogo: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteLogo: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadBrandingImage: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteBrandingImage: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}))

const baseSettings = {
  hotel_name: 'Test Hotel',
  default_currency: 'PHP',
  timezone: 'Asia/Manila',
}

function renderPage() {
  mockUseSettings.mockReturnValue({
    data: baseSettings,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
  return render(<SettingsPage />)
}

describe('SettingsPage', () => {
  beforeEach(() => {
    mockUseSettings.mockReset()
    mockMutateSettings.mockReset()
  })

  it('renders the Website tab with saved branding values', () => {
    mockUseSettings.mockReturnValue({
      data: {
        ...baseSettings,
        theme_preset: 'navy',
        hero_title: 'Our Cozy Haven',
        footer_tagline: 'Welcome home.',
        gallery_1_title: 'Deluxe King Room',
        gallery_1_category: 'Rooms & Suites',
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<SettingsPage />)

    fireEvent.click(screen.getByRole('button', { name: /Website/ }))

    expect(screen.getByRole('button', { name: /Navy & Gold/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Headline')).toHaveValue('Our Cozy Haven')
    expect(screen.getByDisplayValue('Welcome home.')).toBeInTheDocument()
  })

  it('saves theme, hero text, and gallery metadata in the branding payload', () => {
    mockUseSettings.mockReturnValue({
      data: {
        ...baseSettings,
        theme_preset: 'emerald',
        hero_title: 'Our Cozy Haven',
        gallery_1_title: 'Deluxe King Room',
        gallery_1_category: 'Rooms & Suites',
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<SettingsPage />)

    fireEvent.click(screen.getByRole('button', { name: /Website/ }))
    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'Stay Awhile' } })
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }))

    expect(mockMutateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.arrayContaining([
          { key: 'theme_preset', value: 'emerald', group: 'branding' },
          { key: 'hero_title', value: 'Stay Awhile', group: 'branding' },
          { key: 'gallery_1_title', value: 'Deluxe King Room', group: 'branding' },
          { key: 'gallery_1_category', value: 'Rooms & Suites', group: 'branding' },
        ]),
      }),
      expect.anything(),
    )
  })

  it('renders the Booking tab with saved late check-out fee and check-out time', () => {
    mockUseSettings.mockReturnValue({
      data: {
        ...baseSettings,
        late_checkout_fee: '500',
        check_out_time: '14:00',
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<SettingsPage />)

    fireEvent.click(screen.getByRole('button', { name: /Booking/ }))

    expect(screen.getByLabelText('Late Check-out Fee')).toHaveValue(500)
    expect(screen.getByLabelText('Check-out hour')).toHaveValue('2')
    expect(screen.getByLabelText('Check-out minute')).toHaveValue('00')
    expect(screen.getByLabelText('Check-out meridiem')).toHaveValue('PM')
  })

  it('defaults the check-out time and saves it in the booking payload', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /Booking/ }))

    expect(screen.getByLabelText('Check-out hour')).toHaveValue('11')
    expect(screen.getByLabelText('Check-out minute')).toHaveValue('00')
    expect(screen.getByLabelText('Check-out meridiem')).toHaveValue('AM')
    fireEvent.change(screen.getByLabelText('Check-out hour'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Check-out minute'), { target: { value: '30' } })
    fireEvent.change(screen.getByLabelText('Check-out meridiem'), { target: { value: 'PM' } })
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }))

    expect(mockMutateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.arrayContaining([
          { key: 'check_out_time', value: '13:30', group: 'booking' },
        ]),
      }),
      expect.anything(),
    )
  })

  it('renders the Website tab with current website defaults when no branding keys exist', () => {
    mockUseSettings.mockReturnValue({
      data: { ...baseSettings },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<SettingsPage />)

    fireEvent.click(screen.getByRole('button', { name: /Website/ }))

    expect(screen.getByRole('button', { name: /^Gold/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Headline')).toHaveValue('Comfortable Stays, Warm Smiles')
    expect(screen.getByDisplayValue('Cozy stays, warm smiles — right here in Pampanga.')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Deluxe King Room')).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('Rooms & Suites').length).toBe(6)
    expect(screen.getAllByDisplayValue('Amenities').length).toBe(6)
  })

  it('renders Website defaults even when branding keys exist but are empty strings', () => {
    mockUseSettings.mockReturnValue({
      data: {
        ...baseSettings,
        hero_title: '',
        footer_tagline: '',
        gallery_1_title: '',
        gallery_1_category: '',
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<SettingsPage />)

    fireEvent.click(screen.getByRole('button', { name: /Website/ }))

    expect(screen.getByLabelText('Headline')).toHaveValue('Comfortable Stays, Warm Smiles')
    expect(screen.getByDisplayValue('Cozy stays, warm smiles — right here in Pampanga.')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Deluxe King Room')).toBeInTheDocument()
  })

  it('renders the Payments tab with the online gateway section and no GCash config', () => {
    mockUseSettings.mockReturnValue({
      data: {
        ...baseSettings,
        online_gateway_enabled: '1',
        online_gateway_base_url: 'https://hardreset.onrender.com',
        online_gateway_api_key: 'sk_test_123',
        online_gateway_webhook_secret: 'whsec_456',
        online_gateway_self_settle: '1',
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<SettingsPage />)

    fireEvent.click(screen.getByRole('button', { name: /Payments/ }))

    expect(screen.getByText('Online Payment Gateway')).toBeInTheDocument()
    expect(screen.getByLabelText('Gateway Base URL')).toHaveValue('https://hardreset.onrender.com')
    expect(screen.getByLabelText('API Key')).toHaveValue('sk_test_123')
    expect(screen.getByLabelText('Webhook Secret')).toHaveValue('whsec_456')
    expect(screen.getByText('Allow Guest Self-Settlement')).toBeInTheDocument()
    expect(screen.getByText(/Lets the owning guest mark their own booking as paid/)).toBeInTheDocument()
    expect(screen.queryByText('Enable Online Payments')).not.toBeInTheDocument()
    expect(screen.queryByText('GCash Account Number')).not.toBeInTheDocument()
    expect(screen.queryByText('GCash QR Code')).not.toBeInTheDocument()
  })

  it('parses a stored two_factor_auth "false" string as unchecked', () => {
    mockUseSettings.mockReturnValue({
      data: {
        ...baseSettings,
        two_factor_auth: 'false',
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<SettingsPage />)

    fireEvent.click(screen.getByRole('button', { name: /Security/ }))

    expect(screen.getByLabelText('Enable Two-Factor Authentication')).not.toBeChecked()
  })

  it('saves two_factor_auth as 1/0 so it never round-trips as a truthy string', () => {
    mockUseSettings.mockReturnValue({
      data: { ...baseSettings },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<SettingsPage />)

    fireEvent.click(screen.getByRole('button', { name: /Security/ }))
    fireEvent.click(screen.getByLabelText('Enable Two-Factor Authentication'))
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }))

    expect(mockMutateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.arrayContaining([
          { key: 'two_factor_auth', value: '1', group: 'security' },
        ]),
      }),
      expect.anything(),
    )
  })
})
