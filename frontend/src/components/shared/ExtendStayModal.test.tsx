import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExtendStayModal } from './ExtendStayModal'
import { formatCurrency } from '@/lib/format'
import type { Guest, Reservation, Room } from '@/types'

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 1,
    reservation_number: 'BK-2026-0001',
    guest: { first_name: 'John', last_name: 'Doe' } as Guest,
    room: { room_number: '101' } as Room,
    status: 'checked_in',
    check_in: '2026-10-10',
    check_out: '2026-10-12',
    adults: 2,
    children: 0,
    total_amount: 2200,
    paid_amount: 1000,
    due_amount: 1200,
    payment_status: 'partial',
    price_per_night: 1000,
    discount_percent: 0,
    tax_percent: 10,
    created_at: '2026-10-01T00:00:00.000000Z',
    ...overrides,
  }
}

type OnConfirm = (newCheckOut: string) => void

function renderModal(overrides: {
  reservation?: Reservation
  isLoading?: boolean
  error?: string | null
  onConfirm?: ReturnType<typeof vi.fn<OnConfirm>>
} = {}) {
  const onConfirm = overrides.onConfirm ?? vi.fn<OnConfirm>()
  const result = render(
    <ExtendStayModal
      isOpen
      reservation={overrides.reservation ?? reservation()}
      isLoading={overrides.isLoading ?? false}
      error={overrides.error ?? null}
      onClose={vi.fn()}
      onConfirm={onConfirm}
    />,
  )
  return { onConfirm, rerender: result.rerender }
}

describe('ExtendStayModal', () => {
  it('shows guest, room, current check-out and status', () => {
    renderModal()

    expect(screen.getByRole('heading', { name: 'Extend Stay' })).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Room 101')).toBeInTheDocument()
    expect(screen.getByText('Scheduled Check Out')).toBeInTheDocument()
    expect(screen.getByText('12 Oct 2026')).toBeInTheDocument()
    expect(screen.getByText('Checked In')).toBeInTheDocument()
  })

  it('pre-fills new check-out one day after current check-out', () => {
    renderModal()

    expect(screen.getByText('Oct 13, 2026')).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: /Extend Stay/i })
    expect(confirm).toBeEnabled()
  })

  it('confirms with the new check-out date', () => {
    const { onConfirm } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: /Extend Stay/i }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith('2026-10-13')
  })

  it('shows the price preview using stored rate, discount and tax', () => {
    renderModal()

    // 3 nights (10 → 13 Oct) @ 1000 = 3000, +10% tax = 3300
    expect(screen.getByText('2 → 3')).toBeInTheDocument()
    expect(screen.getByText('(+1)')).toBeInTheDocument()
    expect(screen.getByText(formatCurrency(3300))).toBeInTheDocument()
    expect(screen.getByText(`+${formatCurrency(1100)}`)).toBeInTheDocument()
    expect(screen.getByText(formatCurrency(2300))).toBeInTheDocument()
  })

  it('displays backend errors', () => {
    renderModal({ error: 'The room is already reserved for another guest.' })

    expect(screen.getByText('The room is already reserved for another guest.')).toBeInTheDocument()
  })

  it('disables the confirm button while loading', () => {
    renderModal({ isLoading: true })

    expect(screen.getByRole('button', { name: /Processing/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled()
  })
})
