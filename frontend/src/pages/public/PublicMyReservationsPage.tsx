import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  usePublicMe, usePublicReservations, usePublicCancelReservation,
  usePublicInitiateOnlinePayment, usePublicSettings, usePaymentSettings, usePortalCurrency,
} from '@/hooks/usePublicApi'
import { usePublicAuthStore } from '@/stores/publicAuthStore'
import { formatCurrencyWith, formatDateDisplay, formatCheckoutTime, toLocalDateStr } from '@/lib/format'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useToast } from '@/components/ui/toast'
import type { PublicReservation } from '@/types'
import {
  CalendarDays, MapPin, XCircle, Loader2, AlertTriangle,
  Clock, CheckCircle, RotateCcw, BedDouble, Users, Moon,
  LogIn, LogOut, CalendarX, Wallet, ShieldCheck, Lock,
  Search, ChevronRight, Calendar, TrendingUp, Sparkles, Mail, User,
} from 'lucide-react'

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: any }> = {
  pending: { bg: 'bg-yellow-500/10', text: 'text-yellow-700', icon: Clock },
  confirmed: { bg: 'bg-emerald-500/10', text: 'text-emerald-700', icon: CheckCircle },
  checked_in: { bg: 'bg-sky-500/10', text: 'text-sky-700', icon: LogIn },
  checked_out: { bg: 'bg-gray-100', text: 'text-gray-500', icon: LogOut },
  cancelled: { bg: 'bg-danger/10', text: 'text-danger', icon: XCircle },
  no_show: { bg: 'bg-gray-100', text: 'text-gray-500', icon: CalendarX },
}

const PAYMENT_STYLES: Record<string, { bg: string; text: string; border: string; icon: any }> = {
  unpaid: { bg: 'bg-danger/10', text: 'text-danger', border: 'border-danger/20', icon: AlertTriangle },
  partial: { bg: 'bg-amber-500/10', text: 'text-amber-700', border: 'border-amber-400/30', icon: Clock },
  paid: { bg: 'bg-emerald-500/10', text: 'text-emerald-700', border: 'border-emerald-400/30', icon: CheckCircle },
  refunded: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200', icon: RotateCcw },
}

const THUMB_SRC: Record<string, string> = {
  rooms: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=400&h=400&fit=crop',
  suites: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&h=400&fit=crop',
  villas: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=400&h=400&fit=crop',
}

function getThumbUrl(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('villa')) return THUMB_SRC.villas
  if (lower.includes('suite')) return THUMB_SRC.suites
  return THUMB_SRC.rooms
}

function getRoomImageUrl(r: PublicReservation): string {
  return r.room?.image_url || r.room?.room_type?.image_url || getThumbUrl(r.room?.room_type?.name ?? '')
}

function dateKey(dateStr: string): string {
  return (dateStr || '').split(/[\sT]/)[0]
}

function shortDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateKey(dateStr) + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function toNum(v: unknown): number {
  if (typeof v === 'number' && !isNaN(v)) return v
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(dateKey(checkIn) + 'T00:00:00')
  const b = new Date(dateKey(checkOut) + 'T00:00:00')
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 1
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000))
}

