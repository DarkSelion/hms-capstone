import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { PaymentModal } from './PaymentModal'
import type { Guest, Payment, Reservation, Room } from '@/types'

const { mockMutate, mockCheckIn } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
  mockCheckIn: vi.fn(),
}))

vi.mock('@/hooks/useApi', () => ({
  useCreatePayment: () => ({ mutateAsync: mockMutate, isPending: false }),
  useCheckIn: () => ({ mutateAsync: mockCheckIn, isPending: false }),
}))

type OnSuccess = (payment: Payment) => void
type OnClose = () => void

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

function renderModal(overrides: {
  reservation?: Reservation | null
  reservations?: Reservation[]
  showCheckInOption?: boolean
  onSuccess?: ReturnType<typeof vi.fn<OnSuccess>>
  onClose?: ReturnType<typeof vi.fn<OnClose>>
} = {}) {
  const onSuccess = overrides.onSuccess ?? vi.fn<OnSuccess>()
  const onClose = overrides.onClose ?? vi.fn<OnClose>()
  render(
    <PaymentModal
      isOpen
      onClose={onClose}
      reservation={overrides.reservation === undefined ? reservation() : overrides.reservation}
      reservations={overrides.reservations}
      showCheckInOption={overrides.showCheckInOption}
      onSuccess={onSuccess}
    />,
  )
  return { onSuccess, onClose }
}

const amountInput = () => screen.getByLabelText('Amount to collect') as HTMLInputElement
const tenderedInput = () => screen.getByLabelText('Cash tendered') as HTMLInputElement

