import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDateDisplay } from '@/lib/format'
import { Clock, BedDouble, CalendarDays, CreditCard, UserRound, Bell } from 'lucide-react'
import type { Reservation } from '@/types'

interface LateArrivalModalProps {
  isOpen: boolean
  onClose: () => void
  reservation: Reservation | null
  defaultDeadline?: string
  isLoading?: boolean
  onConfirm: (deadline: string, notes: string) => void
}

export function LateArrivalModal({
  isOpen,
  onClose,
  reservation,
  defaultDeadline,
  isLoading,
  onConfirm,
}: LateArrivalModalProps) {
  const [deadline, setDeadline] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (isOpen) {
      setDeadline(defaultDeadline || '')
      setNotes('')
    }
  }, [isOpen, defaultDeadline])

  function handleConfirm() {
    if (!deadline) return
    onConfirm(deadline, notes)
  }

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
          <Button variant="primary" onClick={handleConfirm} disabled={isLoading || !deadline}>
            {isLoading ? 'Processing...' : 'Record Late Arrival'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
          <Bell className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-foreground">Record Late Arrival</h3>
        <p className="mt-1 max-w-sm text-sm text-muted">
          The guest has notified they will arrive late. Set a hold deadline to keep the room reserved.
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

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="la-deadline" className="mb-1 block text-sm font-medium text-foreground">
            Hold Deadline <span className="text-danger">*</span>
          </label>
          <input
            id="la-deadline"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground ring-offset-card focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          />
          <p className="mt-1 text-xs text-muted">
            Room will be released if the guest does not arrive by this date/time.
          </p>
        </div>
        <div>
          <label htmlFor="la-notes" className="mb-1 block text-sm font-medium text-foreground">
            Notes
          </label>
          <textarea
            id="la-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Guest called, arriving tomorrow morning"
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground ring-offset-card placeholder:text-muted focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          />
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <p className="text-sm text-muted">
          The room stays reserved until the deadline. If the guest does not arrive, it will be automatically released.
        </p>
      </div>
    </Modal>
  )
}
