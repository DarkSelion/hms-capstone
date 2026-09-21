import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockApproveMutate = vi.fn()
const mockRejectMutate = vi.fn()
const mockReplyMutate = vi.fn()

const MOCK_REVIEW = {
  id: 1,
  rating: 5,
  title: 'Excellent stay',
  comment: 'The room was spotless.',
  status: 'pending' as const,
  is_verified_stay: true,
  admin_response: null,
  admin_replied_at: null,
  guest: { id: 10, first_name: 'Maria', last_name: 'Santos', full_name: 'Maria Santos', email: 'maria@test.com' },
  room_type: { id: 1, name: 'Deluxe Room' },
  reservation: { id: 20, booking_number: 'BK-2026-0010' },
  created_at: '2026-09-10T10:00:00Z',
}

const MOCK_EMPTY = { data: [], current_page: 1, last_page: 1, per_page: 10, total: 0, kpis: { total: 0, pending_count: 0, approved_count: 0, rejected_count: 0, avg_rating: 0, response_rate: 0 } }
const MOCK_ONE = { data: [MOCK_REVIEW], current_page: 1, last_page: 1, per_page: 10, total: 1, kpis: { total: 1, pending_count: 1, approved_count: 0, rejected_count: 0, avg_rating: 5, response_rate: 0 } }

let currentReviewsData: typeof MOCK_ONE = MOCK_ONE

vi.mock('@/hooks/useApi', () => ({
  useReviews: () => ({ data: currentReviewsData, isLoading: false, error: null }),
  useApproveReview: () => ({ mutate: mockApproveMutate, isPending: false }),
  useRejectReview: () => ({ mutate: mockRejectMutate, isPending: false }),
  useDeleteReview: () => ({ mutate: vi.fn(), isPending: false }),
  useReplyToReview: () => ({ mutate: mockReplyMutate, isPending: false }),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('@/stores/authStore', () => {
  const state = { user: { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin' }, token: 'tok', setAuth: vi.fn(), logout: vi.fn() }
  const useAuthStore = (sel?: (s: unknown) => unknown) => sel ? sel(state) : state
  useAuthStore.getState = () => state
  return { useAuthStore }
})

const { default: ReviewsPage } = await import('./ReviewsPage')

describe('ReviewsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentReviewsData = MOCK_ONE
  })

  it('renders review rows with rating and guest name', () => {
    render(<ReviewsPage />)
    expect(screen.getByText('Excellent stay')).toBeInTheDocument()
    expect(screen.getByText('Maria Santos')).toBeInTheDocument()
    expect(screen.getByText(/Deluxe Room/)).toBeInTheDocument()
  })

  it('shows action buttons for pending reviews', () => {
    render(<ReviewsPage />)
    const buttons = screen.getAllByRole('button')
    const iconButtons = buttons.filter(b => b.querySelector('svg') && !b.textContent?.trim())
    // Approve + Reject + Reply + Delete = 4 icon buttons
    expect(iconButtons.length).toBeGreaterThanOrEqual(4)
  })

  it('calls approve mutation when Approve clicked', () => {
    render(<ReviewsPage />)
    const buttons = screen.getAllByRole('button')
    const iconButtons = buttons.filter(b => b.querySelector('svg') && !b.textContent?.trim())
    fireEvent.click(iconButtons[0]) // First icon button = Approve
    expect(mockApproveMutate).toHaveBeenCalled()
  })

  it('opens reply modal when Reply clicked', () => {
    render(<ReviewsPage />)
    const buttons = screen.getAllByRole('button')
    const iconButtons = buttons.filter(b => b.querySelector('svg') && !b.textContent?.trim())
    fireEvent.click(iconButtons[2]) // 3rd = Reply (Approve, Reject, Reply)
    expect(screen.getByText(/reply to review/i)).toBeInTheDocument()
  })

  it('shows no reviews found when list is empty', () => {
    currentReviewsData = MOCK_EMPTY
    render(<ReviewsPage />)
    expect(screen.getByText(/no reviews found/i)).toBeInTheDocument()
  })
})
