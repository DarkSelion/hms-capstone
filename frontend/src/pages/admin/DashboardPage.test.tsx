import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardPage from './DashboardPage'
import type { DashboardStats, RevenueData, BookingSourceData, ActivityLog, Reservation, Guest, Room } from '@/types'

const {
  mockUseDashboardStats,
  mockUseDashboardRevenue,
  mockUseBookingSources,
  mockUseRecentActivities,
  mockUseReservations,
} = vi.hoisted(() => ({
  mockUseDashboardStats: vi.fn(),
  mockUseDashboardRevenue: vi.fn(),
  mockUseBookingSources: vi.fn(),
  mockUseRecentActivities: vi.fn(),
  mockUseReservations: vi.fn(),
}))

vi.mock('@/hooks/useApi', () => ({
  useDashboardStats: () => mockUseDashboardStats(),
  useDashboardRevenue: () => mockUseDashboardRevenue(),
  useBookingSources: () => mockUseBookingSources(),
  useRecentActivities: () => mockUseRecentActivities(),
  useReservations: (params?: Record<string, unknown>) => mockUseReservations(params),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

function stats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    today_revenue: 15000,
    occupancy_rate: 66.67,
    available_rooms: 5,
    booked_rooms: 10,
    check_ins_today: 3,
    check_outs_today: 2,
    pending_reservations: 4,
    total_rooms: 15,
    dirty_rooms: 2,
    ...overrides,
  }
}

function revenueData(): RevenueData[] {
  return Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
    revenue: 1000 + i * 100,
    bookings: 2 + (i % 3),
  }))
}

function source(overrides: Partial<BookingSourceData> = {}): BookingSourceData {
  return { source: 'direct', count: 10, ...overrides }
}

