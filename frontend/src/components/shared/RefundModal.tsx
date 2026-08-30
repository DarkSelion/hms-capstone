import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api'
import { formatCurrency, formatDateDisplay } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { RotateCcw, Loader2, AlertCircle, UserRound, BedDouble, CalendarDays, CreditCard, ChevronDown, Search, ReceiptText, Info } from 'lucide-react'
import type { Payment } from '@/types'

interface PaymentExtended extends Payment {
  reservation?: {
    id: number
    reservation_number: string
    guest?: { first_name: string; last_name: string; email?: string }
    room?: { room_number: string; room_type?: { name: string } }
    check_in?: string
    check_out?: string
    payments?: Payment[]
  }
}

interface RefundModalProps {
  isOpen: boolean
  onClose: () => void
  payments: PaymentExtended[]
  onSuccess?: (payment: Payment) => void
}

const METHOD_LABELS: Record<string, string> = {
  online: 'Online',
  cash: 'Cash',
  gcash: 'GCash',
}

function methodBadgeClass(method: string): string {
  switch (method) {
    case 'cash': return 'bg-success/10 text-success border-success/20'
    case 'gcash': return 'bg-info/10 text-info border-info/20'
    case 'online': return 'bg-gold/15 text-gold-dark border-gold/20'
    default: return 'bg-border/50 text-muted border-border'
  }
}

