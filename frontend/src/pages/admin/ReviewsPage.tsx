import { useState } from 'react'
import { useReviews, useApproveReview, useDeleteReview, useReplyToReview } from '@/hooks/useApi'
import type { Review } from '@/types'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { Star, Check, Trash2, MessageSquare, Search, Loader2 } from 'lucide-react'

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`h-4 w-4 ${s <= rating ? 'fill-gold text-gold' : 'text-gray-300'}`} />
      ))}
    </div>
  )
}

export default function ReviewsPage() {
  const [search, setSearch] = useState('')
  const [approvedFilter, setApprovedFilter] = useState('')
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [replyText, setReplyText] = useState('')
  const [showReplyModal, setShowReplyModal] = useState(false)
  const { addToast } = useToast()

  const params: Record<string, string | number | undefined> = { per_page: 20 }
  if (search) params.search = search
  if (approvedFilter) params.approved = approvedFilter

  const { data, isLoading } = useReviews(params)
  const approveReview = useApproveReview()
  const deleteReview = useDeleteReview()
  const replyToReview = useReplyToReview()

  const reviews = data?.data ?? []

  function handleApprove(review: Review) {
    approveReview.mutate(review.id, {
      onSuccess: () => addToast('Review approved', 'success'),
      onError: () => addToast('Failed to approve', 'error'),
    })
  }

  function handleDelete(review: Review) {
    if (!confirm('Delete this review?')) return
    deleteReview.mutate(review.id, {
      onSuccess: () => addToast('Review deleted', 'success'),
      onError: () => addToast('Failed to delete', 'error'),
    })
  }

  function handleReply() {
    if (!selectedReview || !replyText.trim()) return
    replyToReview.mutate(
      { id: selectedReview.id, reply: replyText },
      {
        onSuccess: () => {
          setShowReplyModal(false)
          setReplyText('')
          setSelectedReview(null)
          addToast('Reply saved', 'success')
        },
        onError: () => addToast('Failed to save reply', 'error'),
      },
    )
  }

  return (
    <div>
      <PageHeader title="Guest Reviews" description="Moderate and respond to guest reviews" />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input placeholder="Search reviews..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={approvedFilter} onChange={(e) => setApprovedFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="1">Approved</option>
            <option value="0">Pending</option>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/50" />)}
        </div>
      ) : reviews.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted">No reviews found</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((review: Review) => (
            <Card key={review.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-foreground">{[review.guest?.first_name, review.guest?.last_name].filter(Boolean).join(' ') || '—'}</p>
                    <StarRating rating={review.rating} />
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${review.is_approved ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                      {review.is_approved ? 'Approved' : 'Pending'}
                    </span>
                  </div>
                  {review.title && <p className="mt-1 text-sm font-medium text-foreground">{review.title}</p>}
                  {review.comment && <p className="mt-1 text-sm text-muted">{review.comment}</p>}
                  <p className="mt-2 text-xs text-muted">
                    {review.room_type?.name} — {new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  {review.admin_reply && (
                    <div className="mt-3 rounded-xl bg-bg p-3">
                      <p className="text-xs font-medium text-muted">Admin Reply:</p>
                      <p className="mt-1 text-sm text-foreground">{review.admin_reply}</p>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!review.is_approved && (
                    <Button variant="ghost" size="sm" onClick={() => handleApprove(review)} disabled={approveReview.isPending}>
                      <Check className="h-4 w-4 text-success" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedReview(review); setReplyText(review.admin_reply || ''); setShowReplyModal(true) }}>
                    <MessageSquare className="h-4 w-4 text-muted" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(review)} disabled={deleteReview.isPending}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showReplyModal} onClose={() => setShowReplyModal(false)} title="Reply to Review" size="md">
        {selectedReview && (
          <div className="space-y-4">
            <div className="rounded-xl bg-bg p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{[selectedReview.guest?.first_name, selectedReview.guest?.last_name].filter(Boolean).join(' ')}</span>
                <StarRating rating={selectedReview.rating} />
              </div>
              {selectedReview.comment && <p className="mt-1 text-xs text-muted">{selectedReview.comment}</p>}
            </div>
            <textarea
              rows={3}
              placeholder="Write your reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-bg px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowReplyModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleReply} disabled={!replyText.trim() || replyToReview.isPending}>
                {replyToReview.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Reply'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
