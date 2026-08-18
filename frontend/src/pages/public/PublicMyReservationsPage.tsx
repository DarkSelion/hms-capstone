import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePublicReservations, usePublicCancelReservation, usePublicInitiateOnlinePayment, usePublicSettings, usePaymentSettings, usePortalCurrency } from '@/hooks/usePublicApi'
import { usePublicAuthStore } from '@/stores/publicAuthStore'
import { formatCurrencyWith, formatDateDisplay, formatCheckoutTime, toLocalDateStr } from '@/lib/format'
import type { PublicReservation } from '@/types'
import {
  CalendarDays, MapPin, XCircle, Loader2, AlertTriangle, X,
  Clock, CheckCircle, RotateCcw, BedDouble, Users, Moon,
  LogIn, LogOut, CalendarX, Wallet, ShieldCheck, Lock,
} from 'lucide-react'

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: any }> = {
  pending: { bg: 'bg-yellow-500/10', text: 'text-yellow-600', icon: Clock },
  confirmed: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', icon: CheckCircle },
  checked_in: { bg: 'bg-sky-500/10', text: 'text-sky-600', icon: LogIn },
  checked_out: { bg: 'bg-gray-100', text: 'text-gray-500', icon: LogOut },
  cancelled: { bg: 'bg-danger/10', text: 'text-danger', icon: XCircle },
  no_show: { bg: 'bg-gray-100', text: 'text-gray-500', icon: CalendarX },
}

const PAYMENT_STYLES: Record<string, { bg: string; text: string; border: string; icon: any }> = {
  unpaid: { bg: 'bg-danger/10', text: 'text-danger', border: 'border-danger/20', icon: AlertTriangle },
  partial: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-400/20', icon: Clock },
  paid: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-400/20', icon: CheckCircle },
  refunded: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200', icon: RotateCcw },
}

const THUMB_SRC: Record<string, string> = {
  rooms: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=120&h=120&fit=crop',
  suites: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=120&h=120&fit=crop',
  villas: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=120&h=120&fit=crop',
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

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(dateKey(checkIn) + 'T00:00:00')
  const b = new Date(dateKey(checkOut) + 'T00:00:00')
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 1
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000))
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

type FilterKey = 'all' | 'upcoming' | 'past' | 'cancelled'

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'cancelled', label: 'Cancelled' },
]

