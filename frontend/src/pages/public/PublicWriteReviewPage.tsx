import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePublicReservation, useSubmitReview } from '@/hooks/usePublicApi'
import { Button } from '@/components/ui/button'
import { Star, Loader2, CheckCircle, ArrowLeft, Sparkles, Quote } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

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

  const sentimentMap: Record<number, { label: string; emoji: string }> = {
    1: { label: 'Poor', emoji: '😞' },
    2: { label: 'Fair', emoji: '😐' },
    3: { label: 'Good', emoji: '🙂' },
    4: { label: 'Very Good', emoji: '😊' },
    5: { label: 'Excellent', emoji: '🤩' },
  }

  function handleSubmit() {
    if (!rating || !id) return
    submitReview.mutate(
      { reservation_id: Number(id), rating, title: title || undefined, comment: comment || undefined },
      {
        onSuccess: () => {
          setSubmitted(true)
          addToast('Your review has been published!', 'success')
        },
        onError: (err: any) => {
          addToast(err?.response?.data?.message || 'Failed to submit review', 'error')
        },
      },
    )
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
        <div className="rounded-2xl bg-white/[0.06] border border-white/[0.08] p-12 text-center max-w-md w-full animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-gold" />
          </div>
          <h2 className="text-xl font-serif text-white mb-2">Thank you for your review!</h2>
          <p className="text-white/40 text-sm mb-8">Your review is now live on the room page.</p>
          <Button variant="primary" className="w-full" onClick={() => navigate('/public/my-reservations')}>
            Back to My Reservations
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark">
      <div className="bg-dark py-12 px-4 text-center border-b border-white/5">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-white/30 text-xs hover:text-white/60 transition-colors mb-6">
          <ArrowLeft className="h-3 w-3" /> Back
        </button>
        <h1 className="text-3xl font-serif text-white mb-2">Write a Review</h1>
        <p className="text-white/40 text-sm">{reservation.room?.room_type?.name} — {reservation.reservation_number}</p>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-10">
        {/* Star Rating */}
        <div className="text-center mb-10">
          <p className="text-white/40 text-xs uppercase tracking-[0.2em] mb-5 font-medium">How was your stay?</p>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="p-1 transition-all duration-200 hover:scale-125 active:scale-95"
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
                onClick={() => setRating(star)}
              >
                <Star
                  className={`h-10 w-10 sm:h-12 sm:w-12 transition-all duration-200 ${
                    star <= activeRating
                      ? 'fill-gold text-gold drop-shadow-[0_0_8px_rgba(192,160,98,0.4)]'
                      : 'text-white/15'
                  }`}
                />
              </button>
            ))}
          </div>
          {activeRating > 0 && (
            <div className="mt-4 animate-fade-in">
              <span className="text-2xl mr-2">{sentimentMap[activeRating]?.emoji}</span>
              <span className="text-white/60 text-sm font-medium">{sentimentMap[activeRating]?.label}</span>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-6 sm:p-8 space-y-5">
          <div>
            <label className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Review Title <span className="text-white/15">(optional)</span></label>
            <div className="relative">
              <Quote className="absolute left-3 top-3 h-4 w-4 text-white/20" />
              <input
                type="text"
                placeholder="Sum up your experience"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-gold/50 focus:outline-none transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Your Review <span className="text-white/15">(optional)</span></label>
            <textarea
              rows={4}
              placeholder="Tell other guests about your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-gold/50 focus:outline-none resize-none transition-colors"
            />
          </div>
          <Button
            variant="primary"
            className="w-full"
            onClick={handleSubmit}
            disabled={!rating || submitReview.isPending}
          >
            {submitReview.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Submit Review</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
