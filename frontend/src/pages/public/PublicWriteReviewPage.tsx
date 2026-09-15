import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePublicReservation, useSubmitReview } from '@/hooks/usePublicApi'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Star, Loader2, CheckCircle } from 'lucide-react'
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

  function handleSubmit() {
    if (!rating || !id) return
    submitReview.mutate(
      { reservation_id: Number(id), rating, title: title || undefined, comment: comment || undefined },
      {
        onSuccess: () => {
          setSubmitted(true)
          addToast('Review submitted! It will appear after approval.', 'success')
        },
        onError: (err: any) => {
          addToast(err?.response?.data?.message || 'Failed to submit review', 'error')
        },
      },
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="bg-dark py-16 px-4 text-center">
          <h1 className="text-3xl font-serif text-white">Write a Review</h1>
        </div>
        <div className="mx-auto max-w-2xl px-4 py-12">
          <div className="h-64 animate-pulse rounded-2xl bg-white/50" />
        </div>
      </div>
    )
  }

  if (!reservation || !canReview) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="bg-dark py-16 px-4 text-center">
          <h1 className="text-3xl font-serif text-white">Write a Review</h1>
        </div>
        <div className="mx-auto max-w-2xl px-4 py-12">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-muted">This reservation is not eligible for a review.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/public/my-reservations')}>
              Back to My Reservations
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="bg-dark py-16 px-4 text-center">
          <h1 className="text-3xl font-serif text-white">Write a Review</h1>
        </div>
        <div className="mx-auto max-w-2xl px-4 py-12">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-success" />
            <h2 className="mb-2 text-lg font-semibold text-foreground">Thank you for your review!</h2>
            <p className="text-sm text-muted">Your review will appear on the room page after admin approval.</p>
            <Button variant="primary" className="mt-6" onClick={() => navigate('/public/my-reservations')}>
              Back to My Reservations
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="bg-dark py-16 px-4 text-center">
        <h1 className="text-3xl font-serif text-white">Write a Review</h1>
        <p className="mt-2 text-white/60">{reservation.room?.room_type?.name} — {reservation.reservation_number}</p>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          {/* Star Rating */}
          <div className="mb-6 text-center">
            <label className="mb-3 block text-sm font-medium text-foreground">Overall Rating</label>
            <div className="flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="p-1 transition-transform hover:scale-110"
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => setRating(star)}
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      star <= (hoveredStar || rating)
                        ? 'fill-gold text-gold'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="mt-2 text-sm text-muted">
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </p>
            )}
          </div>

          {/* Title */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-foreground">Review Title (optional)</label>
            <input
              type="text"
              placeholder="Sum up your experience in a few words"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-bg px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>

          {/* Comment */}
          <div className="mb-6">
            <label className="mb-1 block text-sm font-medium text-foreground">Your Review (optional)</label>
            <textarea
              rows={4}
              placeholder="Tell other guests about your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-bg px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>

          {/* Submit */}
          <Button
            variant="primary"
            className="w-full"
            onClick={handleSubmit}
            disabled={!rating || submitReview.isPending}
          >
            {submitReview.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
            ) : (
              'Submit Review'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