describe('PaymentModal', () => {
  beforeEach(() => {
    mockMutate.mockReset()
    mockCheckIn.mockReset()
  })

  it('shows the reservation summary with the balance due', () => {
    renderModal()

    expect(screen.getByText('Balance Due')).toBeInTheDocument()
    expect(amountInput()).toBeInTheDocument()
    expect(tenderedInput()).toBeInTheDocument()
    expect(amountInput()).toHaveValue(330)
  })

  it('computes change due from the amount tendered', () => {
    renderModal()

    fireEvent.change(amountInput(), { target: { value: '275' } })
    fireEvent.change(tenderedInput(), { target: { value: '500' } })

    expect(screen.getByText('Change due')).toBeInTheDocument()
    expect(screen.getByText('₱225.00')).toBeInTheDocument()
  })

  it('shows the remaining amount when tendered is less than the amount', () => {
    renderModal()

    fireEvent.change(amountInput(), { target: { value: '275' } })
    fireEvent.change(tenderedInput(), { target: { value: '200' } })

    expect(screen.getByText('Guest still owes')).toBeInTheDocument()
    expect(screen.getByText('₱75.00')).toBeInTheDocument()
  })

  it('records a full cash payment when the amount equals the balance', async () => {
    const { onSuccess, onClose } = renderModal()
    mockMutate.mockResolvedValue({ id: 50, amount: 330, status: 'completed' })

    fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }))

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        reservation_id: 1,
        amount: 330,
        payment_method: 'cash',
        payment_type: 'full',
        status: 'completed',
      }),
    )
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('records a partial cash payment via the Half quick button', () => {
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'Half' }))
    expect(amountInput()).toHaveValue(165)

    mockMutate.mockResolvedValue({ id: 51, amount: 165, status: 'completed' })
    fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }))

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 165, payment_method: 'cash', payment_type: 'partial', status: 'completed' }),
    )
  })

  it('restores the full amount via the Full quick button', () => {
    renderModal()

    fireEvent.change(amountInput(), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Full' }))
    expect(amountInput()).toHaveValue(330)
  })

  it('hides the Half quick button when hideHalf is set', () => {
    render(
      <PaymentModal
        isOpen
        onClose={vi.fn()}
        reservation={reservation()}
        hideHalf
      />,
    )

    expect(screen.queryByRole('button', { name: 'Half' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Full' })).toBeInTheDocument()
  })

  it('records a cash payment with a reference', () => {
    renderModal()

    fireEvent.change(screen.getByLabelText('Reference / Transaction ID'), { target: { value: 'RCT-12345' } })
    mockMutate.mockResolvedValue({ id: 52, amount: 330, status: 'completed' })
    fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }))

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 330,
        payment_method: 'cash',
        payment_type: 'full',
        status: 'completed',
        reference_number: 'RCT-12345',
      }),
    )
  })

  it('sends the actual departure date to the payments API when provided', () => {
    render(
      <PaymentModal
        isOpen
        onClose={vi.fn()}
        reservation={reservation({ due_amount: 500 })}
        actualCheckOut="2026-10-14"
      />,
    )

    mockMutate.mockResolvedValue({ id: 53, amount: 500, status: 'completed' })
    fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }))

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        reservation_id: 1,
        amount: 500,
        actual_check_out: '2026-10-14',
      }),
    )
  })

  it('surfaces server errors instead of closing', async () => {
    const { onClose } = renderModal()
    mockMutate.mockRejectedValue(new Error('The amount field is required.'))

    fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }))

    await waitFor(() => expect(screen.getByText('The amount field is required.')).toBeInTheDocument())
    expect(onClose).not.toHaveBeenCalled()
  })

  it('clamps the amount to the outstanding balance when over-typed', () => {
    renderModal()

    fireEvent.change(amountInput(), { target: { value: '500' } })
    expect(amountInput()).toHaveValue(330)
  })

  it('clamps negative amounts to zero', () => {
    renderModal()

    fireEvent.change(amountInput(), { target: { value: '-50' } })
    expect(amountInput()).toHaveValue(0)
  })

  it('disables submit when the amount is zero', () => {
    renderModal()

    fireEvent.change(amountInput(), { target: { value: '0' } })
    expect(screen.getByRole('button', { name: 'Record Payment' })).toBeDisabled()
  })

  it('clears the previous error when reopened', async () => {
    const onClose = vi.fn<OnClose>()
    const onSuccess = vi.fn<OnSuccess>()
    const result = render(
      <PaymentModal isOpen onClose={onClose} reservation={reservation()} onSuccess={onSuccess} />,
    )
    mockMutate.mockRejectedValue(new Error('The amount field is required.'))

    fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }))
    await waitFor(() => expect(screen.getByText('The amount field is required.')).toBeInTheDocument())

    result.rerender(<PaymentModal isOpen={false} onClose={onClose} reservation={reservation()} onSuccess={onSuccess} />)
    result.rerender(<PaymentModal isOpen onClose={onClose} reservation={reservation()} onSuccess={onSuccess} />)

    expect(screen.queryByText('The amount field is required.')).not.toBeInTheDocument()
  })

  it('resets amount and tendered to the selected reservation balance in the picker', () => {
    renderModal({
      reservation: null,
      reservations: [reservation({ id: 2, due_amount: 100 }), reservation({ id: 3, due_amount: 250 })],
    })

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '3' } })
    expect(amountInput()).toHaveValue(250)
  })

  it('shows a reservation picker when no reservation is preset and disables submit until one is chosen', () => {
    renderModal({ reservation: null, reservations: [reservation()] })

    const submit = screen.getByRole('button', { name: 'Record Payment' }) as HTMLButtonElement
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } })
    expect(screen.getByText('Balance Due')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Record Payment' })).toBeEnabled()
  })

  it('does not check in when the option is not enabled', async () => {
    const { onSuccess, onClose } = renderModal()
    mockMutate.mockResolvedValue({ id: 50, amount: 330, status: 'completed' })

    fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }))

    expect(mockCheckIn).not.toHaveBeenCalled()
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('shows the check-in option only when showCheckInOption and a confirmed reservation are present', () => {
    renderModal({ showCheckInOption: true })
    expect(screen.getByText('Check in after payment')).toBeInTheDocument()

    const { container } = render(
      <PaymentModal
        isOpen
        onClose={vi.fn()}
        reservation={reservation({ status: 'checked_in' })}
        showCheckInOption
      />,
    )
    expect(within(container).queryByText('Check in after payment')).not.toBeInTheDocument()
  })

  it('checks in after a completed payment when the box is ticked', async () => {
    renderModal({ showCheckInOption: true })
    mockMutate.mockResolvedValue({ id: 50, amount: 330, status: 'completed' })
    mockCheckIn.mockResolvedValue({})

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }))

    await waitFor(() => expect(mockCheckIn).toHaveBeenCalledWith(1))
  })
})
