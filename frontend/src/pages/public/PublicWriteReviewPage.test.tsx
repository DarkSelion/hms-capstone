import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PublicWriteReviewPage from './PublicWriteReviewPage'

const { mockUsePublicReservation, mockUseSubmitReview, mockAddToast } =
  vi.hoisted(() => ({
    mockUsePublicReservation: vi.fn(),
    mockUseSubmitReview: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
    mockAddToast: vi.fn(),
  }))

vi.mock('@/hooks/usePublicApi', () => ({
  usePublicReservation: (...args: unknown[]) => mockUsePublicReservation(...args),
  useSubmitReview: () => mockUseSubmitReview(),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}))

vi.mock('@/stores/publicAuthStore', () => {
  const state = { token: 'tok', user: { id: 1, first_name: 'Jane', last_name: 'Doe', email: 'jane@test.com' }, setAuth: vi.fn(), logout: vi.fn() }
  const usePublicAuthStore = (sel?: (s: unknown) => unknown) => sel ? sel(state) : state
  usePublicAuthStore.getState = () => state
  return { usePublicAuthStore: usePublicAuthStore }
})

function renderPage(reservationOverride?: Record<string, unknown>) {
  const reservation = {
    id: 42,
    status: 'checked_out',
    reservation_number: 'BK-2026-0042',
    room: { room_type: { name: 'Deluxe Room' } },
    ...reservationOverride,
  }
  mockUsePublicReservation.mockReturnValue({ data: reservation, isLoading: false, error: null })

  return render(
    <MemoryRouter initialEntries={['/public/write-review/42']}>
      <Routes>
        <Route path="/public/write-review/:id" element={<PublicWriteReviewPage />} />
        <Route path="/public/my-reservations" element={<div>My Reservations</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PublicWriteReviewPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the review form when reservation is checked_out', () => {
    renderPage()
    expect(screen.getByText('Write a Review')).toBeInTheDocument()
    expect(screen.getByText(/Deluxe Room/)).toBeInTheDocument()
    expect(screen.getByText(/BK-2026-0042/)).toBeInTheDocument()
  })

  it('shows loading skeleton', () => {
    mockUsePublicReservation.mockReturnValue({ data: undefined, isLoading: true, error: null })
    const { container } = render(
      <MemoryRouter initialEntries={['/public/write-review/42']}>
        <Routes>
          <Route path="/public/write-review/:id" element={<PublicWriteReviewPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows not eligible when reservation is not checked_out', () => {
    renderPage({ status: 'confirmed' })
    expect(screen.getByText(/not eligible for a review/i)).toBeInTheDocument()
  })

  it('submits review with rating', async () => {
    const mockMutate = vi.fn((_data, opts) => opts.onSuccess())
    mockUseSubmitReview.mockReturnValue({ mutate: mockMutate, isPending: false })
    renderPage()

    // Click the 4th star (stars are just icon buttons with no text)
    const starButtons = screen.getAllByRole('button')
    // Filter to only the 5 star buttons (first 5 buttons in the rating section)
    const ratingStars = starButtons.filter(btn => btn.querySelector('svg'))
    fireEvent.click(ratingStars[3])

    fireEvent.change(screen.getByPlaceholderText(/sum up your experience/i), { target: { value: 'Great hotel!' } })
    fireEvent.change(screen.getByPlaceholderText(/tell other guests/i), { target: { value: 'Loved the pool and breakfast.' } })

    fireEvent.click(screen.getByRole('button', { name: /submit review/i }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ reservation_id: 42, rating: 4, title: 'Great hotel!' }),
        expect.any(Object),
      )
    })
  })
})