function daysUntil(dateStr: string, today: string): number {
  const a = new Date(today + 'T00:00:00')
  const b = new Date(dateKey(dateStr) + 'T00:00:00')
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function isUpcomingReservation(r: PublicReservation, today: string): boolean {
  return r.status !== 'cancelled' && r.status !== 'checked_out' && r.status !== 'no_show' && dateKey(r.check_out) >= today
}

function isPastReservation(r: PublicReservation, today: string): boolean {
  return r.status !== 'cancelled' && (r.status === 'checked_out' || r.status === 'no_show' || dateKey(r.check_out) < today)
}

function canPayOnline(r: PublicReservation): boolean {
  return r.status !== 'cancelled' && r.status !== 'checked_out' && r.status !== 'no_show'
}

function isMutedReservation(r: PublicReservation): boolean {
  return r.status === 'cancelled' || r.status === 'no_show' || r.status === 'checked_out'
}

type FilterKey = 'all' | 'upcoming' | 'past' | 'cancelled'

const FILTER_TABS: { key: FilterKey; label: string; icon: any }[] = [
  { key: 'all', label: 'All', icon: Sparkles },
  { key: 'upcoming', label: 'Upcoming', icon: TrendingUp },
  { key: 'past', label: 'Past', icon: CheckCircle },
  { key: 'cancelled', label: 'Cancelled', icon: XCircle },
]

function initialsOf(first: string, last: string): string {
  const a = (first || '').trim().charAt(0).toUpperCase()
  const b = (last || '').trim().charAt(0).toUpperCase()
  return (a + b) || 'G'
}

export default function PublicMyReservationsPage() {
  const { token } = usePublicAuthStore()
  const { addToast } = useToast()
  const { data: user } = usePublicMe()
  const { data, isLoading } = usePublicReservations()
  const cancelReservation = usePublicCancelReservation()
  const initiateOnline = usePublicInitiateOnlinePayment()
  const currency = usePortalCurrency()
  const fmt = (amount: number) => formatCurrencyWith(amount, currency)
  const { data: bookingSettings } = usePublicSettings('booking')
  const booking = (bookingSettings ?? {}) as Record<string, unknown>
  const checkoutTimeLabel = formatCheckoutTime(typeof booking['check_out_time'] === 'string' ? booking['check_out_time'] : '11:00')
  const cancellationPolicy = typeof booking['cancellation_policy'] === 'string' ? booking['cancellation_policy'] : ''
  const lateCheckoutFeeRaw = typeof booking['late_checkout_fee'] === 'string' ? booking['late_checkout_fee'] : ''
  const lateCheckoutFeeNum = Number(lateCheckoutFeeRaw)
  const hasLateCheckoutFee = lateCheckoutFeeRaw !== '' && !isNaN(lateCheckoutFeeNum) && lateCheckoutFeeNum > 0
  const paymentSettings = usePaymentSettings()
  const onlineGatewayEnabled = paymentSettings['online_gateway_enabled'] === '1' || paymentSettings['online_gateway_enabled'] === true

  const [cancelTarget, setCancelTarget] = useState<PublicReservation | null>(null)
  const [cancelError, setCancelError] = useState('')
  const [paymentModal, setPaymentModal] = useState<PublicReservation | null>(null)
  const [detailsModal, setDetailsModal] = useState<PublicReservation | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const today = toLocalDateStr(new Date())

  const reservations = useMemo(() => data?.data ?? [], [data])

  const counts = useMemo(() => {
    const upcoming = reservations.filter((r) => isUpcomingReservation(r, today)).length
    const past = reservations.filter((r) => isPastReservation(r, today)).length
    const cancelled = reservations.filter((r) => r.status === 'cancelled').length
    return { all: reservations.length, upcoming, past, cancelled }
  }, [reservations, today])

  const totalSpent = useMemo(() => {
    return reservations
      .filter((r) => r.status !== 'cancelled' && r.status !== 'no_show')
      .reduce((sum, r) => sum + toNum(r.paid_amount), 0)
  }, [reservations])

  const filtered = useMemo(() => {
    let list = reservations
    if (filter === 'cancelled') list = list.filter((r) => r.status === 'cancelled')
    else if (filter === 'past') list = list.filter((r) => isPastReservation(r, today))
    else if (filter === 'upcoming') list = list.filter((r) => isUpcomingReservation(r, today))

    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((r) => {
        const ref = (r.reservation_number || '').toLowerCase()
        const roomName = (r.room?.room_type?.name || '').toLowerCase()
        const roomNum = String(r.room?.room_number || '')
        return ref.includes(q) || roomName.includes(q) || roomNum.includes(q)
      })
    }

    // Smart sort: upcoming first (nearest check-in ASC),
    // then past including no_show (most recent check-in DESC),
    // then cancelled (most recent check-in DESC)
    return [...list].sort((a, b) => {
      const aUpcoming = isUpcomingReservation(a, today)
      const bUpcoming = isUpcomingReservation(b, today)
      const aPast = isPastReservation(a, today)
      const bPast = isPastReservation(b, today)

      // Priority tiers: upcoming → past → cancelled (cancelled = neither upcoming nor past)
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1
      if (aPast !== bPast) return aPast ? -1 : 1  // past comes before cancelled

      // Within same tier, sort by check-in date
      const aDate = dateKey(a.check_in)
      const bDate = dateKey(b.check_in)
      // Upcoming: nearest first (ASC); past + cancelled: most recent first (DESC)
      if (aUpcoming) return aDate.localeCompare(bDate)
      return bDate.localeCompare(aDate)
    })
  }, [reservations, filter, search, today])

  function handleStartOnlinePayment() {
    if (!paymentModal) return
    initiateOnline.mutate(paymentModal.id, {
      onSuccess: (res) => {
        if (res.redirect_url) window.location.href = res.redirect_url
      },
    })
  }

  function handleCancelConfirm() {
    if (!cancelTarget) return
    setCancelError('')
    cancelReservation.mutate(cancelTarget.id, {
      onSuccess: () => {
        addToast('Reservation cancelled', 'success')
        setCancelTarget(null)
      },
      onError: (e) => {
        const message = e instanceof Error ? e.message : 'Unable to cancel the reservation. Please try again.'
        setCancelError(message)
      },
    })
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
            <CalendarX className="h-7 w-7 text-white/20" />
          </div>
          <p className="text-white/40 mb-6 text-lg font-light">Please sign in to view your reservations.</p>
          <Link to="/public/login" className="btn-gold inline-block">Sign In</Link>
        </div>
      </div>
    )
  }

  const fullName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Guest'
  const initials = initialsOf(user?.first_name ?? '', user?.last_name ?? '')

  return (
    <div className="min-h-screen bg-dark">
      {/* Hero */}
      <section className="relative bg-dark overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gold/5 to-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 py-12 sm:py-16">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-gradient-to-br from-gold to-gold-light text-dark flex items-center justify-center font-serif text-2xl sm:text-3xl font-light shadow-lg shadow-gold/20 shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-gold/60 font-medium">My Account</p>
                <h1 className="font-serif text-white text-2xl sm:text-3xl font-light mt-1 truncate">{fullName}</h1>
                <p className="text-white/40 text-sm mt-1 truncate">{user?.email}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-gold/80 bg-gold/10 border border-gold/20 rounded-full px-2.5 py-1">
                    <CalendarDays className="h-3 w-3" />
                    {counts.all} booking{counts.all !== 1 ? 's' : ''}
                  </span>
                  {counts.upcoming > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 rounded-full px-2.5 py-1">
                      <TrendingUp className="h-3 w-3" />
                      {counts.upcoming} upcoming
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <Link
                to="/public/profile"
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-white/10 text-white/60 text-xs font-semibold uppercase tracking-wider rounded hover:bg-white/5 hover:text-white transition-colors"
              >
                <User className="h-3.5 w-3.5" />
                Edit Profile
              </Link>
              <Link
                to="/public/rooms"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-gold/30 text-gold text-xs font-semibold uppercase tracking-wider rounded hover:bg-gold hover:text-dark transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                New Booking
              </Link>
            </div>
          </div>
          <div className="gold-line-left mt-8" />
        </div>
      </section>

      {/* Body */}
      <section className="bg-cream py-10 sm:py-12 px-4">
        <div className="max-w-5xl mx-auto space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
            </div>
          ) : reservations.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {/* Quick stats strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <StatTile icon={Sparkles} label="Total" value={counts.all} sublabel="bookings" />
                <StatTile icon={TrendingUp} label="Upcoming" value={counts.upcoming} sublabel="stays" accent />
                <StatTile icon={CheckCircle} label="Past" value={counts.past} sublabel="completed" />
                <StatTile icon={Wallet} label="Spent" value={fmt(totalSpent)} sublabel="with us" />
              </div>

              {/* Filter row + search */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {FILTER_TABS.map((t) => {
                    const Icon = t.icon
                    const isActive = filter === t.key
                    return (
                      <button
                        key={t.key}
                        onClick={() => setFilter(t.key)}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${
                          isActive
                            ? 'bg-gold text-dark shadow-md shadow-gold/20'
                            : 'bg-white border border-gray-200 text-dark/50 hover:border-gold/40 hover:text-dark'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {t.label}
                        <span className={`ml-1 ${isActive ? 'opacity-70' : 'opacity-50'}`}>({counts[t.key]})</span>
                      </button>
                    )
                  })}
                </div>
                {reservations.length > 2 && (
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark/30 pointer-events-none" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by booking #, room…"
                      className="input-light pl-10 py-2.5"
                    />
                  </div>
                )}
              </div>

              {/* List */}
              {filtered.length === 0 ? (
                <FilteredEmpty filter={filter} onReset={() => { setFilter('all'); setSearch('') }} />
              ) : (
                <div className="space-y-4 sm:space-y-5">
                  {filtered.map((r: PublicReservation) => (
                    <ReservationCard
                      key={r.id}
                      reservation={r}
                      fmt={fmt}
                      checkoutTimeLabel={checkoutTimeLabel}
                      lateCheckoutFee={hasLateCheckoutFee ? lateCheckoutFeeNum : null}
                      onlineGatewayEnabled={onlineGatewayEnabled}
                      onPay={() => setPaymentModal(r)}
                      onCancel={() => { setCancelError(''); setCancelTarget(r) }}
                      onView={() => setDetailsModal(r)}
                      today={today}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Details Modal */}
      <ReservationDetailsModal
        reservation={detailsModal}
        onClose={() => setDetailsModal(null)}
        fmt={fmt}
        checkoutTimeLabel={checkoutTimeLabel}
        lateCheckoutFee={hasLateCheckoutFee ? lateCheckoutFeeNum : null}
      />

      {/* Cancel Confirmation */}
      <ConfirmDialog
        isOpen={cancelTarget !== null}
        onClose={() => { if (!cancelReservation.isPending) setCancelTarget(null) }}
        onConfirm={handleCancelConfirm}
        title="Cancel Reservation"
        message="Are you sure you want to cancel this reservation? This action cannot be undone and the room will be released."
        confirmLabel={cancelReservation.isPending ? 'Cancelling...' : 'Yes, Cancel'}
        confirmVariant="danger"
        isLoading={cancelReservation.isPending}
      >
        {cancelTarget && (
          <div className="mt-4 space-y-3 text-left">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-bg border border-border">
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-dark/5">
                <img src={getRoomImageUrl(cancelTarget)} alt={cancelTarget.room?.room_type?.name} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{cancelTarget.room?.room_type?.name}</p>
                <p className="text-xs text-muted truncate">
                  Room {cancelTarget.room?.room_number} · {cancelTarget.reservation_number}
                </p>
              </div>
              <p className="text-sm font-semibold text-foreground shrink-0">{fmt(toNum(cancelTarget.total_amount))}</p>
            </div>
            {cancellationPolicy && (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-bg px-3 py-2.5">
                <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                <p className="text-xs text-muted leading-relaxed">
                  <span className="text-foreground font-medium">Cancellation policy: </span>
                  {cancellationPolicy}
                </p>
              </div>
            )}
            {cancelError && (
              <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                <p className="text-xs text-danger leading-relaxed">{cancelError}</p>
              </div>
            )}
          </div>
        )}
      </ConfirmDialog>

      {/* Payment Modal */}
      <Modal
        isOpen={paymentModal !== null}
        onClose={() => { if (!initiateOnline.isPending) setPaymentModal(null) }}
        size="md"
      >
        {paymentModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <div className="h-10 w-10 rounded-lg bg-gold/10 text-gold flex items-center justify-center shrink-0">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Make Payment</h3>
                <p className="text-xs text-muted">Secure online checkout via PayMongo</p>
              </div>
            </div>

            <div className="rounded-xl bg-bg border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-dark/5">
                  <img src={getRoomImageUrl(paymentModal)} alt={paymentModal.room?.room_type?.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{paymentModal.room?.room_type?.name}</p>
                  <p className="text-xs text-muted truncate">
                    Room {paymentModal.room?.room_number} · {paymentModal.reservation_number}
                  </p>
                </div>
              </div>
              <div className="px-4 py-3 text-sm">
                <p className="text-xs text-muted mb-1">Stay</p>
                <p className="text-foreground">
                  {formatDateDisplay(paymentModal.check_in)} — {formatDateDisplay(paymentModal.check_out)}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-bg border border-border p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Total</span>
                <span className="text-foreground">{fmt(toNum(paymentModal.total_amount))}</span>
              </div>
              {paymentModal.paid_amount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Paid</span>
                  <span className="text-emerald-600 font-medium">{fmt(toNum(paymentModal.paid_amount))}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-2.5">
                <span className="text-foreground font-semibold">Balance Due</span>
                <span className="text-xl font-bold text-gold-dark">{fmt(toNum(paymentModal.due_amount))}</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-bg px-3.5 py-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <p className="text-xs text-muted leading-relaxed">
                You will be redirected to our secure payment partner to complete your payment of{' '}
                <span className="text-foreground font-semibold">{fmt(toNum(paymentModal.due_amount))}</span>. Do not close this window during redirect.
              </p>
            </div>

            {initiateOnline.isError && (
              <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                <p className="text-xs text-danger leading-relaxed">
                  {(initiateOnline.error as Error)?.message}
                </p>
              </div>
            )}

            <button
              onClick={handleStartOnlinePayment}
              disabled={initiateOnline.isPending}
              className="w-full bg-gold text-dark font-semibold rounded-lg py-3 text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-gold-light transition-colors disabled:opacity-50"
            >
              {initiateOnline.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {initiateOnline.isPending ? 'Redirecting...' : 'Continue to Secure Payment'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatTile({
  icon: Icon, label, value, sublabel, accent,
}: {
  icon: any
  label: string
  value: number | string
  sublabel: string
  accent?: boolean
}) {
  return (
    <div className={`bg-white border ${accent ? 'border-gold/30' : 'border-white/90'} rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`h-9 w-9 rounded-full ${accent ? 'bg-gold/15 text-gold-dark' : 'bg-gold/10 text-gold'} flex items-center justify-center`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.15em] text-dark/55 font-semibold">{label}</p>
      </div>
      <p className="font-sans text-dark text-2xl sm:text-3xl font-semibold leading-none tabular-nums">{value}</p>
      <p className="text-xs text-dark/50 mt-1">{sublabel}</p>
    </div>
  )
}

function ReservationCard({
  reservation: r,
  fmt,
  checkoutTimeLabel,
  lateCheckoutFee,
  onlineGatewayEnabled,
  onPay,
  onCancel,
  onView,
  today,
}: {
  reservation: PublicReservation
  fmt: (n: number) => string
  checkoutTimeLabel: string
  lateCheckoutFee: number | null
  onlineGatewayEnabled: boolean
  onPay: () => void
  onCancel: () => void
  onView: () => void
  today: string
}) {
  const sStyle = STATUS_STYLES[r.status] || STATUS_STYLES.pending
  const StatusIcon = sStyle.icon
  const pStyle = PAYMENT_STYLES[r.payment_status] || PAYMENT_STYLES.unpaid
  const PayIcon = pStyle.icon
  const nights = nightsBetween(r.check_in, r.check_out)
  const muted = isMutedReservation(r)
  const isUpcoming = isUpcomingReservation(r, today)
  const checkInDays = isUpcoming ? daysUntil(r.check_in, today) : 0
  const hasBalance = (r.payment_status === 'unpaid' || r.payment_status === 'partial') && r.due_amount > 0
  const showPayButton = hasBalance && canPayOnline(r)
  const showCancelButton = r.status === 'pending' || r.status === 'confirmed'

  return (
    <div
      className={`group bg-white border ${muted ? 'border-gray-100' : 'border-white/90'} rounded-2xl overflow-hidden shadow-sm hover:shadow-xl ${muted ? 'hover:border-gray-200' : 'hover:border-gold/30'} transition-all duration-300 ${muted ? 'opacity-75' : ''}`}
    >
      {/* Gold accent bar */}
      <div className={`h-0.5 w-full bg-gradient-to-r ${muted ? 'from-gray-200 via-gray-100 to-transparent' : 'from-gold/60 via-gold/20 to-transparent'}`} />

      <div className="grid grid-cols-1 md:grid-cols-[1fr_140px]">
        {/* Main content */}
        <div className="p-5 sm:p-6">
          {/* Header row: ref + status */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-dark/30 mb-0.5">Reference</p>
              <p className="text-sm font-mono tracking-wider text-dark truncate">{r.reservation_number}</p>
            </div>
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider shrink-0 ${sStyle.bg} ${sStyle.text}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {r.status.replace('_', ' ')}
            </span>
          </div>

          {/* Room + meta */}
          <div className="mb-4">
            <h3 className="font-serif text-lg sm:text-xl text-dark font-medium">{r.room?.room_type?.name}</h3>
            <p className="text-sm text-dark/50 mt-0.5 flex items-center gap-1">
              <MapPin className="h-3 w-3 text-gold/60" />
              Room {r.room?.room_number}{r.room?.floor ? ` · Floor ${r.room.floor}` : ''}
            </p>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <MetaCell icon={CalendarDays} label="Stay" value={`${shortDate(r.check_in)} → ${shortDate(r.check_out)}`} />
            <MetaCell icon={Moon} label="Nights" value={String(nights)} />
            <MetaCell icon={Users} label="Guests" value={`${r.adults}${r.children > 0 ? `+${r.children}` : ''}`} />
          </div>

          {/* Check-out time + reminder */}
          <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 mb-3">
            <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <span className="font-semibold">Check-out by {checkoutTimeLabel}.</span>{' '}
              {lateCheckoutFee !== null
                ? <>Late check-out fee: <span className="font-semibold">{fmt(lateCheckoutFee)}</span>.</>
                : <>Late check-out fees may apply.</>}
            </p>
          </div>
          {r.room?.room_type?.bed_type && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-dark/40">
              <span className="flex items-center gap-1.5 bg-dark/5 px-2.5 py-1 rounded-full">
                <BedDouble className="h-3 w-3 text-gold/60" />
                {r.room.room_type.bed_type}
              </span>
            </div>
          )}

          {/* Upcoming reminder */}
          {isUpcoming && checkInDays > 0 && checkInDays <= 7 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-700">
                <span className="font-semibold">Check-in in {checkInDays} day{checkInDays !== 1 ? 's' : ''}.</span>{' '}
                We can&apos;t wait to host you.
              </p>
            </div>
          )}
        </div>

        {/* Image column (desktop) */}
        <div className="hidden md:block relative bg-dark/5 border-l border-gray-100">
          <img
            src={getRoomImageUrl(r)}
            alt={r.room?.room_type?.name}
            className={`absolute inset-0 w-full h-full object-cover ${muted ? 'grayscale' : ''}`}
          />
          {muted && (
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center gap-1 bg-white/90 backdrop-blur text-dark/60 text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full">
                {r.status === 'cancelled' ? 'Cancelled' : r.status === 'no_show' ? 'No Show' : 'Past Stay'}
              </span>
            </div>
          )}
        </div>

        {/* Image row (mobile) */}
        <div className="md:hidden relative h-32 bg-dark/5">
          <img
            src={getRoomImageUrl(r)}
            alt={r.room?.room_type?.name}
            className={`absolute inset-0 w-full h-full object-cover ${muted ? 'grayscale' : ''}`}
          />
          {muted && (
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center gap-1 bg-white/90 backdrop-blur text-dark/60 text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full">
                {r.status === 'cancelled' ? 'Cancelled' : r.status === 'no_show' ? 'No Show' : 'Past Stay'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer: pricing + actions */}
      <div className="px-5 sm:px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <p className="text-[10px] uppercase tracking-wider text-dark/55 font-semibold">Total</p>
            <p className="text-2xl font-semibold text-gold-dark leading-none">{fmt(toNum(r.total_amount))}</p>
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${pStyle.bg} ${pStyle.text} ${pStyle.border}`}>
              <PayIcon className="h-3 w-3" />
              {r.payment_status.replace('_', ' ')}
            </span>
          </div>
          {r.payment_status === 'partial' && (
            <p className="mt-1 text-xs text-dark/40">
              Paid {fmt(toNum(r.paid_amount))} · <span className="text-amber-700 font-medium">Balance {fmt(toNum(r.due_amount))}</span>
            </p>
          )}
          {r.payment_status === 'paid' && r.paid_amount > 0 && (
            <p className="mt-1 text-xs text-emerald-700">Paid in full</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onView}
            className="px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-dark/60 hover:text-dark border border-gray-200 rounded-lg hover:border-dark/30 transition-colors inline-flex items-center gap-1"
          >
            Details
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          {showCancelButton && (
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-danger/30 text-danger rounded-lg text-xs font-semibold uppercase tracking-wider hover:bg-danger/5 hover:border-danger/60 transition-all inline-flex items-center gap-1.5"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </button>
          )}
          {showPayButton && (
            onlineGatewayEnabled ? (
              <button
                onClick={onPay}
                className="px-4 py-2 bg-gold text-dark rounded-lg text-xs font-semibold uppercase tracking-wider hover:bg-gold-light transition-colors inline-flex items-center gap-1.5 shadow-sm hover:shadow-md"
              >
                <Wallet className="h-3.5 w-3.5" />
                Pay {fmt(toNum(r.due_amount))}
              </button>
            ) : (
              <span className="px-3 py-1.5 rounded-lg text-xs bg-amber-100 border border-amber-600/40 text-amber-800 inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" />
                Online Payment Unavailable
              </span>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function MetaCell({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-dark/[0.03] border border-gray-100 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-dark/55 font-semibold">
        <Icon className="h-3 w-3 text-gold/60" />
        {label}
      </div>
      <p className="text-sm text-dark font-medium mt-0.5 truncate">{value}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-white border border-white/90 rounded-2xl shadow-sm max-w-lg mx-auto p-12 sm:p-16 text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center mx-auto mb-6">
        <CalendarX className="h-9 w-9 text-gold" />
      </div>
      <h2 className="font-serif text-dark text-2xl font-normal mb-2">No bookings yet</h2>
      <p className="text-dark/50 text-sm mb-8 max-w-sm mx-auto">
        Your reservations will appear here once you book a stay. Browse our cozy rooms and find your next escape.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link to="/public/rooms" className="btn-gold inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Browse Rooms
        </Link>
        <Link to="/public/contact" className="btn-gold-outline inline-flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Contact Us
        </Link>
      </div>
    </div>
  )
}

function FilteredEmpty({ filter, onReset }: { filter: FilterKey; onReset: () => void }) {
  const labels: Record<FilterKey, string> = {
    all: 'bookings',
    upcoming: 'upcoming bookings',
    past: 'past bookings',
    cancelled: 'cancelled bookings',
  }
  return (
    <div className="bg-white border border-white/90 rounded-2xl shadow-sm max-w-lg mx-auto p-10 text-center">
      <div className="w-14 h-14 rounded-full bg-dark/5 flex items-center justify-center mx-auto mb-4">
        <Search className="h-6 w-6 text-gold" />
      </div>
      <p className="text-dark text-lg mb-1 font-normal">No {labels[filter]} found</p>
      <p className="text-dark/50 text-sm mb-5">Try a different filter or clear your search.</p>
      <button onClick={onReset} className="text-gold text-sm uppercase tracking-wider hover:underline font-semibold">
        View all bookings
      </button>
    </div>
  )
}

function ReservationDetailsModal({
  reservation: r,
  onClose,
  fmt,
  checkoutTimeLabel,
  lateCheckoutFee,
}: {
  reservation: PublicReservation | null
  onClose: () => void
  fmt: (n: number) => string
  checkoutTimeLabel: string
  lateCheckoutFee: number | null
}) {
  if (!r) return null
  const sStyle = STATUS_STYLES[r.status] || STATUS_STYLES.pending
  const StatusIcon = sStyle.icon
  const pStyle = PAYMENT_STYLES[r.payment_status] || PAYMENT_STYLES.unpaid
  const PayIcon = pStyle.icon
  const nights = nightsBetween(r.check_in, r.check_out)

  return (
    <Modal isOpen={r !== null} onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <div className="h-10 w-10 rounded-lg bg-gold/10 text-gold flex items-center justify-center shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground truncate">Booking {r.reservation_number}</h3>
            <p className="text-xs text-muted">Placed {formatDateDisplay(r.created_at)}</p>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden border border-border">
          <div className="aspect-[16/9] bg-dark/5">
            <img src={getRoomImageUrl(r)} alt={r.room?.room_type?.name} className="w-full h-full object-cover" />
          </div>
          <div className="p-4 space-y-2 bg-bg">
            <h4 className="font-serif text-lg text-foreground font-medium">{r.room?.room_type?.name}</h4>
            <p className="text-sm text-muted flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-gold" />
              Room {r.room?.room_number}{r.room?.floor ? ` · Floor ${r.room.floor}` : ''}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${sStyle.bg} ${sStyle.text}`}>
                <StatusIcon className="h-3 w-3" />
                {r.status.replace('_', ' ')}
              </span>
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${pStyle.bg} ${pStyle.text} ${pStyle.border}`}>
                <PayIcon className="h-3 w-3" />
                {r.payment_status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-bg border border-border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Check-in</p>
            <p className="text-sm font-medium text-foreground">{formatDateDisplay(r.check_in)}</p>
          </div>
          <div className="rounded-lg bg-bg border border-border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Check-out</p>
            <p className="text-sm font-medium text-foreground">{formatDateDisplay(r.check_out)}</p>
          </div>
          <div className="rounded-lg bg-bg border border-border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Nights</p>
            <p className="text-sm font-medium text-foreground">{nights} night{nights !== 1 ? 's' : ''}</p>
          </div>
          <div className="rounded-lg bg-bg border border-border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Guests</p>
            <p className="text-sm font-medium text-foreground">
              {r.adults} adult{r.adults !== 1 ? 's' : ''}{r.children > 0 ? `, ${r.children} child${r.children !== 1 ? 'ren' : ''}` : ''}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-bg border border-border p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Total</span>
            <span className="text-foreground font-medium">{fmt(toNum(r.total_amount))}</span>
          </div>
          {r.paid_amount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Paid</span>
              <span className="text-emerald-600 font-medium">{fmt(toNum(r.paid_amount))}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="text-foreground font-semibold">Balance Due</span>
            <span className="text-lg font-bold text-gold-dark">{fmt(toNum(r.due_amount))}</span>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
          <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-semibold">Check-out by {checkoutTimeLabel}.</span>{' '}
            {lateCheckoutFee !== null ? (
              <>Late check-out fee: <span className="font-semibold">{fmt(lateCheckoutFee)}</span>.</>
            ) : (
              <>Late check-out fees may apply.</>
            )}
          </p>
        </div>
      </div>
    </Modal>
  )
}
