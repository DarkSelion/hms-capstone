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
  it('shows View + Check In as primary buttons, Edit/Cancel in dropdown for confirmed non-overdue', async () => {
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

    expect(screen.getByTitle('View')).toBeInTheDocument()
    expect(screen.getByTitle('Check In')).toBeInTheDocument()
    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Cancel')).not.toBeInTheDocument()

    await user.click(screen.getByTitle('More actions'))
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('shows Mark No Show in dropdown for overdue confirmed, no Check In', async () => {
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

    expect(screen.queryByTitle('Check In')).not.toBeInTheDocument()
    await user.click(screen.getByTitle('More actions'))
    expect(screen.getByText('Mark No Show')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('keeps Check In on overdue when alwaysAllowCheckIn is set', () => {
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

    expect(screen.getByTitle('Check In')).toBeInTheDocument()
    expect(screen.queryByTitle('Mark No Show')).not.toBeInTheDocument()
  })

  it('shows only View for cancelled reservations (no dropdown)', () => {
    render(
      <ReservationRowActions
        reservation={reservation({ status: 'cancelled' })}
        onView={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    expect(screen.getByTitle('View')).toBeInTheDocument()
    expect(screen.queryByTitle('More actions')).not.toBeInTheDocument()
  })

  it('shows only View for checked_out reservations (no dropdown)', () => {
    render(
      <ReservationRowActions
        reservation={reservation({ status: 'checked_out' })}
        onView={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    expect(screen.getByTitle('View')).toBeInTheDocument()
    expect(screen.queryByTitle('More actions')).not.toBeInTheDocument()
  })

  it('shows View + Check Out primary buttons, Edit/Extend Stay in dropdown for checked-in', async () => {
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

    expect(screen.getByTitle('View')).toBeInTheDocument()
    expect(screen.getByTitle('Check Out')).toBeInTheDocument()
    await user.click(screen.getByTitle('More actions'))
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Extend Stay')).toBeInTheDocument()
  })

  it('shows Process Refund in dropdown when refund pending', async () => {
    const user = userEvent.setup()
    render(
      <ReservationRowActions
        reservation={reservation({ refund_requested_at: '2026-10-11T00:00:00.000000Z', payment_status: 'partial' })}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onProcessRefund={vi.fn()}
      />,
    )

    await user.click(screen.getByTitle('More actions'))
    expect(screen.getByText('Process Refund')).toBeInTheDocument()
  })

  it('hides Process Refund when already refunded', async () => {
    const user = userEvent.setup()
    render(
      <ReservationRowActions
        reservation={reservation({ refund_requested_at: '2026-10-11T00:00:00.000000Z', payment_status: 'refunded' })}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onProcessRefund={vi.fn()}
      />,
    )

    await user.click(screen.getByTitle('More actions'))
    expect(screen.queryByText('Process Refund')).not.toBeInTheDocument()
  })

  it('fires handlers when primary buttons are clicked', async () => {
    const user = userEvent.setup()
    const onView = vi.fn()
    const onCheckIn = vi.fn()

    render(
      <ReservationRowActions
        reservation={reservation()}
        onView={onView}
        onEdit={vi.fn()}
        onCancel={vi.fn()}
        onCheckIn={onCheckIn}
      />,
    )

    await user.click(screen.getByTitle('View'))
    expect(onView).toHaveBeenCalledTimes(1)

    await user.click(screen.getByTitle('Check In'))
    expect(onCheckIn).toHaveBeenCalledTimes(1)
  })

  it('fires handler from dropdown when clicked', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()

    render(
      <ReservationRowActions
        reservation={reservation()}
        onView={vi.fn()}
        onEdit={onEdit}
        onCancel={vi.fn()}
        onCheckIn={vi.fn()}
      />,
    )

    await user.click(screen.getByTitle('More actions'))
    await user.click(screen.getByText('Edit'))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })
})
