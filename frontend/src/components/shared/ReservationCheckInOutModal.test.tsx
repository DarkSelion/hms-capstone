import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReservationCheckInOutModal } from './ReservationCheckInOutModal'
import type { ReactElement } from 'react'
import type { CheckoutPreview, Guest, Payment, Reservation, Room } from '@/types'

const { mockPreview, mockPreviewArgs } = vi.hoisted(() => ({
  mockPreview: { data: null as CheckoutPreview | null, isLoading: false },
  mockPreviewArgs: [] as unknown[],
}))

vi.mock('@/hooks/useApi', () => ({
  useCheckoutPreview: (id: number, actualCheckOut?: string) => {
    mockPreviewArgs.push([id, actualCheckOut])
    return mockPreview
  },
  useSettings: () => ({ data: { check_out_time: '12:00' } }),
}))

const { mockPaymentModalProps } = vi.hoisted(() => ({
  mockPaymentModalProps: { actualCheckOut: undefined as string | undefined },
}))

vi.mock('@/components/shared/PaymentModal', () => ({
  PaymentModal: ({
    isOpen,
    onSuccess,
    confirmLabel,
    hideHalf,
    actualCheckOut,
  }: {
    isOpen: boolean
    onSuccess?: (payment: Payment) => void
    confirmLabel?: string
    hideHalf?: boolean
    actualCheckOut?: string
  }) => {
    mockPaymentModalProps.actualCheckOut = actualCheckOut
    return isOpen ? (
      <button
        data-half={String(hideHalf)}
        onClick={() =>
          onSuccess?.({
            id: 99,
            reservation_id: 1,
            amount: 330,
            payment_method: 'cash',
            status: 'completed',
            created_at: '2026-10-01T00:00:00.000000Z',
          } as Payment)
        }
      >
        stub-{confirmLabel}
      </button>
    ) : null
  },
}))

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

