import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCheckInOutModal } from './useCheckInOutModal'
import type { Guest, Payment, Reservation, Room } from '@/types'

const { mockStatusChange } = vi.hoisted(() => ({ mockStatusChange: vi.fn() }))

vi.mock('@/hooks/useApi', () => ({
  useCheckInOutWithPayment: () => ({ performStatusChange: mockStatusChange, isLoading: false }),
}))

function makeReservation(): Reservation {
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
  }
}

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 10,
    reservation_id: 1,
    amount: 330,
    payment_method: 'cash',
    status: 'completed',
    created_at: '2026-10-01T00:00:00.000000Z',
    ...overrides,
  }
}

describe('useCheckInOutModal', () => {
  beforeEach(() => {
    mockStatusChange.mockReset()
  })

  it('opens on a reservation and clears when closed', () => {
    const { result } = renderHook(() => useCheckInOutModal('check-in'))
    const res = makeReservation()

    expect(result.current.isOpen).toBe(false)
    act(() => result.current.open(res))
    expect(result.current.isOpen).toBe(true)
    expect(result.current.target).toBe(res)

    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
    expect(result.current.target).toBeNull()
  })

  it('confirm performs the status change only and closes on success', async () => {
    mockStatusChange.mockResolvedValue(undefined)
    const { result } = renderHook(() => useCheckInOutModal('check-in'))
    const res = makeReservation()
    act(() => result.current.open(res))

    await act(async () => {
      await result.current.confirm()
    })
    expect(mockStatusChange).toHaveBeenCalledWith('check-in', res, undefined)
    expect(result.current.isOpen).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('confirm failure surfaces the server message with paymentRecorded false', async () => {
    mockStatusChange.mockRejectedValue(new Error('server down'))
    const { result } = renderHook(() => useCheckInOutModal('check-out'))
    const res = makeReservation()
    act(() => result.current.open(res))

    await act(async () => {
      await result.current.confirm()
    })
    expect(result.current.isOpen).toBe(true)
    expect(result.current.error?.paymentRecorded).toBe(false)
    expect(result.current.error?.message).toBe('server down')
  })

  it('confirmAfterPayment applies the optimistic balance update before the status change', async () => {
    const failure = new Error('boom')
    mockStatusChange.mockRejectedValue(failure)
    const { result } = renderHook(() => useCheckInOutModal('check-in'))
    const res = makeReservation()
    act(() => result.current.open(res))

    await act(async () => {
      await result.current.confirmAfterPayment(payment({ amount: 165 }))
    })
    expect(mockStatusChange).toHaveBeenCalledWith('check-in', res, undefined)
    expect(result.current.error?.paymentRecorded).toBe(true)
    expect(result.current.error?.message).toMatch(/Payment was recorded, but check-in failed/)
    expect(result.current.target?.paid_amount).toBe(165)
    expect(result.current.target?.due_amount).toBe(165)
    expect(result.current.target?.payment_status).toBe('partial')
  })

  it('fully pays when the recorded payment covers the balance', async () => {
    mockStatusChange.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useCheckInOutModal('check-in'))
    const res = makeReservation()
    act(() => result.current.open(res))

    await act(async () => {
      await result.current.confirmAfterPayment(payment({ amount: 330 }))
    })
    expect(result.current.target?.due_amount).toBe(0)
    expect(result.current.target?.payment_status).toBe('paid')
  })

  it('does not adjust the balance for a pending (GCash) payment', async () => {
    mockStatusChange.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useCheckInOutModal('check-in'))
    const res = makeReservation()
    act(() => result.current.open(res))

    await act(async () => {
      await result.current.confirmAfterPayment(payment({ amount: 165, status: 'pending' }))
    })
    expect(result.current.target?.paid_amount).toBe(0)
    expect(result.current.target?.due_amount).toBe(330)
  })

  it('retry after a recorded payment re-runs the status change without re-paying', async () => {
    mockStatusChange.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useCheckInOutModal('check-in'))
    const res = makeReservation()
    act(() => result.current.open(res))

    await act(async () => {
      await result.current.confirmAfterPayment(payment({ amount: 165 }))
    })
    expect(result.current.error?.paymentRecorded).toBe(true)

    await act(async () => {
      await result.current.confirmAfterPayment()
    })
    expect(mockStatusChange).toHaveBeenCalledTimes(2)
    expect(result.current.isOpen).toBe(false)
    expect(result.current.error).toBeNull()
  })
})
