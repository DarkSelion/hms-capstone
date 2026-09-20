import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatCurrency, formatDateDisplay } from '@/lib/format'
import { useExtendPreview } from '@/hooks/useApi'
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

  const previewQuery = useExtendPreview(reservation?.id ?? 0, newCheckOut || undefined)
  const preview = previewQuery.data

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
          <Button variant="primary" onClick={() => onConfirm(newCheckOut)} disabled={invalid || isLoading || previewQuery.isLoading}>
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

          {previewQuery.isLoading && newCheckOut && (
            <p className="text-[13px] text-muted">Calculating preview…</p>
          )}

          {preview && (
            <div className="rounded-lg border border-border bg-bg text-sm">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-muted">Nights</span>
                <span className="font-medium text-foreground">
                  {preview.current_nights} → {preview.projected_nights}
                  {preview.extra_nights > 0 && (
                    <span className="ml-1 text-xs text-success">(+{preview.extra_nights})</span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border px-3 py-2">
                <span className="text-muted">New Total</span>
                <span className="font-medium text-foreground">{formatCurrency(preview.projected_total)}</span>
              </div>
              {preview.extra_amount !== 0 && (
                <div className="flex items-center justify-between border-t border-border px-3 py-2">
                  <span className="text-muted">Extra Charge</span>
                  <span className="font-medium text-success">+{formatCurrency(preview.extra_amount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border px-3 py-2">
                <span className="text-muted">Amount Due After</span>
                <span className="font-semibold text-foreground">{formatCurrency(preview.projected_due)}</span>
              </div>
            </div>
          )}

          {preview?.overlap && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-2.5 text-sm text-amber-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Another reservation overlaps this room during the extended period.</span>
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