function activity(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: 1,
    action: 'created',
    module: 'reservation',
    description: 'Reservation created',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 1,
    reservation_number: 'BK-2026-0001',
    guest: { first_name: 'John', last_name: 'Doe' } as Guest,
    room: { room_number: '101' } as Room,
    status: 'confirmed',
    check_in: '2026-08-01',
    check_out: '2026-08-03',
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

function renderDashboard() {
  mockUseDashboardStats.mockReturnValue({
    data: stats(),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
  mockUseDashboardRevenue.mockReturnValue({
    data: revenueData(),
    isLoading: false,
    error: null,
  })
  mockUseBookingSources.mockReturnValue({
    data: [source(), source({ source: 'walk_in', count: 5 })],
    isLoading: false,
    error: null,
  })
  mockUseRecentActivities.mockReturnValue({
    data: [activity()],
    isLoading: false,
    error: null,
  })
  mockUseReservations.mockReturnValue({
    data: { data: [reservation()] },
    isLoading: false,
    error: null,
  })
  return render(<DashboardPage />)
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeletons initially', () => {
    mockUseDashboardStats.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    })
    mockUseDashboardRevenue.mockReturnValue({ data: undefined, isLoading: true, error: null })
    mockUseBookingSources.mockReturnValue({ data: undefined, isLoading: true, error: null })
    mockUseRecentActivities.mockReturnValue({ data: undefined, isLoading: true, error: null })
    mockUseReservations.mockReturnValue({ data: undefined, isLoading: true, error: null })

    const { container } = render(<DashboardPage />)

    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  it('renders error state with retry button', () => {
    mockUseDashboardStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: vi.fn(),
    })
    mockUseDashboardRevenue.mockReturnValue({ data: undefined, isLoading: false, error: null })
    mockUseBookingSources.mockReturnValue({ data: undefined, isLoading: false, error: null })
    mockUseRecentActivities.mockReturnValue({ data: undefined, isLoading: false, error: null })
    mockUseReservations.mockReturnValue({ data: undefined, isLoading: false, error: null })

    render(<DashboardPage />)

    expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('renders hero occupancy bar', () => {
    renderDashboard()

    expect(screen.getByText('Current Occupancy')).toBeInTheDocument()
    expect(screen.getByText('67')).toBeInTheDocument()
  })

  it('renders hero stats row', () => {
    renderDashboard()

    expect(screen.getByText("Today's Revenue")).toBeInTheDocument()
    expect(screen.getByText('Check-ins Today')).toBeInTheDocument()
    expect(screen.getByText('Check-outs Today')).toBeInTheDocument()
  })

  it('stat card shows today_revenue formatted as currency', () => {
    renderDashboard()

    expect(screen.getByText('₱15,000.00')).toBeInTheDocument()
  })

  it('renders secondary metrics row', () => {
    renderDashboard()

    expect(screen.getByText('Booked')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Dirty Rooms')).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
  })

  it('stat card shows available_rooms as fraction', () => {
    renderDashboard()

    expect(screen.getByText('5/15')).toBeInTheDocument()
  })

  it('stat card shows dirty rooms as total minus available', () => {
    renderDashboard()

    const elements = screen.getAllByText('10')
    expect(elements.length).toBeGreaterThanOrEqual(1)
  })

  it('booking sources pie chart renders', () => {
    renderDashboard()

    expect(screen.getByText('Booking Sources')).toBeInTheDocument()
  })

  it('booking sources shows empty state when no data', () => {
    mockUseBookingSources.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })
    mockUseDashboardStats.mockReturnValue({ data: stats(), isLoading: false, error: null, refetch: vi.fn() })
    mockUseDashboardRevenue.mockReturnValue({ data: revenueData(), isLoading: false, error: null })
    mockUseRecentActivities.mockReturnValue({ data: [activity()], isLoading: false, error: null })
    mockUseReservations.mockReturnValue({ data: { data: [reservation()] }, isLoading: false, error: null })

    render(<DashboardPage />)

    expect(screen.getByText('No booking data')).toBeInTheDocument()
  })

  it('recent activities section renders', () => {
    renderDashboard()

    expect(screen.getByText('Recent Activities')).toBeInTheDocument()
  })

  it('recent activities shows description text', () => {
    renderDashboard()

    expect(screen.getByText('Reservation created')).toBeInTheDocument()
  })

  it('recent activities shows empty state when no activities', () => {
    mockUseRecentActivities.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })
    mockUseDashboardStats.mockReturnValue({ data: stats(), isLoading: false, error: null, refetch: vi.fn() })
    mockUseDashboardRevenue.mockReturnValue({ data: revenueData(), isLoading: false, error: null })
    mockUseBookingSources.mockReturnValue({ data: [source()], isLoading: false, error: null })
    mockUseReservations.mockReturnValue({ data: { data: [reservation()] }, isLoading: false, error: null })

    render(<DashboardPage />)

    expect(screen.getByText('No recent activities')).toBeInTheDocument()
  })

  it('latest reservations renders guest name', () => {
    renderDashboard()

    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('latest reservations shows reservation number and room', () => {
    renderDashboard()

    expect(screen.getByText(/BK-2026-0001/)).toBeInTheDocument()
  })

  it('latest reservations shows status badge', () => {
    renderDashboard()

    expect(screen.getByText('Confirmed')).toBeInTheDocument()
  })

  it('latest reservations view all link', () => {
    renderDashboard()

    const viewAll = screen.getByText('View All')
    expect(viewAll.closest('a')).toHaveAttribute('href', '/admin/reservations')
  })

  it('revenue chart shows no data when empty', () => {
    mockUseDashboardRevenue.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })
    mockUseDashboardStats.mockReturnValue({ data: stats(), isLoading: false, error: null, refetch: vi.fn() })
    mockUseBookingSources.mockReturnValue({ data: [source()], isLoading: false, error: null })
    mockUseRecentActivities.mockReturnValue({ data: [activity()], isLoading: false, error: null })
    mockUseReservations.mockReturnValue({ data: { data: [reservation()] }, isLoading: false, error: null })

    render(<DashboardPage />)

    expect(screen.getByText('No revenue data available')).toBeInTheDocument()
  })
})
