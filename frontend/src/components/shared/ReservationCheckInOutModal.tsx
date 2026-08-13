import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PaymentModal } from '@/components/shared/PaymentModal'
import { useCheckoutPreview, useSettings } from '@/hooks/useApi'
import { formatCurrency, formatDateDisplay, formatCheckoutTime } from '@/lib/format'
import { BOOKING_SOURCES } from '@/lib/constants'
import { AlertCircle, AlertTriangle, Wallet, Phone, Mail } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Payment, Reservation } from '@/types'

interface ReservationCheckInOutModalProps {
  mode: 'check-in' | 'check-out'
  reservation: Reservation | null
  isOpen: boolean
  isLoading?: boolean
  error?: { message: string; paymentRecorded: boolean } | null
  onClose: () => void
  onConfirm: (actualCheckOut?: string) => void
  onConfirmAfterPayment?: (payment?: Payment, actualCheckOut?: string, projectedTotal?: number) => void
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

function methodLabel(method: string | undefined): string {
  if (method === 'gcash') return 'GCash'
  if (method === 'online') return 'Online'
  return 'Cash'
}

function nightsBetween(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00`)
  const b = new Date(`${end}T00:00:00`)
  const diff = (b.getTime() - a.getTime()) / 86400000
  return Number.isFinite(diff) && diff > 0 ? Math.round(diff) : 0
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border">
      <header className="border-b border-border bg-bg px-4 py-2.5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h4>
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  )
}

function InfoRow({ label, value, valueClass }: { label: string; value: ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className={`text-right font-medium text-foreground ${valueClass ?? ''}`}>{value}</dd>
    </div>
  )
}

export function ReservationCheckInOutModal({
  mode,
  reservation,
  isOpen,
  isLoading,
  error,
  onClose,
  onConfirm,
  onConfirmAfterPayment,
}: ReservationCheckInOutModalProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [departureDate, setDepartureDate] = useState('')

  useEffect(() => {
    if (!isOpen) setShowPaymentModal(false)
  }, [isOpen])

  const isCheckIn = mode === 'check-in'

  useEffect(() => {
    if (isOpen && !isCheckIn && reservation) {
      const booked = reservation.check_out
      const today = toLocalDateStr(new Date())
      setDepartureDate(booked && today > booked ? today : (booked ?? ''))
    }
  }, [isOpen, isCheckIn, reservation])

  const preview = useCheckoutPreview(
    !isCheckIn && reservation ? reservation.id : 0,
    departureDate || undefined,
  )

  const { data: settings } = useSettings()
  const checkoutTimeSetting = (settings as Record<string, unknown> | undefined)?.['check_out_time']
  const checkoutTimeLabel = formatCheckoutTime(
    typeof checkoutTimeSetting === 'string' ? checkoutTimeSetting : '12:00',
  )

  const effective: Reservation | null =
    !isCheckIn && reservation
      ? preview.data
        ? {
            ...reservation,
            check_out: preview.data.actual_check_out,
            total_amount: preview.data.total_amount,
            paid_amount: preview.data.paid_amount,
            due_amount: preview.data.due_amount,
            payment_status: preview.data.due_amount <= 0 ? 'paid' : 'partial',
          }
        : reservation
      : reservation

  const departureChanged = !isCheckIn && !!departureDate && departureDate !== (reservation?.check_out ?? '')
  const actualCheckOut = !isCheckIn && departureDate ? departureDate : undefined
  const projectedTotal = !isCheckIn ? preview.data?.total_amount : undefined

  if (!effective) return null

  const guestName = `${effective.guest?.first_name ?? ''} ${effective.guest?.last_name ?? ''}`.trim() || '—'
  const roomNumber = effective.room?.room_number ?? '-'
  const roomTypeName = effective.room?.room_type?.name
  const floor = effective.room?.floor
  const hasBalance = effective.due_amount > 0
  const isRetry = error?.paymentRecorded === true
  const hasPayment =
    (effective.payments?.filter((p) => p.status === 'completed' || p.status === 'pending').length ?? 0) > 0
  const requiresPayment = isCheckIn
    ? hasBalance && !hasPayment && !isRetry
    : hasBalance && !isRetry

  const verb = isCheckIn ? 'Check In' : 'Check Out'
  const confirmLabel = isRetry ? `Retry ${verb}` : requiresPayment ? `Collect & ${verb}` : verb

  const lastPaymentMethod = effective.payments?.[0]?.payment_method
  const paymentLabel =
    effective.payment_status === 'paid'
      ? `Paid in full${lastPaymentMethod ? ` · ${methodLabel(lastPaymentMethod)}` : ''}`
      : effective.payment_status === 'partial'
        ? `Partial — ${formatCurrency(effective.paid_amount)} of ${formatCurrency(effective.total_amount)} paid`
        : effective.payment_status === 'unpaid'
          ? 'Unpaid'
          : (effective.payment_status ?? '-')

  const rate = effective.price_per_night ?? 0
  const fallbackNights = nightsBetween(effective.check_in, effective.check_out)
  const fallbackSubtotal = fallbackNights * rate
  const fallbackDiscount = fallbackSubtotal * ((effective.discount_percent ?? 0) / 100)
  const fallbackTax = (fallbackSubtotal - fallbackDiscount) * ((effective.tax_percent ?? 0) / 100)

  const breakdown = preview.data
    ? {
        nights: preview.data.total_nights,
        subtotal: preview.data.subtotal,
        discount: preview.data.discount_amount,
        taxPercent: preview.data.tax_percent,
        tax: preview.data.tax_amount,
        total: preview.data.total_amount,
        paid: preview.data.paid_amount,
        due: preview.data.due_amount,
      }
    : {
        nights: fallbackNights,
        subtotal: fallbackSubtotal,
        discount: fallbackDiscount,
        taxPercent: effective.tax_percent ?? 0,
        tax: fallbackTax,
        total: effective.total_amount,
        paid: effective.paid_amount,
        due: effective.due_amount,
      }

  const sourceLabel = effective.source
    ? BOOKING_SOURCES.find((s) => s.value === effective.source)?.label ?? effective.source
    : null

  const payments = effective.payments ?? []

  const handleConfirm = () => {
    if (isRetry) onConfirmAfterPayment?.(undefined, actualCheckOut, projectedTotal)
    else if (requiresPayment) setShowPaymentModal(true)
    else onConfirm(actualCheckOut)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Processing...' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {isCheckIn ? 'Check In Guest' : 'Check Out Guest'}
            </h3>
            <p className="mt-0.5 text-sm text-muted">
              {effective.reservation_number} · Room {roomNumber}
            </p>
            {effective.payment_status !== 'unpaid' && (
              <p className="mt-1 text-sm font-medium text-foreground">{paymentLabel}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={effective.status} />
            <StatusBadge status={effective.payment_status} />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2.5 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <span>{error.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Section title="Guest">
            <dl>
              <InfoRow label="Name" value={guestName} />
              <div className="flex items-start justify-between gap-4 py-1 text-sm">
                <dt className="flex shrink-0 items-center gap-1.5 text-muted">
                  <Phone className="h-3.5 w-3.5" /> Phone
                </dt>
                <dd className="text-right font-medium text-foreground">{effective.guest?.phone || '—'}</dd>
              </div>
              <div className="flex items-start justify-between gap-4 py-1 text-sm">
                <dt className="flex shrink-0 items-center gap-1.5 text-muted">
                  <Mail className="h-3.5 w-3.5" /> Email
                </dt>
                <dd className="max-w-[60%] truncate text-right font-medium text-foreground">
                  {effective.guest?.email || '—'}
                </dd>
              </div>
            </dl>
          </Section>

          <Section title="Stay">
            <dl>
              <InfoRow label="Check In" value={formatDateDisplay(effective.check_in)} />
              <InfoRow label="Check Out" value={formatDateDisplay(effective.check_out)} />
              <InfoRow label="Check-out Time" value={checkoutTimeLabel} />
              <InfoRow label="Nights" value={breakdown.nights} />
              <InfoRow
                label="Guests"
                value={`${effective.adults} Adult${effective.adults === 1 ? '' : 's'}${
                  effective.children > 0 ? `, ${effective.children} Child${effective.children === 1 ? '' : 'ren'}`
                    : ''
                }`}
              />
              <InfoRow label="Room Type" value={roomTypeName || '—'} />
              <InfoRow label="Floor" value={floor != null ? String(floor) : '—'} />
            </dl>
          </Section>
        </div>

        <Section title="Billing">
          <dl>
            <InfoRow
              label={`${breakdown.nights} night${breakdown.nights === 1 ? '' : 's'} × ${formatCurrency(rate)}`}
              value={formatCurrency(breakdown.subtotal)}
            />
            {breakdown.discount > 0 && (
              <InfoRow
                label={`Discount (${effective.discount_percent ?? 0}%)`}
                value={`-${formatCurrency(breakdown.discount)}`}
                valueClass="text-success"
              />
            )}
            <InfoRow
              label={`Tax (${Math.round(breakdown.taxPercent)}%)`}
              value={formatCurrency(breakdown.tax)}
            />
            <div className="my-1 border-t border-border" />
            <InfoRow label="Total" value={formatCurrency(breakdown.total)} />
            <InfoRow label="Paid" value={formatCurrency(breakdown.paid)} valueClass="text-success" />
            <InfoRow
              label="Balance Due"
              value={formatCurrency(breakdown.due)}
              valueClass={breakdown.due > 0 ? 'font-semibold text-danger' : 'font-semibold text-success'}
            />
          </dl>
          {sourceLabel && (
            <dl className="mt-1 border-t border-border pt-1">
              <InfoRow label="Source" value={sourceLabel} />
            </dl>
          )}
          {effective.special_requests && (
            <div className="mt-2 rounded-md bg-bg px-3 py-2 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Special Requests</p>
              <p className="mt-1 text-foreground">{effective.special_requests}</p>
            </div>
          )}
        </Section>

        <Section title="Payments">
          {payments.length > 0 ? (
            <ul className="space-y-2">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{formatCurrency(p.amount)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <span className="text-xs text-muted">
                    {methodLabel(p.payment_method)}
                    {p.paid_at ? ` · ${formatDateDisplay(p.paid_at)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No payments recorded.</p>
          )}
        </Section>

