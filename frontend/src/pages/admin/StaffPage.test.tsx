import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import StaffPage from './StaffPage'
import type { User, Role, StaffSchedule, LeaveRequest, PaginatedResponse } from '@/types'

const { mockApi, mockUseStaffList, mockUseStaffSchedules, mockUseLeaveRequests, mockUseRoles, mockUseCreateStaff, mockUseQueryClient, mockUseToast } =
  vi.hoisted(() => ({
    mockApi: {
      get: vi.fn(() => Promise.resolve({})),
      post: vi.fn(() => Promise.resolve({})),
      put: vi.fn(() => Promise.resolve({})),
      delete: vi.fn(() => Promise.resolve({})),
    },
    mockUseStaffList: vi.fn(),
    mockUseStaffSchedules: vi.fn(),
    mockUseLeaveRequests: vi.fn(),
    mockUseRoles: vi.fn(),
    mockUseCreateStaff: vi.fn(),
    mockUseQueryClient: vi.fn(),
    mockUseToast: vi.fn(),
  }))

vi.mock('@/hooks/useApi', () => ({
  useStaffList: () => mockUseStaffList(),
  useStaffSchedules: (params?: Record<string, unknown>) => mockUseStaffSchedules(params),
  useLeaveRequests: (params?: Record<string, unknown>) => mockUseLeaveRequests(params),
  useRoles: () => mockUseRoles(),
  useCreateStaff: () => mockUseCreateStaff(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockUseQueryClient(),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { role: 'admin' } }),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => mockUseToast(),
}))

vi.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({ label, value, onChange, error }: { label?: string; value: string; onChange: (v: string) => void; error?: string }) => (
    <div>
      {label && <label>{label}</label>}
      <input
        aria-label={label}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <p>{error}</p>}
    </div>
  ),
}))

