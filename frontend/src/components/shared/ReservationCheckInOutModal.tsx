import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PaymentModal } from '@/components/shared/PaymentModal'
import { useCheckoutPreview, useSettings } from '@/hooks/useApi'
import { formatCurrency, formatDateDisplay, formatCheckoutTime, formatTime } from '@/lib/format'
import { BOOKING_SOURCES } from '@/lib/constants'
import {
  AlertCircle, AlertTriangle, Wallet, LogIn, LogOut, UserRound, BedDouble, CalendarDays, Users, Globe,
  MessageSquare, ReceiptText, CalendarRange,
} from 'lucide-react'
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

const cardTiles = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  sky: 'bg-sky-500/10 text-sky-600',
}

function Card({ title, icon, tone = 'primary', children }: {
  title: string
  icon: ReactNode
  tone?: keyof typeof cardTiles
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cardTiles[tone]}`}>{icon}</div>
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      </div>
      {children}
    </section>
  )
}

function SummaryCell({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-bg p-3">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
        {icon}
        {label}
      </p>
      {children}
    </div>
  )
}

function BillRow({ label, value, valueClass }: { label: string; value: ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className={`font-medium text-foreground ${valueClass ?? ''}`}>{value}</span>
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

  const todayStr = toLocalDateStr(new Date())
  const bookedCheckOut = reservation?.check_out ?? ''
  const defaultDeparture =
    !isCheckIn && bookedCheckOut ? (todayStr > bookedCheckOut ? todayStr : bookedCheckOut) : ''
  const actualDeparture = departureDate || defaultDeparture

  const preview = useCheckoutPreview(
    !isCheckIn && reservation ? reservation.id : 0,
    actualDeparture || undefined,
  )

  const { data: settings } = useSettings()
  const checkoutTimeSetting = (settings as Record<string, unknown> | undefined)?.['check_out_time']
  const checkoutTimeLabel = formatCheckoutTime(
    typeof checkoutTimeSetting === 'string' ? checkoutTimeSetting : '11:00',
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

  const departureChanged = !isCheckIn && !!actualDeparture && actualDeparture !== (reservation?.check_out ?? '')
  const actualCheckOut = !isCheckIn && actualDeparture ? actualDeparture : undefined
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

  const previewPending = !isCheckIn && preview.isLoading && !preview.data

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
    if (previewPending) return
    if (isRetry) onConfirmAfterPayment?.(undefined, actualCheckOut, projectedTotal)
    else if (requiresPayment) setShowPaymentModal(true)
    else onConfirm(actualCheckOut)
  }

  const actualCheckoutStamp = effective.checked_out_at ?? new Date().toISOString()

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
          <Button variant="primary" onClick={handleConfirm} disabled={isLoading || previewPending}>
            {isLoading ? 'Processing...' : previewPending ? 'Calculating…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {isCheckIn ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-foreground">
              {isCheckIn ? 'Check In Guest' : 'Check Out Guest'}
            </h3>
            <p className="truncate text-sm text-muted">
              {effective.reservation_number} · Room {roomNumber}
              {roomTypeName ? ` · ${roomTypeName}` : ''}
            </p>
            {previewPending ? (
              <p className="mt-0.5 text-sm text-muted">Calculating balance…</p>
            ) : (
              effective.payment_status !== 'unpaid' && (
                <p className="mt-0.5 text-sm font-medium text-foreground">{paymentLabel}</p>
              )
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={effective.status} />
            {!previewPending && <StatusBadge status={effective.payment_status} />}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2.5 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <span>{error.message}</span>
          </div>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SummaryCell label="Guest" icon={<UserRound className="h-3.5 w-3.5" />}>
              <p className="text-sm font-semibold text-foreground">{guestName}</p>
              {effective.guest?.phone && (
                <p className="mt-0.5 truncate text-xs text-muted">{effective.guest.phone}</p>
              )}
              {effective.guest?.email && (
                <p className="truncate text-xs text-muted">{effective.guest.email}</p>
              )}
            </SummaryCell>

            <SummaryCell label="Room" icon={<BedDouble className="h-3.5 w-3.5" />}>
              <p className="text-sm font-semibold text-foreground">{roomNumber}</p>
              {roomTypeName && <p className="mt-0.5 text-xs text-muted">{roomTypeName}</p>}
              {floor != null && <p className="text-xs text-muted">Floor {floor}</p>}
            </SummaryCell>

            <SummaryCell label="Stay" icon={<CalendarDays className="h-3.5 w-3.5" />}>
              <p className="text-sm font-semibold text-foreground">
                {formatDateDisplay(effective.check_in)} → {formatDateDisplay(effective.check_out)}
              </p>
              <div className="mt-1.5 space-y-1 text-xs text-muted">
                <div className="flex items-center justify-between gap-2">
                  <span>Nights</span>
                  <span className="tabular-nums font-medium text-foreground">{breakdown.nights}</span>
                </div>
                {!isCheckIn ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span>Check-out Time</span>
                      <span className="tabular-nums font-medium text-foreground">
                        {formatTime(actualCheckoutStamp)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Checked-out At</span>
                      <span className="tabular-nums font-medium text-foreground">
                        {formatDateDisplay(actualCheckoutStamp)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span>Check-out Time</span>
                    <span className="tabular-nums font-medium text-foreground">{checkoutTimeLabel}</span>
                  </div>
                )}
              </div>
            </SummaryCell>

            <SummaryCell label="Guests" icon={<Users className="h-3.5 w-3.5" />}>
              <p className="text-sm font-semibold text-foreground">
                {effective.adults} Adult{effective.adults === 1 ? '' : 's'}
                {effective.children > 0 ? `, ${effective.children} Child${effective.children === 1 ? '' : 'ren'}` : ''}
              </p>
              {sourceLabel && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                  <Globe className="h-3 w-3" />
                  {sourceLabel}
                </p>
              )}
            </SummaryCell>
          </div>

          {effective.special_requests && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-bg p-3">
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted">Special Requests</p>
                <p className="text-sm text-foreground">{effective.special_requests}</p>
              </div>
            </div>
          )}
        </section>

        <Card title="Billing" icon={<Wallet className="h-4 w-4" />} tone="success">
          <div className="space-y-2 text-sm">
            <BillRow
              label={`${breakdown.nights} night${breakdown.nights === 1 ? '' : 's'} × ${formatCurrency(rate)}`}
              value={formatCurrency(breakdown.subtotal)}
            />
            {breakdown.discount > 0 && (
              <BillRow
                label={`Discount (${effective.discount_percent ?? 0}%)`}
                value={`-${formatCurrency(breakdown.discount)}`}
                valueClass="text-success"
              />
            )}
            <BillRow
              label={`Tax (${Math.round(breakdown.taxPercent)}%)`}
              value={formatCurrency(breakdown.tax)}
            />
            <div className="my-1 border-t border-border" />
            <BillRow label="Total" value={formatCurrency(breakdown.total)} />
            <BillRow label="Paid" value={formatCurrency(breakdown.paid)} valueClass="text-success" />
            <div className="flex items-center justify-between rounded-xl bg-primary/5 px-3 py-2.5">
              <span className="text-sm font-semibold text-primary-dark">Balance Due</span>
              <span className="text-lg font-bold text-primary-dark">{formatCurrency(breakdown.due)}</span>
            </div>
          </div>
        </Card>

        <Card title="Payments" icon={<ReceiptText className="h-4 w-4" />} tone="sky">
          {payments.length > 0 ? (
            <ul className="space-y-2">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-bg px-3 py-2 text-sm"
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
        </Card>

        {!isCheckIn && (
          <Card title="Actual Departure" icon={<CalendarRange className="h-4 w-4" />} tone="warning">
            <DatePicker
              label="Actual departure"
              value={actualDeparture}
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
          </Card>
        )}

        {preview.data?.late_checkout_applies && (
          <div className="flex items-start gap-2.5 rounded-xl border border-warning/20 bg-warning/10 px-3 py-2.5">
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
          <div className="flex items-start gap-2.5 rounded-xl border border-warning/20 bg-warning/10 px-3 py-2.5">
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
