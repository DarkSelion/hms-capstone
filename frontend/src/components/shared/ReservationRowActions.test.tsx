import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReservationRowActions } from './ReservationRowActions'
import type { Guest, Reservation, Room } from '@/types'

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 1,
    reservation_number: 'BK-2026-0001',
    guest: {} as Guest,
    room: {} as Room,
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

describe('ReservationRowActions', () => {
  it('shows View and Check In for a confirmed non-overdue reservation with Cancel in dropdown', async () => {
    const user = userEvent.setup()
    render(
      <ReservationRowActions
        reservation={reservation()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onCancel={vi.fn()}
        onCheckIn={vi.fn()}
      />,
    )

    expect(screen.getByText('View')).toBeInTheDocument()
    expect(screen.getByText('Check In')).toBeInTheDocument()
    await user.click(screen.getByTitle('More actions'))
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.queryByText('Mark No Show')).not.toBeInTheDocument()
  })

  it('shows Mark No Show in dropdown instead of Check In for overdue confirmed reservation', async () => {
    const user = userEvent.setup()
    render(
      <ReservationRowActions
        reservation={reservation({ is_overdue: true })}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onCancel={vi.fn()}
        onCheckIn={vi.fn()}
        onMarkNoShow={vi.fn()}
      />,
    )

    expect(screen.queryByText('Check In')).not.toBeInTheDocument()
    await user.click(screen.getByTitle('More actions'))
    expect(screen.getByText('Mark No Show')).toBeInTheDocument()
  })

  it('keeps Check In on an overdue reservation when alwaysAllowCheckIn is set', () => {
    render(
      <ReservationRowActions
        reservation={reservation({ is_overdue: true })}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onCancel={vi.fn()}
        onCheckIn={vi.fn()}
        onMarkNoShow={vi.fn()}
        alwaysAllowCheckIn
      />,
    )

    expect(screen.getByText('Check In')).toBeInTheDocument()
  })

  it('shows only View for cancelled reservations', () => {
    render(
      <ReservationRowActions
        reservation={reservation({ status: 'cancelled' })}
        onView={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    expect(screen.getByText('View')).toBeInTheDocument()
    expect(screen.queryByTitle('More actions')).not.toBeInTheDocument()
  })

  it('shows View, Check Out, and More dropdown for checked-in reservations', async () => {
    const user = userEvent.setup()
    render(
      <ReservationRowActions
        reservation={reservation({ status: 'checked_in' })}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onCheckOut={vi.fn()}
        onExtendStay={vi.fn()}
      />,
    )

    expect(screen.getByText('View')).toBeInTheDocument()
    expect(screen.getByText('Check Out')).toBeInTheDocument()
    await user.click(screen.getByTitle('More actions'))
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Extend Stay')).toBeInTheDocument()
  })

  it('does not render More button when no extra actions are available', () => {
    render(
      <ReservationRowActions
        reservation={reservation()}
        onView={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    expect(screen.getByText('View')).toBeInTheDocument()
    expect(screen.queryByTitle('More actions')).not.toBeInTheDocument()
  })

  it('fires the View handler when the View button is clicked', async () => {
    const user = userEvent.setup()
    const onView = vi.fn()

    render(
      <ReservationRowActions
        reservation={reservation()}
        onView={onView}
        onEdit={vi.fn()}
      />,
    )

    await user.click(screen.getByText('View'))
    expect(onView).toHaveBeenCalledTimes(1)
  })
})