function staffMember(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    name: 'Jane Doe',
    email: 'jane@hotel.com',
    phone: '09171234567',
    role: { id: 2, name: 'Receptionist', slug: 'receptionist', permissions: [] },
    is_active: true,
    created_at: '2026-01-10T08:00:00.000000Z',
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

const roles: Role[] = [
  { id: 1, name: 'Admin', slug: 'admin', permissions: [] },
  { id: 2, name: 'Receptionist', slug: 'receptionist', permissions: [] },
]

function schedule(overrides: Partial<StaffSchedule> = {}): StaffSchedule {
  return {
    id: 1,
    user_id: 1,
    user: staffMember(),
    date: '2026-08-15',
    start_time: '08:00',
    end_time: '16:00',
    notes: 'Morning shift',
    ...overrides,
  }
}

function leaveRequest(overrides: Partial<LeaveRequest> = {}): LeaveRequest {
  return {
    id: 1,
    user_id: 1,
    user: staffMember(),
    type: 'sick',
    status: 'pending',
    start_date: '2026-12-01',
    end_date: '2026-12-02',
    reason: 'Fever',
    created_at: '2026-08-10T09:00:00.000000Z',
    ...overrides,
  }
}

function renderPage() {
  mockUseStaffList.mockReturnValue({
    data: paginated([staffMember()]),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
  mockUseStaffSchedules.mockReturnValue({
    data: paginated([schedule()]),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
  mockUseLeaveRequests.mockReturnValue({
    data: paginated([leaveRequest()]),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
  mockUseRoles.mockReturnValue({ data: roles })
  mockUseCreateStaff.mockReturnValue({ mutate: vi.fn(), isPending: false })
  mockUseQueryClient.mockReturnValue({ invalidateQueries: vi.fn() })
  mockUseToast.mockReturnValue({ addToast: vi.fn() })
  return render(<StaffPage />)
}

function scheduleStaffSelect(): HTMLSelectElement {
  const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
  return selects.find(s => s.textContent?.includes('Select staff')) as HTMLSelectElement
}

describe('StaffPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens the staff details modal with all facts', () => {
    renderPage()
    fireEvent.click(screen.getByTitle('View'))

    expect(screen.getByRole('heading', { name: 'Staff Details' })).toBeTruthy()
    expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0)
    expect(screen.getAllByText('jane@hotel.com').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Receptionist').length).toBeGreaterThan(0)
    expect(screen.getAllByText('09171234567').length).toBeGreaterThan(0)
    expect(screen.getByText('Member Since')).toBeTruthy()
    expect(screen.getByText('Role & Access')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'jane@hotel.com' })).toHaveProperty('href', 'mailto:jane@hotel.com')

    fireEvent.click(screen.getByText('Close'))
    expect(screen.queryByRole('heading', { name: 'Staff Details' })).toBeNull()
  })

  it('renders schedules with edit and delete actions', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Schedules' }))

    expect(screen.getByText('Morning shift')).toBeTruthy()
    expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0)
    expect(screen.getByTitle('Edit')).toBeTruthy()
    expect(screen.getByTitle('Delete')).toBeTruthy()
  })

  it('opens the edit schedule modal prefilled and updates via PUT', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Schedules' }))
    fireEvent.click(screen.getByTitle('Edit'))

    expect(screen.getAllByRole('heading', { name: 'Edit Schedule' }).length).toBeGreaterThan(0)
    expect(scheduleStaffSelect().value).toBe('1')
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-08-15')
    expect((screen.getByLabelText('Start Time') as HTMLInputElement).value).toBe('08:00')
    expect((screen.getByLabelText('End Time') as HTMLInputElement).value).toBe('16:00')
    expect((screen.getByPlaceholderText('Notes...') as HTMLTextAreaElement).value).toBe('Morning shift')

    fireEvent.change(screen.getByLabelText('End Time'), { target: { value: '17:00' } })
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))

    expect(mockApi.put).toHaveBeenCalledWith('/staff-schedules/1', {
      user_id: '1',
      date: '2026-08-15',
      start_time: '08:00',
      end_time: '17:00',
      notes: 'Morning shift',
    })
    await waitFor(() => {
      expect(mockUseQueryClient().invalidateQueries).toHaveBeenCalledWith({ queryKey: ['staff-schedules'] })
    })
  })

  it('deletes a schedule after confirming', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Schedules' }))
    fireEvent.click(screen.getByTitle('Delete'))

    expect(screen.getByRole('heading', { name: 'Delete Schedule' })).toBeTruthy()

    const confirmBtn = screen.getAllByRole('button', { name: 'Delete' }).pop()
    fireEvent.click(confirmBtn as HTMLElement)

    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith('/staff-schedules/1')
      expect(mockUseQueryClient().invalidateQueries).toHaveBeenCalledWith({ queryKey: ['staff-schedules'] })
    })
  })

  it('validates the add schedule form', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Schedules' }))
    fireEvent.click(screen.getByRole('button', { name: /Add Schedule/ }))

    fireEvent.click(screen.getByRole('button', { name: /Save/ }))
    expect(screen.getByText('Staff is required')).toBeTruthy()
    expect(screen.getByText('Date is required')).toBeTruthy()
    expect(screen.getByText('Start time is required')).toBeTruthy()
    expect(screen.getByText('End time is required')).toBeTruthy()
    expect(mockApi.post).not.toHaveBeenCalled()

    fireEvent.change(scheduleStaffSelect(), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-20' } })
    fireEvent.change(screen.getByLabelText('Start Time'), { target: { value: '16:00' } })
    fireEvent.change(screen.getByLabelText('End Time'), { target: { value: '08:00' } })
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))

    expect(screen.getByText('End time must be after start time')).toBeTruthy()
    expect(mockApi.post).not.toHaveBeenCalled()
  })

  it('validates the request leave form', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Leave Requests' }))
    fireEvent.click(screen.getByRole('button', { name: /Request Leave/ }))

    fireEvent.click(screen.getByRole('button', { name: /Save/ }))
    expect(screen.getByText('Staff is required')).toBeTruthy()
    expect(screen.getByText('Start date is required')).toBeTruthy()
    expect(screen.getByText('End date is required')).toBeTruthy()
    expect(mockApi.post).not.toHaveBeenCalled()
  })

  it('shows the Reset Password card in the edit staff modal for an eligible target', () => {
    renderPage()
    fireEvent.click(screen.getByTitle('Edit'))

    expect(screen.getAllByRole('heading', { name: 'Edit Staff' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeTruthy()
    expect(screen.getByText('Leave blank to keep the current password.')).toBeTruthy()
    expect(screen.getByLabelText('New Password')).toBeTruthy()
    expect(screen.getByLabelText('Confirm Password')).toBeTruthy()
  })

  it('validates mismatched passwords in the edit staff form', () => {
    renderPage()
    fireEvent.click(screen.getByTitle('Edit'))

    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewSecret123' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Different123' } })
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))

    expect(screen.getByText('Passwords do not match')).toBeTruthy()
    expect(mockApi.put).not.toHaveBeenCalled()
  })

  it('sends the password in the edit staff payload when provided', async () => {
    renderPage()
    fireEvent.click(screen.getByTitle('Edit'))

    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewSecret123' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'NewSecret123' } })
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))

    expect(mockApi.put).toHaveBeenCalledWith('/staff/1', {
      name: 'Jane Doe',
      email: 'jane@hotel.com',
      phone: '09171234567',
      role_id: 2,
      is_active: true,
      password: 'NewSecret123',
      password_confirmation: 'NewSecret123',
    })
    await waitFor(() => {
      expect(mockUseQueryClient().invalidateQueries).toHaveBeenCalledWith({ queryKey: ['staff'] })
    })
  })

  it('omits the password from the edit staff payload when left blank', () => {
    renderPage()
    fireEvent.click(screen.getByTitle('Edit'))

    fireEvent.click(screen.getByRole('button', { name: /Save/ }))

    expect(mockApi.put).toHaveBeenCalledWith('/staff/1', {
      name: 'Jane Doe',
      email: 'jane@hotel.com',
      phone: '09171234567',
      role_id: 2,
      is_active: true,
    })
    const payload = (mockApi.put.mock.calls[0] as unknown[])[1] as Record<string, unknown>
    expect(payload).not.toHaveProperty('password')
  })

  it('renders merged identity cell with avatar, name and email together', () => {
    renderPage()

    expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0)
    expect(screen.getAllByText('jane@hotel.com').length).toBeGreaterThan(0)
    // Initials avatar
    expect(screen.getAllByText('JD').length).toBeGreaterThan(0)
  })

  it('filters staff by role via the role dropdown and shows the filter bar', () => {
    renderPage()

    const roleSelect = screen.getAllByRole('combobox').find((s) => (s as HTMLSelectElement).textContent?.includes('All Roles')) as HTMLSelectElement
    fireEvent.change(roleSelect, { target: { value: '1' } }) // Admin — Jane is Receptionist, so row disappears

    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument()
    expect(screen.getByText('Active filters:')).toBeInTheDocument()
    expect(screen.getByText('Role: Admin')).toBeInTheDocument()
  })

  it('shows merged shift column with time range on schedules tab', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Schedules' }))

    expect(screen.getByText('15 Aug 2026')).toBeInTheDocument()
    expect(screen.getByText(/08:00 – 16:00/)).toBeInTheDocument()
  })

  it('shows merged dates column with day count on leave requests tab', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Leave Requests' }))

    expect(screen.getByText(/1 Dec 2026/)).toBeInTheDocument()
    expect(screen.getByText('2 days')).toBeInTheDocument()
  })
})