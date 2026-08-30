import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import ActivityLogsPage from './ActivityLogsPage'
import type { ActivityLog, PaginatedResponse, User } from '@/types'

const { mockUseActivityLogs, mockUseStaffAssignable } = vi.hoisted(() => ({
  mockUseActivityLogs: vi.fn(),
  mockUseStaffAssignable: vi.fn(),
}))

vi.mock('@/hooks/useApi', () => ({
  useActivityLogs: (_params?: Record<string, unknown>) => mockUseActivityLogs(_params),
  useStaffAssignable: () => mockUseStaffAssignable(),
}))

function staff(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    name: 'Admin User',
    email: 'admin@test.com',
    role: { id: 1, name: 'Admin', slug: 'admin', permissions: [] },
    is_active: true,
    created_at: '2026-01-01T00:00:00.000000Z',
    ...overrides,
  }
}

function log(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: 1,
    action: 'created',
    module: 'reservations',
    description: 'Created reservation #BK-2026-0001',
    created_at: '2026-08-01T10:00:00.000000Z',
    ...overrides,
  }
}

function paginated(logs: ActivityLog[]): PaginatedResponse<ActivityLog> {
  return {
    data: logs,
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: logs.length,
  }
}

function renderPage() {
  mockUseActivityLogs.mockReturnValue({
    data: paginated([log()]),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
  mockUseStaffAssignable.mockReturnValue({ data: [staff()], isLoading: false, error: null })
  return render(<ActivityLogsPage />)
}

/** Click the activity feed row that contains the given text. */
function clickRowByText(text: string | RegExp) {
  const el = screen.getByText(text)
  // Walk up to the <button> row (the activity feed row)
  const row = el.closest('button[type="button"]') ?? el.closest('button')
  if (!row) throw new Error(`No button ancestor found for element with text: ${text}`)
  fireEvent.click(row)
}

describe('ActivityLogsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders staff activity rows with actor name', () => {
    mockUseActivityLogs.mockReturnValue({
      data: paginated([log({ id: 1, user_id: 1, user: staff() })]),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseStaffAssignable.mockReturnValue({ data: [staff()], isLoading: false, error: null })
    render(<ActivityLogsPage />)

    expect(screen.getAllByText('Admin User').length).toBeGreaterThan(0)
    // Description is tokenized — "Created reservation" is plain text, "#BK-2026-0001" is a chip
    expect(screen.getByText(/Created reservation/)).toBeTruthy()
    expect(screen.getByText('#BK-2026-0001')).toBeTruthy()
    expect(screen.getAllByText('Reservations').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Created').length).toBeGreaterThan(0)
  })

  it('renders Guest badge for guest activity rows', () => {
    mockUseActivityLogs.mockReturnValue({
      data: paginated([log({ id: 2, user_id: null, description: 'Guest Maria created reservation' })]),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseStaffAssignable.mockReturnValue({ data: [staff()], isLoading: false, error: null })
    render(<ActivityLogsPage />)

    expect(screen.getByText(/Guest Maria created reservation/)).toBeTruthy()
    expect(screen.getAllByText('Guest').length).toBeGreaterThan(0)
  })

  it('renders scope filter options', () => {
    renderPage()
    const scopeSelect = screen.getAllByRole('combobox')[0]
    expect(within(scopeSelect).getByRole('option', { name: 'All Actors' })).toBeTruthy()
    expect(within(scopeSelect).getByRole('option', { name: 'Guest' })).toBeTruthy()
    expect(within(scopeSelect).getByRole('option', { name: 'Staff' })).toBeTruthy()
  })

  it('renders empty state when no logs', () => {
    mockUseActivityLogs.mockReturnValue({
      data: paginated([]),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseStaffAssignable.mockReturnValue({ data: [staff()], isLoading: false, error: null })
    render(<ActivityLogsPage />)

    expect(screen.getByText('No activity found')).toBeTruthy()
  })

  it('renders error state and retry', () => {
    mockUseActivityLogs.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch: vi.fn(),
    })
    mockUseStaffAssignable.mockReturnValue({ data: [staff()], isLoading: false, error: null })
    render(<ActivityLogsPage />)

    expect(screen.getByText('Failed to load activity logs')).toBeTruthy()
    expect(screen.getByText('Retry')).toBeTruthy()
  })

  it('opens detail modal showing actor, description, and friendly change diff', () => {
    mockUseActivityLogs.mockReturnValue({
      data: paginated([
        log({
          id: 9,
          user_id: 1,
          user: staff(),
          action: 'updated',
          module: 'reservations',
          description: 'Updated reservation #BK-2026-0001',
          ip_address: '192.168.1.10',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0)',
          model_type: 'App\\Models\\Reservation',
          model_id: 42,
          old_values: { status: 'confirmed', total_amount: 2500 },
          new_values: { status: 'checked_in', total_amount: 2700 },
        }),
      ]),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseStaffAssignable.mockReturnValue({ data: [staff()], isLoading: false, error: null })
    render(<ActivityLogsPage />)

    // Click the activity row (the button containing the description)
    clickRowByText(/Updated reservation/)

    expect(screen.getByRole('heading', { name: 'Activity Details' })).toBeTruthy()
    expect(screen.getAllByText('Admin User').length).toBeGreaterThan(1)
    expect(screen.getByText('192.168.1.10')).toBeTruthy()
    expect(screen.getByText('Mozilla/5.0 (Windows NT 10.0)')).toBeTruthy()
    expect(screen.getByText('Related Record')).toBeTruthy()
    expect(screen.getByText('App\\Models\\Reservation #42')).toBeTruthy()

    expect(screen.getByText('Changes')).toBeTruthy()
    expect(screen.getByText('Status')).toBeTruthy()
    expect(screen.getByText('Before')).toBeTruthy()
    expect(screen.getByText('After')).toBeTruthy()
    expect(screen.getByText('confirmed')).toBeTruthy()
    expect(screen.getByText('checked_in')).toBeTruthy()
    expect(screen.getByText('₱2,500.00')).toBeTruthy()
    expect(screen.getByText('₱2,700.00')).toBeTruthy()

    fireEvent.click(screen.getByText('Close'))
    expect(screen.queryByRole('heading', { name: 'Activity Details' })).toBeNull()
  })

  it('renders Guest actor and no field-level changes when values absent', () => {
    mockUseActivityLogs.mockReturnValue({
      data: paginated([
        log({
          id: 10,
          user_id: null,
          description: 'Guest Maria created reservation',
        }),
      ]),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseStaffAssignable.mockReturnValue({ data: [staff()], isLoading: false, error: null })
    render(<ActivityLogsPage />)

    clickRowByText(/Guest Maria created reservation/)

    expect(screen.getByRole('heading', { name: 'Activity Details' })).toBeTruthy()
    expect(screen.getByText('Portal / customer action')).toBeTruthy()
    expect(screen.queryByText('Changes')).toBeNull()
    fireEvent.click(screen.getByText('Close'))
  })

  it('highlights reservation codes, ids, and currency in the description', () => {
    mockUseActivityLogs.mockReturnValue({
      data: paginated([
        log({
          id: 11,
          user_id: null,
          module: 'maintenance',
          description: 'Overdue reservation #BK-2026-0016-W99U flagged for No Show review',
        }),
      ]),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseStaffAssignable.mockReturnValue({ data: [staff()], isLoading: false, error: null })
    render(<ActivityLogsPage />)

    clickRowByText(/Overdue reservation/)

    expect(screen.getByText('What Happened')).toBeTruthy()
    // The chip appears in both the feed row and the modal — grab both, assert on the modal one
    const chips = screen.getAllByText('#BK-2026-0016-W99U')
    expect(chips.length).toBeGreaterThanOrEqual(2)
    const modalChip = chips[chips.length - 1]
    expect(modalChip.className).toContain('bg-gold/15')
    expect(modalChip.className).toContain('font-mono')
    expect(screen.getAllByText(/Overdue reservation/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/flagged for No Show review/).length).toBeGreaterThan(0)
  })
})
