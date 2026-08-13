import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePublicReservations, usePublicCancelReservation, usePublicCreatePayment, usePublicInitiateOnlinePayment, usePublicSettings, useHotelName, usePaymentSettings, usePortalCurrency } from '@/hooks/usePublicApi'
import { usePublicAuthStore } from '@/stores/publicAuthStore'
import { formatCurrencyWith, formatDateDisplay, formatCheckoutTime } from '@/lib/format'
import type { PublicReservation } from '@/types'
import {
  Calendar, MapPin, XCircle, Loader2, AlertTriangle, X,
  Clock, CheckCircle, RotateCcw, BedDouble, Users,
  LogIn, LogOut, CalendarX, Wallet, QrCode, Copy, CreditCard,
} from 'lucide-react'

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: any }> = {
  pending: { bg: 'bg-yellow-500/10', text: 'text-yellow-600', icon: Clock },
  confirmed: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', icon: CheckCircle },
  checked_in: { bg: 'bg-sky-500/10', text: 'text-sky-600', icon: LogIn },
  checked_out: { bg: 'bg-gray-100', text: 'text-gray-500', icon: LogOut },
  cancelled: { bg: 'bg-danger/10', text: 'text-danger', icon: XCircle },
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

export default function PublicMyReservationsPage() {
  const { token } = usePublicAuthStore()
  const hotelName = useHotelName()
  const { data, isLoading } = usePublicReservations()
  const cancelReservation = usePublicCancelReservation()
  const createPayment = usePublicCreatePayment()
  const initiateOnline = usePublicInitiateOnlinePayment()
  const currency = usePortalCurrency()
  const fmt = (amount: number) => formatCurrencyWith(amount, currency)
  const { data: bookingSettings } = usePublicSettings('booking')
  const booking = (bookingSettings ?? {}) as Record<string, unknown>
  const checkoutTimeLabel = formatCheckoutTime(typeof booking['check_out_time'] === 'string' ? booking['check_out_time'] : '12:00')
  const paymentSettings = usePaymentSettings()
  const onlineEnabled = paymentSettings['online_payment_enabled'] === '1' || paymentSettings['online_payment_enabled'] === true
  const gcashAccount = (paymentSettings['gcash_account'] as string) || ''
  const gcashQrImage = (paymentSettings['gcash_qr_image'] as string) || ''
  const onlineGatewayEnabled = paymentSettings['online_gateway_enabled'] === '1' || paymentSettings['online_gateway_enabled'] === true
  const [cancelId, setCancelId] = useState<number | null>(null)
  const [paymentModal, setPaymentModal] = useState<PublicReservation | null>(null)
  const [payMode, setPayMode] = useState<'gcash' | 'online'>('gcash')
  const [gcashRefNumber, setGcashRefNumber] = useState('')
  const [copied, setCopied] = useState(false)

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

  const handleCopyAccount = async () => {
    try {
      await navigator.clipboard.writeText(gcashAccount.replace(/-/g, ''))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard not available
    }
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

  const reservations = data?.data ?? []

  return (
    <div className="min-h-screen bg-dark">
      <section className="bg-dark border-b border-white/5 py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="section-subtitle mb-3">My Bookings</p>
          <h1 className="font-serif text-white text-4xl font-light mb-2">My Reservations</h1>
          <div className="gold-line-left mt-4" />
        </div>
      </section>

      <section className="bg-cream py-16 px-4">
        <div className="max-w-5xl mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
          </div>
        ) : reservations.length === 0 ? (
          <div className="bg-[#e8e6e1] border border-gray-300 shadow-sm rounded-2xl max-w-lg mx-auto p-16 text-center">
            <div className="w-16 h-16 rounded-full bg-dark/5 flex items-center justify-center mx-auto mb-5">
              <CalendarX className="h-7 w-7 text-gold" />
            </div>
            <p className="text-dark text-lg mb-2 font-light">No upcoming stays yet</p>
            <p className="text-dark/40 text-sm mb-6">Browse our rooms and book your cozy escape in Pampanga.</p>
            <Link to="/public/rooms" className="btn-gold inline-block">Browse Rooms</Link>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {reservations.map((r: PublicReservation) => {
              const sStyle = STATUS_STYLES[r.status] || STATUS_STYLES.pending
              const StatusIcon = sStyle.icon
              const pStyle = PAYMENT_STYLES[r.payment_status] || PAYMENT_STYLES.unpaid
              const PayIcon = pStyle.icon

              return (
                <div
                  key={r.id}
                  className="bg-[#e8e6e1] border border-gray-300 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:border-gold/30 group transition-all duration-300"
                >
                  {/* Gold accent bar */}
                  <div className="h-0.5 w-full bg-gradient-to-r from-gold/60 via-gold/20 to-transparent" />

                  {/* Header: ref number + status */}
                  <div className="px-6 sm:px-8 pt-5 pb-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-dark/30">Reference</p>
                        <p className="text-base font-mono tracking-wider text-dark">{r.reservation_number}</p>
                      </div>
                      <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider ${sStyle.bg} ${sStyle.text}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {r.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Body: room thumbnail + info + dates */}
                    <div className="px-6 sm:px-8 py-5 pb-4">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-dark/5 border border-gray-100">
                        <img
                          src={getThumbUrl(r.room?.room_type?.name ?? '')}
                          alt={r.room?.room_type?.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-serif text-lg font-light text-dark">{r.room?.room_type?.name}</h3>
                        <p className="text-sm text-dark/50 mt-0.5">
                          <MapPin className="h-3 w-3 inline mr-1 text-gold/60" />
                          Room {r.room?.room_number} · Floor {r.room?.floor}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-dark/40">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-dark/20" />
                            {r.adults} adult{r.adults > 1 ? 's' : ''}{r.children > 0 ? `, ${r.children} child${r.children > 1 ? 'ren' : ''}` : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <BedDouble className="h-3 w-3 text-dark/20" />
                            {r.room?.room_type?.bed_type ?? 'Standard'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-dark/40">
                          <Clock className="h-3.5 w-3.5 text-gold/60" />
                          <span>Check-out by {checkoutTimeLabel}</span>
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-2 text-sm text-dark/50 shrink-0">
                        <Calendar className="h-4 w-4 text-gold/60" />
                        <span className="whitespace-nowrap">{formatDateDisplay(r.check_in)} — {formatDateDisplay(r.check_out)}</span>
                      </div>
                    </div>
                    <div className="sm:hidden mt-3 flex items-center gap-2 text-sm text-dark/50">
                      <Calendar className="h-4 w-4 text-gold/60" />
                      <span>{formatDateDisplay(r.check_in)} — {formatDateDisplay(r.check_out)}</span>
                    </div>
                  </div>

                  {/* Footer: pricing + actions */}
                  <div className="px-6 sm:px-8 py-5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-dark/30 uppercase tracking-wider">Total</p>
                      <p className="text-2xl font-semibold text-gold-dark">{fmt(r.total_amount)}</p>
                      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${pStyle.bg} ${pStyle.text} ${pStyle.border}`}>
                        <PayIcon className="h-3 w-3" />
                        {r.payment_status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
{(r.payment_status === 'unpaid' || r.payment_status === 'partial') && (
  (onlineEnabled || onlineGatewayEnabled) ? (
    <button
      onClick={() => {
        setGcashRefNumber('')
        setCopied(false)
        setPayMode(onlineEnabled === false ? 'online' : 'gcash')
        setPaymentModal(r)
      }}
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
                          onClick={() => setCancelId(r.id)}
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
        </div>
      </section>

      {/* Cancel Confirmation Modal */}
      {cancelId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCancelId(null)} />
          <div className="relative z-50 w-full max-w-sm bg-dark border border-zinc-800 rounded-2xl shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-danger" /> Cancel Reservation
              </h3>
              <button onClick={() => setCancelId(null)} className="rounded-lg p-1 text-white/30 hover:text-white hover:bg-white/5 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-white/70 text-sm leading-relaxed">
                Are you sure you want to cancel this reservation? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-white/5 px-6 py-4">
              <button onClick={() => setCancelId(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">
                Keep It
              </button>
              <button
                onClick={() => {
                  cancelReservation.mutate(cancelId)
                  setCancelId(null)
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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { if (!createPayment.isPending && !initiateOnline.isPending) { setPaymentModal(null) } }} />
          <div className="relative z-50 w-full max-w-sm bg-dark border border-zinc-800 rounded-2xl shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Wallet className="h-4 w-4 text-gold" /> Make Payment
              </h3>
              <button
                onClick={() => setPaymentModal(null)}
                disabled={createPayment.isPending || initiateOnline.isPending}
                className="rounded-lg p-1 text-white/30 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Reference</span>
                <span className="text-white font-mono tracking-wider">{paymentModal.reservation_number}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Amount Due</span>
                <span className="text-xl font-semibold text-gold">{fmt(paymentModal.total_amount)}</span>
              </div>

              {onlineEnabled && onlineGatewayEnabled && (
                <div className="flex gap-2 bg-white/[0.03] border border-white/5 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setPayMode('gcash')}
                    className={`flex-1 py-2 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${payMode === 'gcash' ? 'bg-gold text-dark' : 'text-white/50 hover:text-white'}`}
                  >
                    GCash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMode('online')}
                    className={`flex-1 py-2 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${payMode === 'online' ? 'bg-gold text-dark' : 'text-white/50 hover:text-white'}`}
                  >
                    Pay Online
                  </button>
                </div>
              )}

              {payMode === 'gcash' && (
                <div className="border-t border-white/5 pt-4">
                  <div className="space-y-4">
                    <div className="bg-white/[0.03] border border-dashed border-white/10 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-3">
                      <div className="w-48 h-48 rounded-lg overflow-hidden flex items-center justify-center bg-white p-2 mx-auto">
                        {gcashQrImage ? (
                          <img src={gcashQrImage} alt="GCash QR Code" className="w-full h-full object-contain" />
                        ) : (
                          <QrCode className="h-12 w-12 text-zinc-400" />
                        )}
                      </div>
                      <p className="text-sm text-white/60">Scan the QR code to pay via GCash</p>
                      <p className="text-[11px] text-white/30">Send the exact amount and enter the reference number below</p>
                    </div>
                    <div className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-lg px-4 py-3">
                      <div>
                        <p className="text-[11px] text-white/30 uppercase tracking-wider">GCash Account</p>
                        <p className="text-sm text-white">{hotelName}</p>
                        <p className="text-sm text-gold font-mono tracking-wider mt-0.5">{gcashAccount || 'Not configured'}</p>
                      </div>
                      {gcashAccount && (
                        <button
                          onClick={handleCopyAccount}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white hover:border-white/20 hover:bg-white/[0.03] transition-all shrink-0"
                        >
                          {copied ? (
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          {copied ? 'Copied!' : 'Copy'}
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-white/30 uppercase tracking-wider block mb-2">GCash Reference Number</label>
                      <p className="text-[11px] text-white/20 mb-2">Check your GCash SMS receipt for the reference number</p>
                      <input
                        type="text"
                        value={gcashRefNumber}
                        onChange={(e) => setGcashRefNumber(e.target.value)}
                        placeholder="e.g. 1234 5678 9012 3456"
                        className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}

              {payMode === 'online' && (
                <div className="border-t border-white/5 pt-4 space-y-4">
                  <div className="bg-white/[0.03] border border-dashed border-white/10 rounded-xl p-5">
                    <p className="text-sm text-white/70 text-center leading-relaxed">
                      You will be redirected to our secure payment partner to complete your payment of{' '}
                      <span className="text-gold font-semibold">{fmt(paymentModal.total_amount)}</span>.
                    </p>
                  </div>
                  {initiateOnline.isError && (
                    <p className="text-xs text-red-400 text-center leading-relaxed">
                      {(initiateOnline.error as Error)?.message}
                    </p>
                  )}
                  <button
                    onClick={handleStartOnlinePayment}
                    disabled={initiateOnline.isPending}
                    className="w-full bg-gold text-dark font-semibold rounded-lg py-3 text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-gold/90 transition-colors disabled:opacity-50"
                  >
                    {initiateOnline.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    {initiateOnline.isPending ? 'Redirecting...' : 'Continue to Payment'}
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-white/5 px-6 py-4">
              <button
                onClick={() => setPaymentModal(null)}
                disabled={createPayment.isPending || initiateOnline.isPending}
                className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors disabled:opacity-30"
              >
                Cancel
              </button>
              {payMode === 'gcash' && (
                <button
                  onClick={() => {
                    createPayment.mutate(
                      {
                        reservation_id: paymentModal.id,
                        amount: paymentModal.total_amount,
                        payment_method: 'gcash',
                        payment_type: 'full',
                        ...(gcashRefNumber.trim() ? { reference_number: gcashRefNumber.trim() } : {}),
                      },
                      { onSuccess: () => setPaymentModal(null) },
                    )
                  }}
                  disabled={createPayment.isPending}
                  className="btn-gold-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {createPayment.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wallet className="h-4 w-4" />
                  )}
                  {createPayment.isPending ? 'Processing...' : `Pay ${fmt(paymentModal.total_amount)}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
