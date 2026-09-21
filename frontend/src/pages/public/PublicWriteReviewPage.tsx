import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePublicReservation, useSubmitReview } from '@/hooks/usePublicApi'
import { Button } from '@/components/ui/button'
import { Star, Loader2, CheckCircle, ArrowLeft, Quote, Shield, Calendar, Users, BedDouble } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

const RATING_LABELS: Record<number, string> = {
  1: 'Terrible',
  2: 'Poor',
  3: 'Average',
  4: 'Very Good',
  5: 'Exceptional Stay',
}

export default function PublicWriteReviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { data: reservation, isLoading } = usePublicReservation(id ? Number(id) : undefined)
  const submitReview = useSubmitReview()

  const [rating, setRating] = useState(0)
  const [hoveredStar, setHoveredStar] = useState(0)
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const canReview = reservation?.status === 'checked_out'
  const activeRating = hoveredStar || rating

  function handleSubmit() {
    if (!rating || !id) return
    submitReview.mutate(
      { reservation_id: Number(id), rating, title: title || undefined, comment: comment || undefined },
      {
        onSuccess: () => {
          setSubmitted(true)
          addToast('Your review has been submitted for verification.', 'success')
        },
        onError: (err: any) => {
          addToast(err?.response?.data?.message || 'Failed to submit review', 'error')
        },
      },
    )
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark">
        <div className="bg-dark py-16 px-4 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent mx-auto" />
        </div>
      </div>
    )
  }

  if (!reservation || !canReview) {
    return (
      <div className="min-h-screen bg-dark">
        <div className="bg-dark py-16 px-4 text-center">
          <h1 className="text-3xl font-serif text-white">Write a Review</h1>
        </div>
        <div className="mx-auto max-w-2xl px-4 py-12">
          <div className="rounded-2xl bg-white/[0.06] border border-white/[0.08] p-8 text-center">
            <p className="text-white/50">This reservation is not eligible for a review.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/public/my-reservations')}>Back to My Reservations</Button>
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center px-4">
        <div className="rounded-2xl bg-white/[0.06] border border-amber-500/20 shadow-2xl backdrop-blur-md p-12 text-center max-w-md w-full animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-gold" />
          </div>
          <h2 className="text-2xl font-serif text-white mb-2">Thank you for your review!</h2>
          <p className="text-white/40 text-sm mb-8">Your review has been submitted for verification by our management team. It will appear on the room page once approved.</p>
          <Button variant="primary" className="w-full" onClick={() => navigate('/public/my-reservations')}>
            Back to My Reservations
          </Button>
        </div>
      </div>
    )
  }

  const roomImage = reservation.room?.image_url || reservation.room?.room_type?.image_url

  const nights = (() => {
    const ci = new Date(reservation.check_in)
    const co = new Date(reservation.check_out)
    return Math.max(1, Math.round((co.getTime() - ci.getTime()) / 86400000))
  })()

  const guestCount = (reservation.adults || 0) + (reservation.children || 0)

  return (
    <div className="min-h-screen bg-dark">
      {/* Header */}
      <div className="bg-dark py-12 px-4 text-center border-b border-white/5">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-white/30 text-xs hover:text-white/60 transition-colors mb-6">
          <ArrowLeft className="h-3 w-3" /> Back
        </button>
        <h1 className="text-3xl font-serif text-white mb-2">Write a Review</h1>
        <p className="text-white/40 text-sm">Share your experience at Pampanga Home Suites</p>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-10">
        {/* Floating Card */}
        <div className="bg-white/[0.06] border border-amber-500/20 shadow-2xl backdrop-blur-md rounded-2xl overflow-hidden">

          {/* Hero Stay Info Card */}
          <div className="bg-slate-900/80 border-b border-amber-500/20 p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Room Thumbnail */}
              {roomImage && (
                <img
                  src={roomImage}
                  alt={reservation.room?.room_type?.name || 'Room'}
                  className="w-28 h-20 md:w-36 md:h-24 object-cover rounded-lg border border-amber-500/20 shrink-0"
                />
              )}

              {/* Center Details */}
              <div className="flex-1 min-w-0">
                <h2 className="font-serif text-lg text-white truncate">{reservation.room?.room_type?.name}</h2>
                <div className="flex items-center gap-1.5 mt-1.5 text-amber-400/70">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="text-xs">
                    {formatDate(reservation.check_in)} — {formatDate(reservation.check_out)}
                    <span className="text-white/30 ml-1.5">({nights} Night{nights !== 1 ? 's' : ''})</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  {guestCount > 0 && (
                    <span className="inline-flex items-center gap-1 bg-white/5 rounded-full px-2.5 py-0.5 text-[11px] text-white/50">
                      <Users className="h-3 w-3" /> {guestCount} Guest{guestCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {reservation.room?.bed_type && (
                    <span className="inline-flex items-center gap-1 bg-white/5 rounded-full px-2.5 py-0.5 text-[11px] text-white/50">
                      <BedDouble className="h-3 w-3" /> {reservation.room.bed_type}
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Booking Ref + Verified */}
              <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 shrink-0">
                <span className="text-[10px] uppercase tracking-wider text-white/30 font-medium bg-white/5 rounded-lg px-2.5 py-1">
                  #{reservation.reservation_number}
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-medium">
                  <Shield className="h-3.5 w-3.5" /> Verified Stay
                </span>
              </div>
            </div>
          </div>

          {/* Star Rating */}
          <div className="text-center pt-8 pb-6 px-6">
            <p className="text-white/40 text-xs uppercase tracking-[0.2em] mb-5 font-medium">How was your stay?</p>
            <div className="flex items-center justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="p-1 transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none"
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => setRating(star)}
                >
                  <Star
                    className={`h-11 w-11 sm:h-13 sm:w-13 transition-all duration-300 ${
                      star <= activeRating
                        ? 'fill-[#D4AF37] text-[#D4AF37] drop-shadow-[0_0_10px_rgba(212,175,55,0.35)]'
                        : 'text-white/15 hover:text-[#C5A880]/40'
                    }`}
                  />
                </button>
              ))}
            </div>
            {activeRating > 0 && (
              <div className="mt-4 animate-fade-in">
                <p className="font-serif text-lg text-gold tracking-wide">
                  {activeRating} / 5 — {RATING_LABELS[activeRating]}
                </p>
              </div>
            )}
          </div>

          {/* Form */}
          <div className="px-6 pb-6 space-y-5">
            {/* Title */}
            <div>
              <label className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2 font-medium">
                Review Title <span className="text-white/20">(optional)</span>
              </label>
              <div className="relative">
                <Quote className="absolute left-3 top-3 h-4 w-4 text-white/20" />
                <input
                  type="text"
                  placeholder="Sum up your experience"
                  value={title}
                  maxLength={100}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-800/50 border border-white/[0.08] rounded-xl pl-10 pr-12 py-3 text-sm text-white placeholder:text-white/25 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 focus:outline-none transition-all"
                />
                <span className="absolute right-3 top-3 text-[10px] text-white/20 tabular-nums">{title.length}/100</span>
              </div>
              <p className="text-[10px] text-white/15 mt-1">Maximum 100 characters</p>
            </div>

            {/* Comment */}
            <div>
              <label className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2 font-medium">
                Your Review <span className="text-white/20">(optional)</span>
              </label>
              <textarea
                rows={4}
                placeholder="Tell other guests about your experience..."
                value={comment}
                maxLength={1000}
                onChange={(e) => setComment(e.target.value)}
                className="w-full bg-slate-800/50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 focus:outline-none resize-none transition-all"
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-[10px] text-white/15">Tell us about the room, service, and atmosphere</p>
                <span className="text-[10px] text-white/20 tabular-nums">{comment.length}/1000</span>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={handleSubmit}
              disabled={!rating || submitReview.isPending}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-semibold text-sm tracking-wide hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 flex items-center justify-center gap-2"
            >
              {submitReview.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
              ) : (
                'Submit Review'
              )}
            </button>

            {/* Trust Note */}
            <p className="text-center text-[11px] text-white/25 leading-relaxed">
              Your review will be submitted for verification by Pampanga Home Suites management before publication.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