export default function PublicMyReservationsPage() {
  const { token } = usePublicAuthStore()
  const { data, isLoading } = usePublicReservations()
  const cancelReservation = usePublicCancelReservation()
  const initiateOnline = usePublicInitiateOnlinePayment()
  const currency = usePortalCurrency()
  const fmt = (amount: number) => formatCurrencyWith(amount, currency)
  const { data: bookingSettings } = usePublicSettings('booking')
  const booking = (bookingSettings ?? {}) as Record<string, unknown>
  const checkoutTimeLabel = formatCheckoutTime(typeof booking['check_out_time'] === 'string' ? booking['check_out_time'] : '11:00')
  const cancellationPolicy = typeof booking['cancellation_policy'] === 'string' ? booking['cancellation_policy'] : ''
  const paymentSettings = usePaymentSettings()
  const onlineGatewayEnabled = paymentSettings['online_gateway_enabled'] === '1' || paymentSettings['online_gateway_enabled'] === true
  const [cancelTarget, setCancelTarget] = useState<PublicReservation | null>(null)
  const [cancelError, setCancelError] = useState('')
  const [paymentModal, setPaymentModal] = useState<PublicReservation | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')
  const today = toLocalDateStr(new Date())

  const reservations = useMemo(() => data?.data ?? [], [data])

  const counts = useMemo(() => {
    const upcoming = reservations.filter((r) => isUpcomingReservation(r, today)).length
    const past = reservations.filter((r) => isPastReservation(r, today)).length
    const cancelled = reservations.filter((r) => r.status === 'cancelled').length
    return { all: reservations.length, upcoming, past, cancelled }
  }, [reservations, today])

  const filtered = useMemo(() => {
    if (filter === 'cancelled') return reservations.filter((r) => r.status === 'cancelled')
    if (filter === 'past') return reservations.filter((r) => isPastReservation(r, today))
    if (filter === 'upcoming') return reservations.filter((r) => isUpcomingReservation(r, today))
    return reservations
  }, [reservations, filter, today])

  const handleStartOnlinePayment = () => {
    if (!paymentModal) return
    initiateOnline.mutate(paymentModal.id, {
      onSuccess: (res) => {
        if (res.redirect_url) {
          window.location.href = res.redirect_url
        }
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

  return (
    <div className="min-h-screen bg-dark">
      <section className="bg-dark border-b border-white/5 py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="section-subtitle mb-3">My Bookings</p>
          <h1 className="font-serif text-white text-4xl font-light mb-2">My Reservations</h1>
          <div className="gold-line-left mt-4" />
          {reservations.length > 0 && (
            <p className="text-white/30 text-sm mt-4">
              {counts.all} booking{counts.all > 1 ? 's' : ''} · {counts.upcoming} upcoming
            </p>
          )}
        </div>
      </section>

      <section className="bg-cream py-16 px-4">
        <div className="max-w-5xl mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
          </div>
        ) : reservations.length === 0 ? (
          <div className="bg-white border border-white/90 rounded-2xl shadow-sm max-w-lg mx-auto p-16 text-center">
            <div className="w-16 h-16 rounded-full bg-dark/5 flex items-center justify-center mx-auto mb-5">
              <CalendarX className="h-7 w-7 text-gold" />
            </div>
            <p className="text-dark text-lg mb-2 font-light">No upcoming stays yet</p>
            <p className="text-dark/40 text-sm mb-6">Browse our rooms and book your cozy escape in Pampanga.</p>
            <Link to="/public/rooms" className="btn-gold inline-block">Browse Rooms</Link>
          </div>
        ) : (
          <>
            {/* Status filter tabs */}
            <div className="flex flex-wrap items-center gap-2 mb-8">
              {FILTER_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setFilter(t.key)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${
                    filter === t.key
                      ? 'bg-gold text-dark shadow-md shadow-gold/20'
                      : 'bg-white border border-gray-200 text-dark/50 hover:border-gold/40 hover:text-dark'
                  }`}
                >
                  {t.label} <span className="opacity-60">({counts[t.key]})</span>
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white border border-white/90 rounded-2xl shadow-sm max-w-lg mx-auto p-12 text-center">
                <div className="w-14 h-14 rounded-full bg-dark/5 flex items-center justify-center mx-auto mb-4">
                  <CalendarX className="h-6 w-6 text-gold" />
                </div>
                <p className="text-dark text-lg mb-1 font-light">No {filter} bookings</p>
                <p className="text-dark/40 text-sm mb-5">Try a different filter or make a new booking.</p>
                <button onClick={() => setFilter('all')} className="text-gold text-sm uppercase tracking-wider hover:underline font-medium">
                  View all bookings
                </button>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {filtered.map((r: PublicReservation) => {
                  const sStyle = STATUS_STYLES[r.status] || STATUS_STYLES.pending
                  const StatusIcon = sStyle.icon
                  const pStyle = PAYMENT_STYLES[r.payment_status] || PAYMENT_STYLES.unpaid
                  const PayIcon = pStyle.icon
                  const nights = nightsBetween(r.check_in, r.check_out)

                  return (
                    <div
                      key={r.id}
                      className="bg-white border border-white/90 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:border-gold/30 transition-all duration-300"
                    >
                      {/* Gold accent bar */}
                      <div className="h-0.5 w-full bg-gradient-to-r from-gold/60 via-gold/20 to-transparent" />

                      {/* Header: ref number + status */}
                      <div className="px-5 sm:px-6 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-gray-100">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-dark/30">Reference</p>
                          <p className="text-sm font-mono tracking-wider text-dark truncate">{r.reservation_number}</p>
                        </div>
                        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider shrink-0 ${sStyle.bg} ${sStyle.text}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {r.status.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Body: room image + info */}
                      <div className="p-5 sm:p-6 flex gap-4">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 bg-dark/5 border border-gray-100">
                          <img
                            src={getRoomImageUrl(r)}
                            alt={r.room?.room_type?.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-serif text-lg text-dark font-light">{r.room?.room_type?.name}</h3>
                          <p className="text-sm text-dark/50 mt-0.5">
                            <MapPin className="h-3 w-3 inline mr-1 text-gold/60" />
                            Room {r.room?.room_number} · Floor {r.room?.floor}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            <span className="flex items-center gap-1.5 bg-dark/5 px-2.5 py-1 rounded-full text-xs text-dark/60">
                              <CalendarDays className="h-3 w-3 text-gold/70" />
                              {formatDateDisplay(r.check_in)} — {formatDateDisplay(r.check_out)}
                            </span>
                            <span className="flex items-center gap-1.5 bg-dark/5 px-2.5 py-1 rounded-full text-xs text-dark/60">
                              <Moon className="h-3 w-3 text-gold/70" />
                              {nights} night{nights > 1 ? 's' : ''}
                            </span>
                            <span className="flex items-center gap-1.5 bg-dark/5 px-2.5 py-1 rounded-full text-xs text-dark/60">
                              <Users className="h-3 w-3 text-gold/70" />
                              {r.adults} adult{r.adults > 1 ? 's' : ''}{r.children > 0 ? `, ${r.children} child${r.children > 1 ? 'ren' : ''}` : ''}
                            </span>
                            <span className="flex items-center gap-1.5 bg-dark/5 px-2.5 py-1 rounded-full text-xs text-dark/60">
                              <BedDouble className="h-3 w-3 text-gold/70" />
                              {r.room?.room_type?.bed_type ?? 'Standard'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-2 text-xs text-dark/40">
                            <Clock className="h-3.5 w-3.5 text-gold/60" />
                            <span>Check-out by {checkoutTimeLabel}</span>
                          </div>
                        </div>
                      </div>

                      {/* Footer: pricing + actions */}
                      <div className="px-5 sm:px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
                        <div>
                          <div className="flex items-center gap-3">
                            <p className="text-xs text-dark/30 uppercase tracking-wider">Total</p>
                            <p className="text-2xl font-semibold text-gold-dark">{fmt(r.total_amount)}</p>
                            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${pStyle.bg} ${pStyle.text} ${pStyle.border}`}>
                              <PayIcon className="h-3 w-3" />
                              {r.payment_status.replace('_', ' ')}
                            </span>
                          </div>
                          {r.payment_status === 'partial' && (
                            <p className="mt-1 text-xs text-dark/40">
                              Paid {fmt(r.paid_amount)} · <span className="text-amber-600 font-medium">Balance {fmt(r.due_amount)}</span>
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {(r.payment_status === 'unpaid' || r.payment_status === 'partial') && canPayOnline(r) && (
                            onlineGatewayEnabled ? (
                              <button
                                onClick={() => setPaymentModal(r)}
                                className="btn-gold-sm flex items-center gap-1.5"
                              >
                                Pay Now
                              </button>
                            ) : (
                              <span className="px-3 py-1.5 rounded-lg text-xs bg-amber-100 border border-amber-600/60 text-amber-800 cursor-not-allowed">
                                Online Payment Unavailable
                              </span>
                            )
                          )}
                          {(r.status === 'pending' || r.status === 'confirmed') && (
                            <button
                              onClick={() => { setCancelError(''); setCancelTarget(r) }}
                              className="px-4 py-2 border border-danger/30 text-danger rounded-lg text-xs uppercase tracking-wider hover:bg-danger/5 hover:border-danger/60 transition-all flex items-center gap-1.5"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
        </div>
      </section>

      {/* Cancel Confirmation Modal */}
      {cancelTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { if (!cancelReservation.isPending) { setCancelTarget(null) } }} />
          <div className="relative z-50 w-full max-w-md bg-dark border border-zinc-800 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <XCircle className="h-4 w-4 text-danger" /> Cancel Reservation
              </h3>
              <button onClick={() => setCancelTarget(null)} disabled={cancelReservation.isPending} className="rounded-lg p-1 text-white/30 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl bg-white/[0.04] border border-white/5 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-white/5">
                    <img
                      src={getRoomImageUrl(cancelTarget)}
                      alt={cancelTarget.room?.room_type?.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{cancelTarget.room?.room_type?.name}</p>
                    <p className="text-xs text-white/40">Room {cancelTarget.room?.room_number} · {cancelTarget.reservation_number}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">Stay</p>
                    <p className="text-white/80">{formatDateDisplay(cancelTarget.check_in)} — {formatDateDisplay(cancelTarget.check_out)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">Guests</p>
                    <p className="text-white/80">
                      {cancelTarget.adults} adult{cancelTarget.adults > 1 ? 's' : ''}{cancelTarget.children > 0 ? `, ${cancelTarget.children} child${cancelTarget.children > 1 ? 'ren' : ''}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">Total</p>
                    <p className="text-white/80">{fmt(cancelTarget.total_amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">Payment</p>
                    <p className="text-white/80 capitalize">{cancelTarget.payment_status.replace('_', ' ')}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                <p className="text-xs text-white/60 leading-relaxed">
                  This will cancel your booking and release the room. Refunds, if applicable, are processed separately.
                </p>
              </div>

              {cancellationPolicy && (
                <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  <p className="text-xs text-white/50 leading-relaxed">
                    <span className="text-white/70 font-medium">Cancellation policy: </span>
                    {cancellationPolicy}
                  </p>
                </div>
              )}

              {cancelError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  <p className="text-xs text-danger leading-relaxed">{cancelError}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-white/5 px-6 py-4">
              <button onClick={() => setCancelTarget(null)} disabled={cancelReservation.isPending} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors disabled:opacity-30">
                Keep It
              </button>
              <button
                onClick={() => {
                  setCancelError('')
                  cancelReservation.mutate(cancelTarget.id, {
                    onSuccess: () => setCancelTarget(null),
                    onError: (e) => {
                      const message = e instanceof Error ? e.message : 'Unable to cancel the reservation. Please try again.'
                      setCancelError(message)
                    },
                  })
                }}
                disabled={cancelReservation.isPending}
                className="px-4 py-2 text-sm bg-danger text-white rounded-lg hover:bg-danger/80 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {cancelReservation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Cancel Reservation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { if (!initiateOnline.isPending) { setPaymentModal(null) } }} />
          <div className="relative z-50 w-full max-w-md bg-dark border border-zinc-800 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Wallet className="h-4 w-4 text-gold" /> Make Payment
              </h3>
              <button
                onClick={() => setPaymentModal(null)}
                disabled={initiateOnline.isPending}
                className="rounded-lg p-1 text-white/30 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              {/* Booking summary */}
              <div className="rounded-xl bg-white/[0.04] border border-white/5 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-white/5">
                    <img
                      src={getRoomImageUrl(paymentModal)}
                      alt={paymentModal.room?.room_type?.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{paymentModal.room?.room_type?.name}</p>
                    <p className="text-xs text-white/40">Room {paymentModal.room?.room_number} · {paymentModal.reservation_number}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">Stay</p>
                    <p className="text-white/80">{formatDateDisplay(paymentModal.check_in)} — {formatDateDisplay(paymentModal.check_out)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">Guests</p>
                    <p className="text-white/80">
                      {paymentModal.adults} adult{paymentModal.adults > 1 ? 's' : ''}{paymentModal.children > 0 ? `, ${paymentModal.children} child${paymentModal.children > 1 ? 'ren' : ''}` : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Amount breakdown */}
              <div className="rounded-xl bg-white/[0.04] border border-white/5 p-4 space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/50">Total</span>
                  <span className="text-white/80">{fmt(paymentModal.total_amount)}</span>
                </div>
                {paymentModal.paid_amount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/50">Paid</span>
                    <span className="text-emerald-400">{fmt(paymentModal.paid_amount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-white/5 pt-2.5">
                  <span className="text-white/70 font-medium">Balance Due</span>
                  <span className="text-xl font-semibold text-gold">{fmt(paymentModal.due_amount)}</span>
                </div>
              </div>

              {/* Security reassurance */}
              <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <p className="text-xs text-white/50 leading-relaxed">
                  You will be redirected to our secure payment partner to complete your payment of{' '}
                  <span className="text-gold font-semibold">{fmt(paymentModal.due_amount)}</span>. Do not close this window during redirect.
                </p>
              </div>

              {initiateOnline.isError && (
                <div className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/10 px-3.5 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <p className="text-xs text-red-400 leading-relaxed">
                    {(initiateOnline.error as Error)?.message}
                  </p>
                </div>
              )}

              <button
                onClick={handleStartOnlinePayment}
                disabled={initiateOnline.isPending}
                className="w-full bg-gold text-dark font-semibold rounded-lg py-3 text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-gold/90 transition-colors disabled:opacity-50"
              >
                {initiateOnline.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {initiateOnline.isPending ? 'Redirecting...' : 'Continue to Secure Payment'}
              </button>
            </div>
            <div className="flex items-center justify-end border-t border-white/5 px-6 py-4">
              <button
                onClick={() => setPaymentModal(null)}
                disabled={initiateOnline.isPending}
                className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors disabled:opacity-30"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