function PaymentSearchPicker({
  payments,
  selected,
  onSelect,
  onOpenChange,
}: {
  payments: PaymentExtended[]
  selected: PaymentExtended | null
  onSelect: (p: PaymentExtended) => void
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return payments
    return payments.filter((p) => {
      const ref = (p.reference_number ?? '').toLowerCase()
      const guest = `${p.reservation?.guest?.first_name ?? ''} ${p.reservation?.guest?.last_name ?? ''}`.toLowerCase()
      const room = (p.reservation?.room?.room_number ?? '').toLowerCase()
      const booking = (p.reservation?.reservation_number ?? '').toLowerCase()
      return ref.includes(q) || guest.includes(q) || room.includes(q) || booking.includes(q)
    })
  }, [payments, query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setHighlight(0)
    searchRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function select(p: PaymentExtended) {
    onSelect(p)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (matches[highlight]) select(matches[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="text-sm font-medium text-foreground">Payment</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-1 flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm ring-offset-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
      >
        {selected ? (
          <span className="truncate text-foreground">
            {selected.reference_number ?? `PAY-${selected.id}`} · {selected.reservation?.guest?.first_name} {selected.reservation?.guest?.last_name} · {formatCurrency(selected.amount)}
          </span>
        ) : (
          <span className="truncate text-muted">Search by ref #, guest, or room…</span>
        )}
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setHighlight(0) }}
                onKeyDown={handleKeyDown}
                placeholder="Search by ref #, guest, or room…"
                aria-label="Search payments"
                className="h-9 w-full rounded-lg border border-border bg-bg pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>

          <ul className="max-h-64 overflow-y-auto p-1">
            {matches.length === 0 && (
              <li className="px-3 py-3 text-center text-sm text-muted">No matching payments</li>
            )}
            {matches.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => select(p)}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    i === highlight ? 'bg-cream' : 'hover:bg-cream',
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <CreditCard className="h-3.5 w-3.5 shrink-0 text-muted" />
                      {p.reference_number ?? `PAY-${p.id}`}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      <UserRound className="h-3 w-3 shrink-0" />
                      {p.reservation?.guest?.first_name} {p.reservation?.guest?.last_name}
                      {p.reservation?.room?.room_number && (
                        <> · Room {p.reservation.room.room_number}</>
                      )}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs font-semibold text-foreground">{formatCurrency(p.amount)}</span>
                    <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium', methodBadgeClass(p.payment_method))}>
                      {METHOD_LABELS[p.payment_method] ?? p.payment_method}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function RefundModal({
  isOpen,
  onClose,
  payments,
  onSuccess,
}: RefundModalProps) {
  const { addToast } = useToast()
  const queryClient = useQueryClient()

  const [selectedPayment, setSelectedPayment] = useState<PaymentExtended | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const refundMutation = useMutation({
    mutationFn: ({ paymentId, amount, reason }: { paymentId: number; amount: number; reason: string }) =>
      api.post<{ message: string; refund_id?: string }>(`/payments/${paymentId}/refund`, { amount, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      addToast('Refund processed successfully', 'success')
      onSuccess?.(selectedPayment as Payment)
      onClose()
    },
    onError: (err: { message?: string }) => {
      addToast(err.message || 'Refund failed. Please try again.', 'error')
    },
  })

  useEffect(() => {
    if (!isOpen) {
      setSelectedPayment(null)
      setReason('')
      setError(null)
      refundMutation.reset()
    }
  }, [isOpen])

  const paymentAmount = selectedPayment?.amount ?? 0
  const isCompleted = selectedPayment?.status === 'completed'
  const isOnline = selectedPayment?.payment_method === 'online'

  const canSubmit = !!selectedPayment && isCompleted && reason.trim().length > 0 && !refundMutation.isPending

  function handleSubmit() {
    if (!selectedPayment) return
    setError(null)
    refundMutation.mutate({
      paymentId: selectedPayment.id,
      amount: paymentAmount,
      reason: reason.trim(),
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Refund"
      size="lg"
      className={selectedPayment || pickerOpen ? 'h-[70vh]' : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={refundMutation.isPending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
            {refundMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Process Refund
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-danger/10 text-danger">
            <RotateCcw className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Process Refund</h4>
            <p className="text-xs text-muted">Search for a completed payment to refund.</p>
          </div>
        </div>

        {/* Payment Picker */}
        <PaymentSearchPicker
          payments={payments}
          selected={selectedPayment}
          onSelect={(p) => { setSelectedPayment(p); setError(null) }}
          onOpenChange={setPickerOpen}
        />

        {/* After payment selected */}
        {selectedPayment && (
          <>
            {/* Refund Summary — Hero Card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted">Refund Amount</p>
                  <p className="mt-0.5 text-2xl font-bold text-foreground">{formatCurrency(paymentAmount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-muted">Date Paid</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">
                    {formatDateDisplay(selectedPayment.paid_at ?? selectedPayment.created_at)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
                <StatusBadge status={selectedPayment.status} />
                <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium', methodBadgeClass(selectedPayment.payment_method))}>
                  {METHOD_LABELS[selectedPayment.payment_method] ?? selectedPayment.payment_method}
                </span>
              </div>
            </div>

            {/* Payment Details — Key Facts Grid */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ReceiptText className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Payment Details</h4>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <ReceiptText className="h-3.5 w-3.5" />
                    Reference
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {selectedPayment.reference_number ?? `PAY-${selectedPayment.id}`}
                  </p>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <UserRound className="h-3.5 w-3.5" />
                    Guest
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {selectedPayment.reservation?.guest?.first_name} {selectedPayment.reservation?.guest?.last_name}
                  </p>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <BedDouble className="h-3.5 w-3.5" />
                    Room
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {selectedPayment.reservation?.room?.room_number ?? '-'} {selectedPayment.reservation?.room?.room_type?.name ?? ''}
                  </p>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Date
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatDateDisplay(selectedPayment.paid_at ?? selectedPayment.created_at)}
                  </p>
                </div>
              </div>
            </div>

            {/* Manual Refund Notice (cash/gcash only) */}
            {!isOnline && (
              <div className="flex items-start gap-2 rounded-xl border border-info/20 bg-info/5 px-4 py-3 text-sm text-info">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>This records a manual refund — no gateway call will be made.</span>
              </div>
            )}

            {/* Refund Reason — Content Card */}
            {isCompleted && (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 text-warning">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">Refund Reason</h4>
                </div>
                <textarea
                  placeholder="Enter refund reason (required)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  aria-label="Refund reason"
                  rows={3}
                  disabled={refundMutation.isPending}
                  className="w-full rounded-lg border border-border bg-bg py-2 pl-3 pr-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/50"
                  maxLength={255}
                />
              </div>
            )}

            {/* Not completed warning */}
            {!isCompleted && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2.5 text-sm text-warning">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Only completed payments can be refunded.</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2.5 text-sm text-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                <span>{error}</span>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
