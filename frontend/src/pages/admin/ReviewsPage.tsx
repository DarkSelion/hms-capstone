import { useState } from 'react'
import { useReviews, useApproveReview, useRejectReview, useDeleteReview, useReplyToReview } from '@/hooks/useApi'
import type { Review, ReviewKPIs } from '@/types'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { Star, Check, X, Trash2, MessageSquare, Search, Loader2, StarHalf, TrendingUp, Clock } from 'lucide-react'

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`h-4 w-4 ${s <= rating ? 'fill-gold text-gold' : 'text-gray-300'}`} />
      ))}
    </div>
  )
}

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
] as const

function KPICard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-gold" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted">{label}</p>
        </div>
      </div>
      {sub && <p className="text-[11px] text-muted mt-1">{sub}</p>}
    </Card>
  )
}

export default function ReviewsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [ratingFilter, setRatingFilter] = useState('')
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [replyText, setReplyText] = useState('')
  const [showReplyModal, setShowReplyModal] = useState(false)
  const { addToast } = useToast()

  const params: Record<string, string | number | undefined> = { per_page: 20 }
  if (search) params.search = search
  if (statusFilter) params.status = statusFilter
  if (ratingFilter) params.rating = ratingFilter

  const { data, isLoading } = useReviews(params)
  const approveReview = useApproveReview()
  const rejectReview = useRejectReview()
  const deleteReview = useDeleteReview()
  const replyToReview = useReplyToReview()

  const reviews = data?.data ?? []
  const kpis = data?.kpis as ReviewKPIs | undefined

  function handleApprove(review: Review) {
    approveReview.mutate(review.id, {
      onSuccess: () => addToast('Review approved', 'success'),
      onError: () => addToast('Failed to approve', 'error'),
    })
  }

  function handleReject(review: Review) {
    rejectReview.mutate(review.id, {
      onSuccess: () => addToast('Review rejected', 'success'),
      onError: () => addToast('Failed to reject', 'error'),
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

  function getStatusBadge(review: Review) {
    switch (review.status) {
      case 'approved':
        return <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-success/10 text-success">Approved</span>
      case 'rejected':
        return <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-danger/10 text-danger">Rejected</span>
      default:
        return <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-warning/10 text-warning">Pending</span>
    }
  }

  return (
    <div>
      <PageHeader title="Guest Reviews" description="Moderate and respond to guest reviews" />

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard icon={Star} label="Total Reviews" value={kpis.total} />
          <KPICard icon={Clock} label="Pending Approval" value={kpis.pending_count} />
          <KPICard icon={StarHalf} label="Average Rating" value={kpis.avg_rating > 0 ? `${kpis.avg_rating.toFixed(1)} / 5` : '—'} sub={`${kpis.approved_count} approved reviews`} />
          <KPICard icon={TrendingUp} label="Response Rate" value={kpis.response_rate > 0 ? `${kpis.response_rate}%` : '—'} sub={`${kpis.approved_count > 0 ? Math.round(kpis.response_rate * kpis.approved_count / 100) : 0} of ${kpis.approved_count} replied`} />
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {STATUS_TABS.map((tab) => {
          const count = kpis
            ? tab.value === '' ? kpis.total
              : tab.value === 'pending' ? kpis.pending_count
              : tab.value === 'approved' ? kpis.approved_count
              : kpis.rejected_count
            : 0
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-gold text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                statusFilter === tab.value ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input placeholder="Search reviews..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)}>
            <option value="">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
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
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{[review.guest?.first_name, review.guest?.last_name].filter(Boolean).join(' ') || '—'}</p>
                    <StarRating rating={review.rating} />
                    {getStatusBadge(review)}
                    {review.is_verified_stay && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-success bg-success/5 rounded-full px-2 py-0.5">
                        <Check className="h-3 w-3" /> Verified
                      </span>
                    )}
                  </div>
                  {review.title && <p className="mt-1 text-sm font-medium text-foreground">{review.title}</p>}
                  {review.comment && <p className="mt-1 text-sm text-muted">{review.comment}</p>}
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                    <span>{review.room_type?.name || '—'}</span>
                    {review.reservation && (
                      <span className="text-primary">#{review.reservation.booking_number || review.reservation.id}</span>
                    )}
                    {review.guest?.email && <span>{review.guest.email}</span>}
                    <span>{new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  {review.admin_response && (
                    <div className="mt-3 rounded-xl bg-bg p-3">
                      <p className="text-xs font-medium text-muted">Your Reply:</p>
                      <p className="mt-1 text-sm text-foreground">{review.admin_response}</p>
                      {review.admin_replied_at && (
                        <p className="text-[10px] text-muted mt-1">{new Date(review.admin_replied_at).toLocaleDateString()}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {review.status === 'pending' && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => handleApprove(review)} disabled={approveReview.isPending} title="Approve">
                        <Check className="h-4 w-4 text-success" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleReject(review)} disabled={rejectReview.isPending} title="Reject">
                        <X className="h-4 w-4 text-danger" />
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedReview(review); setReplyText(review.admin_response || ''); setShowReplyModal(true) }} title="Reply">
                    <MessageSquare className="h-4 w-4 text-muted" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(review)} disabled={deleteReview.isPending} title="Delete">
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
              {selectedReview.title && <p className="mt-1 text-xs font-medium text-foreground">{selectedReview.title}</p>}
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
