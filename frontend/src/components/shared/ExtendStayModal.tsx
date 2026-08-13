import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatCurrency, formatDateDisplay } from '@/lib/format'
import { AlertCircle, CalendarPlus } from 'lucide-react'
import type { Reservation } from '@/types'

interface ExtendStayModalProps {
  isOpen: boolean
  onClose: () => void
  reservation: Reservation | null
  isLoading?: boolean
  error?: string | null
  onConfirm: (newCheckOut: string) => void
}

function parseDateParts(dateStr: string): [number, number, number] {
  const [y, m, d] = dateStr.split('-').map(Number)
  return [y, m, d]
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = parseDateParts(dateStr)
  return toDateStr(y, m, d + days)
}

function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = parseDateParts(from)
  const [y2, m2, d2] = parseDateParts(to)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

export function ExtendStayModal({
  isOpen,
  onClose,
  reservation,
  isLoading,
  error,
  onConfirm,
}: ExtendStayModalProps) {
  const currentCheckOut = reservation?.check_out ?? ''
  const minNewCheckOut = currentCheckOut ? addDays(currentCheckOut, 1) : ''
  const [newCheckOut, setNewCheckOut] = useState(minNewCheckOut)

  useEffect(() => {
    if (isOpen && minNewCheckOut) {
      setNewCheckOut(minNewCheckOut)
    }
  }, [isOpen, minNewCheckOut])

  const preview = useMemo(() => {
    if (!reservation || !newCheckOut || !currentCheckOut) return null

    const pricePerNight = reservation.price_per_night ?? 0
    const discountPercent = reservation.discount_percent ?? 0
    const taxPercent = reservation.tax_percent ?? 0

    const existingNights = daysBetween(reservation.check_in, currentCheckOut)
    const newNights = daysBetween(reservation.check_in, newCheckOut)
    const extraNights = Math.max(0, newNights - existingNights)

    const subtotal = pricePerNight * newNights
    const discount = subtotal * (discountPercent / 100)
    const tax = (subtotal - discount) * (taxPercent / 100)
    const newTotal = Math.round((subtotal - discount + tax) * 100) / 100
    const newDue = Math.max(0, Math.round((newTotal - (reservation.paid_amount ?? 0)) * 100) / 100)

    return {
      existingNights,
      newNights,
      extraNights,
      extraAmount: Math.round((newTotal - reservation.total_amount) * 100) / 100,
      newTotal,
      newDue,
    }
  }, [reservation, newCheckOut, currentCheckOut])

  const invalid = !newCheckOut || (currentCheckOut && newCheckOut <= currentCheckOut)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Extend Stay"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onConfirm(newCheckOut)} disabled={invalid || isLoading}>
            <CalendarPlus className="h-4 w-4" />
            {isLoading ? 'Processing...' : 'Extend Stay'}
          </Button>
        </>
      }
    >
      {reservation && (
        <div className="space-y-4">
          <dl className="divide-y divide-border rounded-lg border border-border bg-bg text-sm">
            <div className="flex items-center justify-between gap-4 px-3 py-2">
              <dt className="text-muted">Guest</dt>
              <dd className="font-medium text-foreground">
                {reservation.guest?.first_name} {reservation.guest?.last_name}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-3 py-2">
              <dt className="text-muted">Room</dt>
              <dd className="font-medium text-foreground">Room {reservation.room?.room_number ?? '-'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-3 py-2">
              <dt className="text-muted">Scheduled Check Out</dt>
              <dd className="font-medium text-foreground">{formatDateDisplay(currentCheckOut)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-3 py-2">
              <dt className="text-muted">Status</dt>
              <dd>
                <StatusBadge status={reservation.status} />
              </dd>
            </div>
          </dl>

          <div>
            <DatePicker
              label="New Check Out"
              value={newCheckOut}
              onChange={setNewCheckOut}
              min={minNewCheckOut}
              placeholder="Select new check-out date"
              error={invalid ? 'New check-out must be after the current check-out date.' : undefined}
            />
          </div>

          {preview && (
            <div className="rounded-lg border border-border bg-bg text-sm">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-muted">Nights</span>
                <span className="font-medium text-foreground">
                  {preview.existingNights} → {preview.newNights}
                  {preview.extraNights > 0 && (
                    <span className="ml-1 text-xs text-success">(+{preview.extraNights})</span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border px-3 py-2">
                <span className="text-muted">New Total</span>
                <span className="font-medium text-foreground">{formatCurrency(preview.newTotal)}</span>
              </div>
              {preview.extraAmount !== 0 && (
                <div className="flex items-center justify-between border-t border-border px-3 py-2">
                  <span className="text-muted">Extra Charge</span>
                  <span className="font-medium text-success">+{formatCurrency(preview.extraAmount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border px-3 py-2">
                <span className="text-muted">Amount Due After</span>
                <span className="font-semibold text-foreground">{formatCurrency(preview.newDue)}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2.5 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
