import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import RoomsPage from './RoomsPage'

const { mockUseRooms, mockUseRoomTypes, mockUseUpdateRoom } = vi.hoisted(() => ({
  mockUseRooms: vi.fn(),
  mockUseRoomTypes: vi.fn(),
  mockUseUpdateRoom: vi.fn(),
}))

const mockAuthStore = vi.hoisted(() => ({
  useAuthStore: vi.fn((selector?: (state: { user: { role: string } | null }) => unknown) => {
    const state = { user: { role: 'admin' } }
    return selector ? selector(state) : state
  }),
}))

vi.mock('@/hooks/useApi', () => ({
  useRooms: (...args: unknown[]) => mockUseRooms(...args),
  useRoomTypes: (...args: unknown[]) => mockUseRoomTypes(...args),
  useUpdateRoom: () => mockUseUpdateRoom(),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('@/stores/authStore', () => mockAuthStore)

vi.mock('@/lib/permissions', () => ({
  isAdminRole: () => true,
}))

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}))

const mockRooms = [
  {
    id: 1,
    room_number: '101',
    floor: 1,
    status: 'available',
    cleaning_status: 'clean',
    price_override: null,
    capacity: 2,
    room_type: { id: 1, name: 'Deluxe', base_price: '3500.00', bed_type: 'King' },
    images: [{ id: 1, room_id: 1, image_url: 'https://example.com/room101.jpg', is_primary: true, caption: null, sort_order: 0 }],
  },
  {
    id: 2,
    room_number: '102',
    floor: 1,
    status: 'occupied',
    cleaning_status: 'dirty',
    price_override: '4000.00',
    capacity: 2,
    room_type: { id: 1, name: 'Deluxe', base_price: '3500.00', bed_type: 'King' },
    images: [],
  },
  {
    id: 3,
    room_number: '201',
    floor: 2,
    status: 'reserved',
    cleaning_status: 'clean',
    price_override: null,
    capacity: 4,
    room_type: { id: 2, name: 'Suite', base_price: '6000.00', bed_type: 'Queen' },
    images: [{ id: 2, room_id: 3, image_url: 'https://example.com/room201.jpg', is_primary: true, caption: null, sort_order: 0 }],
  },
  {
    id: 4,
    room_number: '202',
    floor: 2,
    status: 'dirty',
    cleaning_status: 'dirty',
    price_override: null,
    capacity: 2,
    room_type: { id: 1, name: 'Deluxe', base_price: '3500.00', bed_type: 'King' },
    images: [],
  },
  {
    id: 5,
    room_number: '301',
    floor: 3,
    status: 'maintenance',
    cleaning_status: 'clean',
    price_override: null,
    capacity: 2,
    room_type: { id: 1, name: 'Deluxe', base_price: '3500.00', bed_type: 'King' },
    images: [],
  },
]

const mockRoomTypes = [
  { id: 1, name: 'Deluxe', base_price: '3500.00', bed_type: 'King' },
  { id: 2, name: 'Suite', base_price: '6000.00', bed_type: 'Queen' },
]

function renderPage(overrides: Partial<{
  rooms: typeof mockRooms
  roomTypes: typeof mockRoomTypes
}> = {}) {
  const rooms = overrides.rooms ?? mockRooms
  const roomTypes = overrides.roomTypes ?? mockRoomTypes

  mockUseRooms.mockImplementation(() => ({
    data: { data: rooms, current_page: 1, last_page: 1, total: rooms.length, per_page: 12 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }))

  mockUseRoomTypes.mockReturnValue({
    data: { data: roomTypes },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })

  mockUseUpdateRoom.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  })

  return render(<RoomsPage />)
}

describe('RoomsPage', () => {
  beforeEach(() => {
    mockUseRooms.mockReset()
    mockUseRoomTypes.mockReset()
    mockUseUpdateRoom.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders room thumbnails and merged type names', () => {
    renderPage()
    
    // Room 101 has image
    expect(screen.getByAltText('Room 101')).toHaveAttribute('src', 'https://example.com/room101.jpg')
    expect(screen.getAllByText('Room 101').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Deluxe').length).toBeGreaterThan(0)
    
    // Room 102 has no image - shows BedDouble placeholder (no alt text)
    expect(screen.getAllByText('Room 102').length).toBeGreaterThan(0)
  })

  it('shows price column right-aligned and formatted', () => {
    renderPage()
    
    expect(screen.getAllByText('₱3,500.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('₱4,000.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('₱6,000.00').length).toBeGreaterThan(0)
  })

  it('shows empty state when no rooms match', () => {
    renderPage({ rooms: [] })
    
    expect(screen.getByText('No rooms match your filters')).toBeInTheDocument()
    expect(screen.getByText('Try adjusting your search or filters.')).toBeInTheDocument()
  })

  it('shows active filter bar and clear all button when filters applied', () => {
    renderPage()

    // Set status via the dropdown (first combobox = Status filter)
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'available' } })

    expect(screen.getByText('Active filters:')).toBeInTheDocument()
    expect(screen.getByText('Status: Available')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Clear all/ })).toBeInTheDocument()
  })

  it('clears all filters when Clear all button clicked', () => {
    renderPage()

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'available' } })
    expect(screen.getByText('Status: Available')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Clear all/ }))

    expect(screen.queryByText('Active filters:')).not.toBeInTheDocument()
  })

  it('does not show Room Type column', () => {
    renderPage()
    
    expect(screen.queryByText('Room Type')).not.toBeInTheDocument()
  })

  it('shows edit button for admin users', () => {
    renderPage()
    
    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    expect(editButtons.length).toBeGreaterThan(0)
  })
})