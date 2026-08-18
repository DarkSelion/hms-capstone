import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatCurrency, formatDateDisplay, formatDateTime } from '@/lib/format'
import { BOOKING_SOURCES } from '@/lib/constants'
import {
  BedDouble, CalendarDays, CreditCard, Pencil, CalendarPlus, UserRound, Globe, MessageSquare, LogIn, LogOut,
} from 'lucide-react'
import type { Reservation } from '@/types'

interface ReservationDetailModalProps {
  isOpen: boolean
  onClose: () => void
  reservation: Reservation | null
  onEdit: (reservation: Reservation) => void
  onExtendStay?: (reservation: Reservation) => void
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const inDate = new Date(checkIn?.split(/[\sT]/)[0])
  const outDate = new Date(checkOut?.split(/[\sT]/)[0])
  if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) return 0
  return Math.max(0, Math.round((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24)))
}

export function ReservationDetailModal({ isOpen, onClose, reservation, onEdit, onExtendStay }: ReservationDetailModalProps) {
  if (!reservation) return null

  const source = reservation.source
    ? BOOKING_SOURCES.find(s => s.value === reservation.source)?.label ?? reservation.source
    : null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Reservation ${reservation.reservation_number ?? ''}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {reservation.status === 'checked_in' && onExtendStay && (
            <Button variant="outline" onClick={() => onExtendStay(reservation)}>
              <CalendarPlus className="h-4 w-4" />
              Extend Stay
            </Button>
          )}
          <Button variant="primary" onClick={() => onEdit(reservation)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BedDouble className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {reservation.guest?.first_name} {reservation.guest?.last_name}
              </p>
              <p className="text-xs text-muted">Room {reservation.room?.room_number ?? '-'}</p>
            </div>
          </div>
          <StatusBadge status={reservation.status} />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
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
              {reservation.guest?.phone && (
                <p className="truncate text-xs text-muted">{reservation.guest.phone}</p>
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
                {reservation.room?.floor ? ` · Floor ${reservation.room.floor}` : ''}
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
                {nightsBetween(reservation.check_in, reservation.check_out)} night{nightsBetween(reservation.check_in, reservation.check_out) !== 1 ? 's' : ''}
              </p>
              {(reservation.checked_in_at || reservation.checked_out_at) && (
                <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                  {reservation.checked_in_at && (
                    <p className="flex items-center gap-1 text-xs text-muted">
                      <LogIn className="h-3 w-3 text-emerald-500" />
                      Checked in {formatDateTime(reservation.checked_in_at)}
                    </p>
                  )}
                  {reservation.checked_out_at && (
                    <p className="flex items-center gap-1 text-xs text-muted">
                      <LogOut className="h-3 w-3 text-amber-500" />
                      Checked out {formatDateTime(reservation.checked_out_at)}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="rounded-xl bg-bg p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                <UserRound className="h-3.5 w-3.5" />
                Guests
              </p>
              <p className="text-sm font-semibold text-foreground">
                {reservation.adults} Adult{reservation.adults !== 1 ? 's' : ''}
                {reservation.children > 0 ? `, ${reservation.children} Child${reservation.children !== 1 ? 'ren' : ''}` : ''}
              </p>
              {source && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                  <Globe className="h-3 w-3" />
                  {source}
                </p>
              )}
            </div>
          </div>

          {reservation.special_requests && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-bg p-3">
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted">Special Requests</p>
                <p className="text-sm text-foreground">{reservation.special_requests}</p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success">
                <CreditCard className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">Payment Summary</h4>
            </div>
            <StatusBadge status={reservation.payment_status} />
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Total</span>
              <span className="font-medium text-foreground">{formatCurrency(reservation.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Paid</span>
              <span className="font-medium text-success">{formatCurrency(reservation.paid_amount ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-primary/5 px-3 py-2.5">
              <span className="text-sm font-semibold text-primary-dark">Balance Due</span>
              <span className="text-lg font-bold text-primary-dark">{formatCurrency(reservation.due_amount ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}