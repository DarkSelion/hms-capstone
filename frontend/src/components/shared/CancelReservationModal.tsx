import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDateDisplay } from '@/lib/format'
import { AlertTriangle, BedDouble, CalendarDays, CreditCard, UserRound, XCircle } from 'lucide-react'
import type { Reservation } from '@/types'

interface CancelReservationModalProps {
  isOpen: boolean
  onClose: () => void
  reservation: Reservation | null
  isLoading?: boolean
  onConfirm: () => void
}

export function CancelReservationModal({
  isOpen,
  onClose,
  reservation,
  isLoading,
  onConfirm,
}: CancelReservationModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Cancel Reservation'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
          <XCircle className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-foreground">Cancel Reservation</h3>
        <p className="mt-1 max-w-sm text-sm text-muted">
          This will cancel the reservation and release the room for other guests.
        </p>
      </div>

      {reservation && (
        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-bg p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                <UserRound className="h-3.5 w-3.5" />
                Guest
              </p>
              <p className="text-sm font-semibold text-foreground">
                {reservation.guest?.first_name} {reservation.guest?.last_name}
              </p>
              {reservation.guest?.email && (
                <p className="mt-0.5 truncate text-xs text-muted">{reservation.guest.email}</p>
              )}
            </div>
            <div className="rounded-xl bg-bg p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                <BedDouble className="h-3.5 w-3.5" />
                Room
              </p>
              <p className="text-sm font-semibold text-foreground">
                {reservation.room?.room_number ?? '-'}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {reservation.room?.room_type?.name}
              </p>
            </div>
            <div className="rounded-xl bg-bg p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                <CalendarDays className="h-3.5 w-3.5" />
                Stay
              </p>
              <p className="text-sm font-semibold text-foreground">
                {formatDateDisplay(reservation.check_in)} → {formatDateDisplay(reservation.check_out)}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {reservation.adults} Adult{reservation.adults !== 1 ? 's' : ''}
                {reservation.children > 0 ? `, ${reservation.children} Child${reservation.children !== 1 ? 'ren' : ''}` : ''}
              </p>
            </div>
            <div className="rounded-xl bg-bg p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                <CreditCard className="h-3.5 w-3.5" />
                Total
              </p>
              <p className="text-sm font-semibold text-foreground">
                {formatCurrency(reservation.total_amount)}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {reservation.payment_status === 'paid' ? 'Fully paid' : `${formatCurrency(reservation.due_amount ?? 0)} due`}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/5 px-3.5 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <p className="text-sm text-muted">
          The room will be released and the reservation marked as cancelled. Refunds, if applicable, are processed separately.
        </p>
      </div>
    </Modal>
  )
}
