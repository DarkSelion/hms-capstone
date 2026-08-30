import { useEffect, useMemo, useRef, useState } from 'react'
import { useCreatePayment, useCheckIn, useCheckOut } from '@/hooks/useApi'
import { formatCurrency, formatDateDisplay } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Banknote, Loader2, AlertCircle, LogIn, LogOut, UserRound, BedDouble, CalendarDays, ReceiptText, Wallet, ChevronDown, Search } from 'lucide-react'
import type { Payment, Reservation } from '@/types'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  reservation?: Reservation | null
  reservations?: Reservation[]
  confirmLabel?: string
  hideHalf?: boolean
  showCheckInOption?: boolean
  showCheckOutOption?: boolean
  actualCheckOut?: string
  onSuccess?: (payment: Payment) => void
  paymentType?: 'full' | 'partial' | 'deposit'
}

function dueOf(reservation: Reservation | null): number {
  return reservation?.due_amount ?? 0
}

function clampAmount(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max)
}

function ReservationSearchPicker({
  reservations,
  selected,
  onSelect,
}: {
  reservations: Reservation[]
  selected: Reservation | null
  onSelect: (r: Reservation) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return reservations
    return reservations.filter((r) => {
      const roomNumber = r.room?.room_number ?? ''
      const roomType = r.room?.room_type?.name ?? ''
      const guest = `${r.guest?.first_name ?? ''} ${r.guest?.last_name ?? ''}`.toLowerCase()
      const booking = r.reservation_number.toLowerCase()
      const haystack = `${roomNumber} ${roomType} ${guest} ${booking} ${r.status}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [reservations, query])

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

  function select(r: Reservation) {
    onSelect(r)
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
      <label className="text-sm font-medium text-foreground">Reservation</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-1 flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm ring-offset-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
      >
        {selected ? (
          <span className="truncate text-foreground">
            #{selected.reservation_number} · Room {selected.room?.room_number ?? '-'}
            {selected.room?.room_type?.name ? ` (${selected.room.room_type.name})` : ''} · {selected.guest?.first_name} {selected.guest?.last_name} · Due {formatCurrency(dueOf(selected))}
          </span>
        ) : (
          <span className="truncate text-muted">Search by room, guest, or booking #…</span>
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
                onChange={(e) => {
                  setQuery(e.target.value)
                  setHighlight(0)
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search by room, guest, or booking #…"
                aria-label="Search reservations"
                className="h-9 w-full rounded-lg border border-border bg-bg pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>

          <ul className="max-h-64 overflow-y-auto p-1">
            {matches.length === 0 && (
              <li className="px-3 py-3 text-center text-sm text-muted">No matching reservations</li>
            )}
            {matches.map((r, i) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => select(r)}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    i === highlight ? 'bg-cream' : 'hover:bg-cream',
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <BedDouble className="h-3.5 w-3.5 shrink-0 text-muted" />
                      {r.room?.room_number ?? '-'}
                      {r.room?.room_type?.name && <span className="text-muted">· {r.room.room_type.name}</span>}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      <UserRound className="h-3 w-3 shrink-0" />
                      {r.guest?.first_name} {r.guest?.last_name} · #{r.reservation_number}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs font-semibold text-foreground">{formatCurrency(dueOf(r))}</span>
                    <StatusBadge status={r.status} />
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

export function PaymentModal({
  isOpen,
  onClose,
  reservation,
  reservations,
  confirmLabel = 'Record Payment',
  hideHalf = false,
  showCheckInOption = false,
  showCheckOutOption = false,
  actualCheckOut,
  onSuccess,
  paymentType = 'full',
}: PaymentModalProps) {
  const createPayment = useCreatePayment()
  const checkIn = useCheckIn()
  const checkOut = useCheckOut()
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [amount, setAmount] = useState(0)
  const [tendered, setTendered] = useState(0)
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checkInAfter, setCheckInAfter] = useState(false)
  const [checkOutAfter, setCheckOutAfter] = useState(false)
  const [internalPaymentType, setPaymentType] = useState<'full' | 'partial' | 'deposit'>(paymentType)

  const activeReservation = reservation ?? selectedReservation
  const due = dueOf(activeReservation)
  const canCheckInAfter = showCheckInOption && !!activeReservation && activeReservation.status === 'confirmed'
  const canCheckOutAfter =
    showCheckOutOption &&
    !!activeReservation &&
    activeReservation.status === 'checked_in' &&
    amount >= due &&
    due > 0

  useEffect(() => {
    if (!isOpen) return
    setReference('')
    setError(null)
    setCheckInAfter(false)
    setCheckOutAfter(false)
    if (reservation) {
      setAmount(dueOf(reservation))
      setTendered(dueOf(reservation))
    } else {
      setSelectedReservation(null)
      setAmount(0)
      setTendered(0)
    }
    // Key on the reservation id, not the object: the parent recreates the
    // reservation object (e.g. a live checkout preview) on every render,
    // which would otherwise wipe in-progress input mid-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reservation?.id])

  function handleReservationSelect(r: Reservation) {
    setSelectedReservation(r)
    const next = dueOf(r)
    setAmount(next)
    setTendered(next)
    setError(null)
  }

  function handleAmountChange(next: number) {
    const clamped = clampAmount(next, due)
    setAmount(clamped)
    setTendered(clamped)
  }

  function handleTenderedChange(next: number) {
    setTendered(clampAmount(next, Number.MAX_SAFE_INTEGER))
  }

  const changeDue = Math.max(0, tendered - amount)
  const stillOwes = Math.max(0, amount - tendered)
  const canSubmit = !!activeReservation && amount > 0 && !createPayment.isPending

  async function handleSubmit() {
    if (!activeReservation) {
      setError('Select a reservation first.')
      return
    }
    if (amount <= 0) {
      setError('Enter an amount to collect.')
      return
    }
    try {
      const payment = (await createPayment.mutateAsync({
        reservation_id: activeReservation.id,
        amount,
        payment_method: 'cash',
        payment_type: internalPaymentType,
        reference_number: reference.trim() || undefined,
        status: 'completed',
        ...(actualCheckOut ? { actual_check_out: actualCheckOut } : {}),
      })) as unknown as Payment
      if (checkInAfter && activeReservation.status === 'confirmed') {
        await checkIn.mutateAsync(activeReservation.id)
      } else if (checkOutAfter && activeReservation.status === 'checked_in') {
        await checkOut.mutateAsync({ id: activeReservation.id })
      }
      onSuccess?.(payment)
      onClose()
    } catch (err) {
      const e = err as { message?: string }
      setError(e.message || 'Payment failed. Please try again.')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Payment" size="lg">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
            <Banknote className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Collect Cash Payment</h4>
            <p className="text-xs text-muted">Record the amount received from the guest.</p>
          </div>
        </div>

        {!reservation && (
          <ReservationSearchPicker
            reservations={reservations ?? []}
            selected={selectedReservation}
            onSelect={handleReservationSelect}
          />
        )}

        {activeReservation && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-bg p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                  <UserRound className="h-3.5 w-3.5" />
                  Guest
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {activeReservation.guest?.first_name} {activeReservation.guest?.last_name}
                </p>
              </div>
              <div className="rounded-xl bg-bg p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                  <BedDouble className="h-3.5 w-3.5" />
                  Room
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {activeReservation.room?.room_number ?? '-'}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {activeReservation.room?.room_type?.name}
                </p>
              </div>
              <div className="rounded-xl bg-bg p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Stay
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {formatDateDisplay(activeReservation.check_in)} → {formatDateDisplay(activeReservation.check_out)}
                </p>
              </div>
              <div className="rounded-xl bg-bg p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                  <Wallet className="h-3.5 w-3.5" />
                  Balance Due
                </p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(due)}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">Payment Type</p>
          <div className="grid grid-cols-3 rounded-xl bg-bg p-1">
            {(['full', 'partial', 'deposit'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setPaymentType(type)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200',
                  internalPaymentType === type
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted hover:text-foreground',
                )}
              >
                <span className="capitalize">{type}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Amount to collect</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAmountChange(due)}
                    className="rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted transition-colors hover:bg-bg hover:text-foreground"
                  >
                    Full
                  </button>
                  {!hideHalf && (
                    <button
                      type="button"
                      onClick={() => handleAmountChange(Math.round(due / 2))}
                      className="rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted transition-colors hover:bg-bg hover:text-foreground"
                    >
                      Half
                    </button>
                  )}
                </div>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted">₱</span>
                <input
                  type="number"
                  aria-label="Amount to collect"
                  min={0}
                  max={due}
                  step="0.01"
                  value={amount}
                  onChange={(e) => handleAmountChange(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-card py-2 pl-7 pr-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-sm font-medium text-foreground">Cash tendered</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted">₱</span>
                <input
                  type="number"
                  aria-label="Cash tendered"
                  min={0}
                  step="0.01"
                  value={tendered}
                  onChange={(e) => handleTenderedChange(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-card py-2 pl-7 pr-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/50"
                />
              </div>
            </div>

            {changeDue > 0 ? (
              <div className="flex items-center justify-between rounded-lg border border-success/20 bg-success/10 px-3 py-2.5 text-sm">
                <span className="font-medium text-success">Change due</span>
                <span className="text-lg font-bold text-success">{formatCurrency(changeDue)}</span>
              </div>
            ) : (
              stillOwes > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-warning/20 bg-warning/10 px-3 py-2.5 text-sm">
                  <span className="font-medium text-warning">Guest still owes</span>
                  <span className="text-lg font-bold text-warning">{formatCurrency(stillOwes)}</span>
                </div>
              )
            )}
          </div>
        </div>

        <Input
          label="Reference / Transaction ID"
          placeholder="Optional for cash"
          icon={<ReceiptText className="h-4 w-4" />}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />

        {canCheckInAfter && (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/50"
              checked={checkInAfter}
              onChange={(e) => setCheckInAfter(e.target.checked)}
            />
            <LogIn className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Check in after payment</span>
          </label>
        )}

        {canCheckOutAfter && (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/50"
              checked={checkOutAfter}
              onChange={(e) => setCheckOutAfter(e.target.checked)}
            />
            <LogOut className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Check out after payment</span>
          </label>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2.5 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={createPayment.isPending}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
          {createPayment.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {checkOutAfter ? 'Record & Check Out' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}