        {!isCheckIn && (
          <Section title="Actual Departure">
            <DatePicker
              label="Actual departure"
              value={departureDate}
              onChange={setDepartureDate}
              min={effective.check_in}
              placeholder="Select departure date"
            />

            {departureChanged &&
              (preview.isLoading ? (
                <p className="mt-2 text-[13px] text-muted">Recalculating…</p>
              ) : preview.data ? (
                <>
                  <dl className="mt-2 space-y-1 text-[13px] text-foreground">
                    <div className="flex items-center justify-between gap-4">
                      <dt>Nights</dt>
                      <dd className="tabular-nums">{preview.data.total_nights}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt>Room charge</dt>
                      <dd className="tabular-nums">{formatCurrency(preview.data.total_amount)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt>Already paid</dt>
                      <dd className="tabular-nums">{formatCurrency(preview.data.paid_amount)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 font-medium">
                      <dt>To collect at check-out</dt>
                      <dd className="tabular-nums">{formatCurrency(preview.data.due_amount)}</dd>
                    </div>
                  </dl>
                  {preview.data.overlap && (
                    <p className="mt-2 flex items-start gap-1.5 text-[13px] text-warning">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Another reservation overlaps this room during the extended stay. Confirm with the arriving guest before checking out.
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-[13px] text-muted">Could not preview the new total.</p>
              ))}
          </Section>
        )}

        {preview.data?.late_checkout_applies && (
          <div className="flex items-start gap-2.5 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium text-warning">
                Late check-out fee: {formatCurrency(preview.data.late_checkout_fee)}
              </p>
              <p className="mt-0.5 text-[13px] text-warning">
                The guest is departing after the check-out time. The fee has been added to the total.
              </p>
            </div>
          </div>
        )}

        {hasBalance && (
          <div className="flex items-start gap-2.5 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium text-warning">
                Outstanding balance: {formatCurrency(effective.due_amount)}
              </p>
              {requiresPayment ? (
                <p className="text-[13px] text-warning">
                  A payment is required before {isCheckIn ? 'checking in' : 'checking out'}.
                </p>
              ) : (
                !isRetry && (
                  <p className="text-[13px] text-warning">
                    Guest will still be checked {isCheckIn ? 'in' : 'out'} — payments are optional.
                  </p>
                )
              )}
              {((isCheckIn && hasBalance && hasPayment && !isRetry) || (!isCheckIn && isRetry && hasBalance)) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-warning hover:bg-warning/10"
                  onClick={() => setShowPaymentModal(true)}
                >
                  <Wallet className="h-4 w-4" />
                  Collect {formatCurrency(effective.due_amount)}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        reservation={effective}
        confirmLabel={isCheckIn ? 'Record & Check In' : 'Record & Check Out'}
        hideHalf={!isCheckIn}
        actualCheckOut={actualCheckOut}
        onSuccess={(payment) => {
          setShowPaymentModal(false)
          onConfirmAfterPayment?.(payment, actualCheckOut, projectedTotal)
        }}
      />
    </Modal>
  )
}