type OnConfirm = () => void
type OnConfirmAfterPayment = (payment?: Payment, actualCheckOut?: string) => void
type ModalError = { message: string; paymentRecorded: boolean }

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(ui, {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
}

function renderModal(overrides: {
  mode?: 'check-in' | 'check-out'
  reservation?: Reservation
  error?: ModalError | null
  onConfirm?: ReturnType<typeof vi.fn<OnConfirm>>
  onConfirmAfterPayment?: ReturnType<typeof vi.fn<OnConfirmAfterPayment>>
} = {}) {
  const onConfirm = overrides.onConfirm ?? vi.fn<OnConfirm>()
  const onConfirmAfterPayment = overrides.onConfirmAfterPayment ?? vi.fn<OnConfirmAfterPayment>()
  const result = renderWithClient(
    <ReservationCheckInOutModal
      mode={overrides.mode ?? 'check-in'}
      reservation={overrides.reservation ?? reservation()}
      isOpen
      error={overrides.error ?? null}
      onClose={vi.fn()}
      onConfirm={onConfirm}
      onConfirmAfterPayment={onConfirmAfterPayment}
    />,
  )
  return { onConfirm, onConfirmAfterPayment, rerender: result.rerender }
}

describe('ReservationCheckInOutModal', () => {
  beforeEach(() => {
    mockPreview.data = null
    mockPreviewArgs.length = 0
    mockPaymentModalProps.actualCheckOut = undefined
  })

  it('shows the guest info table with guest, room, stay and payment rows', () => {
    renderModal()

    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText(/Room 101/)).toBeInTheDocument()
    expect(screen.getByText('Stay')).toBeInTheDocument()
    expect(screen.getByText('Payments')).toBeInTheDocument()
    expect(screen.getByText('Unpaid')).toBeInTheDocument()
    expect(screen.getByText('Check In Guest')).toBeInTheDocument()
  })

  it('shows the configured check-out time in the Stay section', () => {
    renderModal()

    expect(screen.getByText('Check-out Time')).toBeInTheDocument()
    expect(screen.getByText('12:00 PM')).toBeInTheDocument()
  })

  it('renders payment status labels', () => {
    renderModal({ reservation: reservation({ payment_status: 'paid', due_amount: 0 }) })
    expect(screen.getByText('Paid in full')).toBeInTheDocument()

    const { unmount } = renderWithClient(
      <ReservationCheckInOutModal
        mode="check-in"
        reservation={reservation({
          payment_status: 'paid',
          due_amount: 0,
          payments: [{ payment_method: 'cash' } as Payment],
        })}
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.getByText('Paid in full · Cash')).toBeInTheDocument()
    unmount()

    renderWithClient(
      <ReservationCheckInOutModal
        mode="check-in"
        reservation={reservation({ payment_status: 'partial', paid_amount: 100, due_amount: 230 })}
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.getByText(/Partial — ₱100\.00 of ₱330\.00 paid/)).toBeInTheDocument()
  })

  it('does not show the balance banner or Record Payment when fully paid', () => {
    renderModal({ reservation: reservation({ due_amount: 0, payment_status: 'paid' }) })

    expect(screen.queryByText(/Outstanding balance/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Collect/ })).not.toBeInTheDocument()
  })

  it('requires a payment and opens the payment modal instead of confirming when no payment is recorded', () => {
    const { onConfirm } = renderModal()

    expect(screen.getByText(/A payment is required before checking in/i)).toBeInTheDocument()
    expect(screen.queryByText(/payments are optional/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collect & Check In' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Collect & Check In' }))
    expect(screen.getByRole('button', { name: 'stub-Record & Check In' })).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('records a payment then triggers check-in automatically via onSuccess', () => {
    const { onConfirmAfterPayment } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'Collect & Check In' }))
    fireEvent.click(screen.getByRole('button', { name: 'stub-Record & Check In' }))

    expect(onConfirmAfterPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 330 }), undefined, undefined)
  })

  it('allows check-in directly when a payment has already been recorded', () => {
    const { onConfirm } = renderModal({
      reservation: reservation({
        payment_status: 'partial',
        paid_amount: 150,
        due_amount: 180,
        payments: [{ payment_method: 'cash', status: 'completed' } as Payment],
      }),
    })

    expect(screen.getByText(/payments are optional/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check In' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Check In' }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('does not count a failed payment as collected, so check-in still requires payment', () => {
    const { onConfirm } = renderModal({
      reservation: reservation({
        payment_status: 'partial',
        paid_amount: 0,
        due_amount: 330,
        payments: [{ payment_method: 'gcash', status: 'failed' } as Payment],
      }),
    })

    expect(screen.getByRole('button', { name: 'Collect & Check In' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check In' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Collect & Check In' }))
    expect(screen.getByRole('button', { name: 'stub-Record & Check In' })).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('counts a pending payment as recorded for check-in purposes', () => {
    const { onConfirm } = renderModal({
      reservation: reservation({
        payment_status: 'partial',
        paid_amount: 0,
        due_amount: 330,
        payments: [{ payment_method: 'gcash', status: 'pending' } as Payment],
      }),
    })

    expect(screen.getByText(/payments are optional/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check In' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Check In' }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('shows the ghost Collect button only when a payment already exists', () => {
    renderModal({
      reservation: reservation({
        payment_status: 'partial',
        paid_amount: 150,
        due_amount: 180,
        payments: [{ payment_method: 'cash', status: 'completed' } as Payment],
      }),
    })

    expect(screen.getByRole('button', { name: /Collect ₱180\.00/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Collect ₱180\.00/i }))
    expect(screen.getByRole('button', { name: 'stub-Record & Check In' })).toBeInTheDocument()
  })

  it('hides the ghost Collect button when no payment is recorded yet', () => {
    renderModal()

    expect(screen.queryByRole('button', { name: /Collect ₱/i })).not.toBeInTheDocument()
  })

  it('uses the check-out verb in labels and requires payment on check-out too', () => {
    renderModal({ mode: 'check-out', reservation: reservation({ status: 'checked_in' }) })

    expect(screen.getByText('Check Out Guest')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collect & Check Out' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Collect & Check Out' }))
    expect(screen.getByRole('button', { name: 'stub-Record & Check Out' })).toBeInTheDocument()
  })

  it('hides the Half quick button only when the payment modal is used for check-out', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Collect & Check In' }))
    expect(screen.getByRole('button', { name: 'stub-Record & Check In' })).toHaveAttribute('data-half', 'false')

    const { unmount } = renderWithClient(
      <ReservationCheckInOutModal
        mode="check-out"
        reservation={reservation({ status: 'checked_in', due_amount: 330 })}
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Collect & Check Out' }))
    expect(screen.getByRole('button', { name: 'stub-Record & Check Out' })).toHaveAttribute('data-half', 'true')
    unmount()
  })

  it('requires full settlement at check-out even when a payment already exists', () => {
    const { onConfirm } = renderModal({
      mode: 'check-out',
      reservation: reservation({
        status: 'checked_in',
        payment_status: 'partial',
        paid_amount: 150,
        due_amount: 180,
        payments: [{ payment_method: 'cash', status: 'completed' } as Payment],
      }),
    })

    expect(screen.getByText(/A payment is required before checking out/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check Out' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collect & Check Out' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Collect & Check Out' }))
    expect(screen.getByRole('button', { name: 'stub-Record & Check Out' })).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('allows plain check-out when fully settled', () => {
    const { onConfirm } = renderModal({
      mode: 'check-out',
      reservation: reservation({
        status: 'checked_in',
        payment_status: 'paid',
        paid_amount: 330,
        due_amount: 0,
        payments: [{ payment_method: 'cash', status: 'completed' } as Payment],
      }),
    })

    expect(screen.queryByText(/Outstanding balance/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check Out' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Check Out' }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('shows a retry state when a payment was recorded but the status change failed', () => {
    const { onConfirmAfterPayment } = renderModal({
      mode: 'check-out',
      reservation: reservation({ status: 'checked_in', due_amount: 330 }),
      error: {
        message: 'Payment was recorded, but check-out failed. Retry to finish check-out — the amount has already been collected.',
        paymentRecorded: true,
      },
    })

    expect(screen.getByText(/Payment was recorded, but check-out failed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry Check Out' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry Check Out' }))
    expect(onConfirmAfterPayment).toHaveBeenCalled()
  })

  it('keeps the Collect button available in the check-out retry state when a balance remains', () => {
    renderModal({
      mode: 'check-out',
      reservation: reservation({ status: 'checked_in', due_amount: 330 }),
      error: {
        message: 'Payment was recorded, but check-out failed. Retry to finish check-out — the amount has already been collected.',
        paymentRecorded: true,
      },
    })

    expect(screen.getByRole('button', { name: /Collect ₱330\.00/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Collect ₱330\.00/i }))
    expect(screen.getByRole('button', { name: 'stub-Record & Check Out' })).toBeInTheDocument()
  })

  it('hides the Collect button in the check-out retry state once fully settled', () => {
    renderModal({
      mode: 'check-out',
      reservation: reservation({ status: 'checked_in', due_amount: 0, payment_status: 'paid' }),
      error: {
        message: 'Payment was recorded, but check-out failed. Retry to finish check-out.',
        paymentRecorded: true,
      },
    })

    expect(screen.queryByRole('button', { name: /Collect/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry Check Out' })).toBeInTheDocument()
  })

  it('retry never re-opens the payment modal after a recorded-payment failure', () => {
    const { rerender, onConfirmAfterPayment } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Collect & Check In' }))
    expect(screen.getByRole('button', { name: 'stub-Record & Check In' })).toBeInTheDocument()

    rerender(
      <ReservationCheckInOutModal
        mode="check-in"
        reservation={reservation({ due_amount: 330 })}
        isOpen
        error={{
          message: 'Payment was recorded, but check-in failed.',
          paymentRecorded: true,
        }}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onConfirmAfterPayment={onConfirmAfterPayment}
      />,
    )

    expect(screen.getByRole('button', { name: 'Retry Check In' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry Check In' }))
    expect(onConfirmAfterPayment).toHaveBeenCalled()
  })

  it('keeps the collect flow available when the payment itself failed', () => {
    const { onConfirm } = renderModal({
      mode: 'check-out',
      reservation: reservation({ status: 'checked_in', due_amount: 330 }),
      error: {
        message: 'The amount field is required.',
        paymentRecorded: false,
      },
    })

    expect(screen.getByText('The amount field is required.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collect & Check Out' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Collect & Check Out' }))
    expect(screen.getByRole('button', { name: 'stub-Record & Check Out' })).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('shows the actual departure picker and previews a recalculated total when the departure changes', () => {
    mockPreview.data = {
      actual_check_out: '2026-10-14',
      total_nights: 4,
      subtotal: 660,
      discount_amount: 0,
      tax_percent: 0,
      tax_amount: 0,
      total_amount: 660,
      paid_amount: 330,
      due_amount: 330,
      overlap: false,
      late_checkout_fee: 0,
      late_checkout_applies: false,
    }
    const { onConfirmAfterPayment } = renderModal({
      mode: 'check-out',
      reservation: reservation({
        status: 'checked_in',
        check_out: '2026-10-12',
        total_amount: 330,
        paid_amount: 330,
        due_amount: 0,
        payments: [{ payment_method: 'cash', status: 'completed' } as Payment],
      }),
    })

    expect(screen.getByRole('button', { name: /Oct 12, 2026/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Oct 12, 2026/ }))
    fireEvent.click(screen.getByRole('button', { name: '14' }))

    expect(screen.getAllByText('Nights').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('₱660.00').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Outstanding balance: ₱330.00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collect & Check Out' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Collect & Check Out' }))
    fireEvent.click(screen.getByRole('button', { name: 'stub-Record & Check Out' }))
    expect(onConfirmAfterPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 330 }), '2026-10-14', 660)
  })

  it('feeds the chosen departure date into the checkout preview', () => {
    mockPreview.data = {
      actual_check_out: '2026-10-13',
      total_nights: 3,
      subtotal: 495,
      discount_amount: 0,
      tax_percent: 0,
      tax_amount: 0,
      total_amount: 495,
      paid_amount: 495,
      due_amount: 0,
      overlap: false,
      late_checkout_fee: 0,
      late_checkout_applies: false,
    }
    renderModal({
      mode: 'check-out',
      reservation: reservation({ status: 'checked_in', check_out: '2026-10-12' }),
    })

    expect(mockPreviewArgs.at(-1)).toEqual([1, '2026-10-12'])
    fireEvent.click(screen.getByRole('button', { name: /Oct 12, 2026/ }))
    fireEvent.click(screen.getByRole('button', { name: '15' }))
    expect(mockPreviewArgs.at(-1)).toEqual([1, '2026-10-15'])
  })

  it('warns about an overlapping reservation during an extended stay', () => {
    mockPreview.data = {
      actual_check_out: '2026-10-14',
      total_nights: 4,
      subtotal: 660,
      discount_amount: 0,
      tax_percent: 0,
      tax_amount: 0,
      total_amount: 660,
      paid_amount: 330,
      due_amount: 330,
      overlap: true,
      late_checkout_fee: 0,
      late_checkout_applies: false,
    }
    renderModal({
      mode: 'check-out',
      reservation: reservation({ status: 'checked_in', check_out: '2026-10-12' }),
    })

    fireEvent.click(screen.getByRole('button', { name: /Oct 12, 2026/ }))
    fireEvent.click(screen.getByRole('button', { name: '14' }))

    expect(screen.getByText(/Another reservation overlaps this room during the extended stay/i)).toBeInTheDocument()
  })

  it('shows a payment history list with method, amount and status', () => {
    renderModal({
      mode: 'check-out',
      reservation: reservation({
        status: 'checked_in',
        due_amount: 0,
        payment_status: 'paid',
        payments: [
          { id: 1, reservation_id: 1, amount: 200, payment_method: 'cash', status: 'completed', created_at: '2026-10-10T00:00:00.000000Z', paid_at: '2026-10-10T00:00:00.000000Z' } as Payment,
          { id: 2, reservation_id: 1, amount: 130, payment_method: 'gcash', status: 'pending', created_at: '2026-10-11T00:00:00.000000Z' } as Payment,
        ],
      }),
    })

    expect(screen.getAllByText('₱200.00').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('₱130.00').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Cash/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/GCash/).length).toBeGreaterThanOrEqual(1)
  })

  it('shows a muted empty state when no payments are recorded', () => {
    renderModal({ mode: 'check-out', reservation: reservation({ status: 'checked_in', due_amount: 0, payment_status: 'unpaid' }) })

    expect(screen.getByText('No payments recorded.')).toBeInTheDocument()
  })

  it('shows reservation number, room, guest contact, room type and booking meta', () => {
    renderModal({
      mode: 'check-out',
      reservation: reservation({
        status: 'checked_in',
        due_amount: 0,
        payment_status: 'paid',
        price_per_night: 165,
        discount_percent: 0,
        tax_percent: 10,
        source: 'walk_in',
        special_requests: 'Late arrival',
        guest: { first_name: 'Maria', last_name: 'Garcia', phone: '+1-310-555-0182', email: 'maria.garcia@email.com' } as Guest,
        room: { room_number: '205', floor: 2, room_type: { name: 'Deluxe Room' } } as Room,
      }),
    })

    expect(screen.getByText(/BK-2026-0001/)).toBeInTheDocument()
    expect(screen.getByText(/Room 205/)).toBeInTheDocument()
    expect(screen.getByText('Maria Garcia')).toBeInTheDocument()
    expect(screen.getByText('+1-310-555-0182')).toBeInTheDocument()
    expect(screen.getByText('maria.garcia@email.com')).toBeInTheDocument()
    expect(screen.getByText('Deluxe Room')).toBeInTheDocument()
    expect(screen.getByText('Walk-in')).toBeInTheDocument()
    expect(screen.getByText('Late arrival')).toBeInTheDocument()
    expect(screen.getAllByText('Paid in full').length).toBeGreaterThanOrEqual(1)
  })

  it('shows the structured panel sections', () => {
    renderModal({ mode: 'check-out', reservation: reservation({ status: 'checked_in', due_amount: 0, payment_status: 'paid' }) })

    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(screen.getByText('Stay')).toBeInTheDocument()
    expect(screen.getByText('Billing')).toBeInTheDocument()
    expect(screen.getByText('Payments')).toBeInTheDocument()
    expect(screen.getByText('Actual Departure')).toBeInTheDocument()
  })

  it('forwards the actual departure date to the payment modal on check-out', () => {
    mockPreview.data = {
      actual_check_out: '2026-10-12',
      total_nights: 2,
      subtotal: 300,
      discount_amount: 0,
      tax_percent: 0,
      tax_amount: 0,
      total_amount: 830,
      paid_amount: 330,
      due_amount: 500,
      overlap: false,
      late_checkout_fee: 500,
      late_checkout_applies: true,
    }
    renderModal({
      mode: 'check-out',
      reservation: reservation({
        status: 'checked_in',
        check_out: '2026-10-12',
        total_amount: 330,
        paid_amount: 330,
        due_amount: 0,
      }),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Collect & Check Out' }))
    expect(screen.getByRole('button', { name: 'stub-Record & Check Out' })).toBeInTheDocument()
    expect(mockPaymentModalProps.actualCheckOut).toBe('2026-10-12')
  })

  it('shows the late check-out fee notice for a same-day late departure', () => {
    mockPreview.data = {
      actual_check_out: '2026-10-12',
      total_nights: 2,
      subtotal: 300,
      discount_amount: 0,
      tax_percent: 0,
      tax_amount: 0,
      total_amount: 830,
      paid_amount: 330,
      due_amount: 500,
      overlap: false,
      late_checkout_fee: 500,
      late_checkout_applies: true,
    }
    renderModal({
      mode: 'check-out',
      reservation: reservation({
        status: 'checked_in',
        check_out: '2026-10-12',
        total_amount: 330,
        paid_amount: 330,
        due_amount: 0,
      }),
    })

    expect(screen.getByText('Late check-out fee: ₱500.00')).toBeInTheDocument()
    expect(screen.getByText(/fee has been added to the total/i)).toBeInTheDocument()
    expect(screen.getByText('Outstanding balance: ₱500.00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collect & Check Out' })).toBeInTheDocument()
  })
})
