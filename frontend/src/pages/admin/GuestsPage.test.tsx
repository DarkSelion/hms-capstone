import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GuestsPage from './GuestsPage'
import type { Guest, PaginatedResponse } from '@/types'

const { mockUseGuests, mockUseGuest, mockUseGuestHistory, mockUseCreateGuest, mockUseUpdateGuest, mockUseDeleteGuest, mockUseToast } =
  vi.hoisted(() => ({
    mockUseGuests: vi.fn(),
    mockUseGuest: vi.fn(),
    mockUseGuestHistory: vi.fn(),
    mockUseCreateGuest: vi.fn(),
    mockUseUpdateGuest: vi.fn(),
    mockUseDeleteGuest: vi.fn(),
    mockUseToast: vi.fn(),
  }))

vi.mock('@/hooks/useApi', () => ({
  useGuests: (params?: Record<string, unknown>) => mockUseGuests(params),
  useGuest: (id: number) => mockUseGuest(id),
  useGuestHistory: (id: number) => mockUseGuestHistory(id),
  useCreateGuest: () => mockUseCreateGuest(),
  useUpdateGuest: () => mockUseUpdateGuest(),
  useDeleteGuest: () => mockUseDeleteGuest(),
}))

vi.mock('@/stores/authStore', () => {
  const state = { user: { id: 1, name: 'Admin User', email: 'admin@hotel.com', role: 'admin' }, token: 'test-token', setAuth: vi.fn(), logout: vi.fn() }
  const useAuthStore = (selector?: (state: unknown) => unknown) => selector ? selector(state) : state
  useAuthStore.getState = () => state
  return { useAuthStore }
})

vi.mock('@/components/ui/toast', () => ({
  useToast: () => mockUseToast(),
}))

vi.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) => (
    <div>
      {label && <label>{label}</label>}
      <input aria-label={label} value={value || ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  ),
}))

function guest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: 1,
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    phone: '09171234567',
    nationality: 'Filipino',
    is_blacklisted: false,
    reservations_count: 2,
    created_at: '2026-01-01T00:00:00.000000Z',
    ...overrides,
  }
}

function paginated<T>(items: T[]): PaginatedResponse<T> {
  return {
    data: items,
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: items.length,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseGuests.mockReturnValue({ data: paginated([guest()]), isLoading: false, error: null, refetch: vi.fn() })
  mockUseGuest.mockReturnValue({ data: null, isLoading: false })
  mockUseGuestHistory.mockReturnValue({ data: null, isLoading: false })
  mockUseCreateGuest.mockReturnValue({ mutate: vi.fn(), isPending: false })
  mockUseUpdateGuest.mockReturnValue({ mutate: vi.fn(), isPending: false })
  mockUseDeleteGuest.mockReturnValue({ mutate: vi.fn(), isPending: false })
  mockUseToast.mockReturnValue({ addToast: vi.fn() })
})

describe('GuestsPage', () => {
  it('renders guest rows with avatar initials, name, and email', () => {
    render(<GuestsPage />)
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('renders summary pills with totals', () => {
    mockUseGuests.mockReturnValue({
      data: paginated([
        guest({ id: 1, is_blacklisted: false, reservations_count: 2 }),
        guest({ id: 2, first_name: 'Jane', last_name: 'Smith', email: 'jane@test.com', is_blacklisted: false, reservations_count: 6 }),
        guest({ id: 3, first_name: 'Bad', last_name: 'User', email: 'bad@test.com', is_blacklisted: true, reservations_count: 0 }),
      ]),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<GuestsPage />)
    expect(screen.getByText('Total: 3')).toBeInTheDocument()
    expect(screen.getByText('VIP: 1')).toBeInTheDocument()
    expect(screen.getByText('Blacklisted: 1')).toBeInTheDocument()
  })

  it('shows Regular badge for guests with fewer than 5 bookings', () => {
    render(<GuestsPage />)
    expect(screen.getByText('Regular')).toBeInTheDocument()
  })

  it('shows VIP badge for guests with 5+ bookings', () => {
    mockUseGuests.mockReturnValue({
      data: paginated([guest({ reservations_count: 5 })]),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<GuestsPage />)
    expect(screen.getByText('VIP')).toBeInTheDocument()
  })

  it('shows Blacklisted badge for blacklisted guests', () => {
    mockUseGuests.mockReturnValue({
      data: paginated([guest({ is_blacklisted: true })]),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<GuestsPage />)
    const badges = screen.getAllByText('Blacklisted')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows nationality or em dash fallback', () => {
    mockUseGuests.mockReturnValue({
      data: paginated([guest({ nationality: undefined })]),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<GuestsPage />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows booking count badge', () => {
    render(<GuestsPage />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders Add Guest button', () => {
    render(<GuestsPage />)
    expect(screen.getByText('Add Guest')).toBeInTheDocument()
  })

  it('opens Add Guest modal when Add Guest is clicked', async () => {
    render(<GuestsPage />)
    fireEvent.click(screen.getByText('Add Guest'))
    expect(screen.getByText('Personal Information')).toBeInTheDocument()
    expect(screen.getByText('Contact & Address')).toBeInTheDocument()
    expect(screen.getByText('Status & Notes')).toBeInTheDocument()
  })

  it('opens Add Guest modal with section headers', async () => {
    render(<GuestsPage />)
    fireEvent.click(screen.getByText('Add Guest'))
    expect(screen.getByText('Mark as Blacklisted Guest')).toBeInTheDocument()
  })
})
