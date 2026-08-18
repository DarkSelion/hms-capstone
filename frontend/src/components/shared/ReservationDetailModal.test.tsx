import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReservationDetailModal } from './ReservationDetailModal'
import type { Guest, Reservation, Room } from '@/types'

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 1,
    reservation_number: 'BK-2026-0001',
    guest: { first_name: 'John', last_name: 'Doe' } as Guest,
    room: { room_number: '101' } as Room,
    status: 'confirmed',
    check_in: '2026-10-10',
    check_out: '2026-10-12',
    adults: 2,
    children: 0,
    total_amount: 330,
    paid_amount: 0,
    due_amount: 330,
    payment_status: 'unpaid',
    created_at: '2026-10-01T00:00:00.000000Z',
    ...overrides,
  }
}

function renderModal(res: Reservation | null = reservation()) {
  return render(
    <ReservationDetailModal isOpen onClose={vi.fn()} reservation={res} onEdit={vi.fn()} />,
  )
}

describe('ReservationDetailModal', () => {
  it('renders the booked stay dates and nights', () => {
    renderModal()

    expect(screen.getByText('Stay')).toBeInTheDocument()
    expect(screen.getByText('10 Oct 2026 → 12 Oct 2026')).toBeInTheDocument()
    expect(screen.getByText(/2 nights/)).toBeInTheDocument()
  })

  it('shows the actual check-in and check-out timestamps when present', () => {
    renderModal(
      reservation({
        status: 'checked_out',
        checked_in_at: '2026-10-10T11:04:00',
        checked_out_at: '2026-10-12T09:30:00',
      }),
    )

    expect(screen.getByText(/Checked in/)).toBeInTheDocument()
    expect(screen.getByText(/Checked out/)).toBeInTheDocument()
  })

  it('omits the actual timestamps for reservations without them', () => {
    renderModal(reservation({ status: 'confirmed' }))

    expect(screen.queryByText(/Checked in/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Checked out/)).not.toBeInTheDocument()
  })
})
