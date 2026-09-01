import { useState, useMemo } from 'react'
import { usePayments, useReservations, useUpdatePayment } from '@/hooks/useApi'
import type { Payment, Reservation } from '@/types'
import { formatCurrency, formatDateDisplay } from '@/lib/format'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { RowActions, RowActionButton } from '@/components/shared/RowActions'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PaymentModal } from '@/components/shared/PaymentModal'
import { RefundModal } from '@/components/shared/RefundModal'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { DatePicker } from '@/components/ui/date-picker'
import { useToast } from '@/components/ui/toast'
import { PAYMENT_METHODS } from '@/lib/constants'
import {
  Plus, Eye, Banknote, Smartphone, CreditCard,
  AlertCircle, Loader2, UserRound, BedDouble, CalendarDays, ReceiptText, Hash, Wallet, X, RotateCcw,
} from 'lucide-react'

interface PaymentExtended extends Payment {
  reservation?: Reservation
}

const PAYMENT_STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
]

const METHOD_ICONS: Record<string, React.ReactNode> = {
  cash: <Banknote className="h-4 w-4" />,
  gcash: <Smartphone className="h-4 w-4" />,
  online: <CreditCard className="h-4 w-4" />,
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return formatDateDisplay(dateStr)
}

function formatLongDate(dateStr: string) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '-'
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return `${formatDateDisplay(dateStr, 'long')} · ${time}`
}

function methodTileClass(method: string): string {
  switch (method) {
    case 'cash': return 'bg-success/10 text-success'
    case 'gcash': return 'bg-info/10 text-info'
    case 'online': return 'bg-gold/20 text-gold-dark'
    default: return 'bg-border/50 text-muted'
  }
}

function nightsBetween(checkIn?: string, checkOut?: string): number {
  const inDate = new Date(checkIn?.split(/[\sT]/)[0] ?? '')
  const outDate = new Date(checkOut?.split(/[\sT]/)[0] ?? '')
  if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) return 0
  return Math.max(0, Math.round((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24)))
}

export default function PaymentsPage() {
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('-paid_at')
  const [page, setPage] = useState(1)

const [showFormModal, setShowFormModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const { data: refundablePaymentsData } = usePayments({ per_page: 100, status: 'completed' })
  const refundablePayments = (refundablePaymentsData?.data ?? []) as PaymentExtended[]
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<PaymentExtended | null>(null)

  const queryParams = useMemo(() => {
    const params: Record<string, string | number | undefined> = { page, sort: sortBy }
    if (search) params.search = search
    if (methodFilter) params.payment_method = methodFilter
    if (statusFilter) params.status = statusFilter
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    return params
  }, [page, sortBy, search, methodFilter, statusFilter, dateFrom, dateTo])

  const { data: paymentsData, isLoading, error, refetch } = usePayments(queryParams)
  const { data: reservationsData } = useReservations({ per_page: 500, status: 'checked_in,checked_out,confirmed' })
  const updatePayment = useUpdatePayment()
  const { addToast } = useToast()

  const [statusDraft, setStatusDraft] = useState<string | null>(null)

  const payments = (paymentsData?.data ?? []) as PaymentExtended[]
  const reservations = (reservationsData?.data ?? []) as Reservation[]
  const totalPages = paymentsData?.last_page ?? 1

  function handleStatusChange(paymentId: number, status: string) {
    setStatusDraft(status)
    updatePayment.mutate(
      { id: paymentId, data: { status } },
      {
        onSuccess: () => {
          addToast('Payment status updated', 'success')
          setStatusDraft(null)
          refetch()
        },
        onError: () => {
          addToast('Failed to update payment status', 'error')
          setStatusDraft(null)
        },
      },
    )
  }

  function openDetailModal(payment: PaymentExtended) {
    setSelectedPayment(payment)
    setShowDetailModal(true)
  }

  function openNewForm() {
    setShowFormModal(true)
  }

  function closeFormModal() {
    setShowFormModal(false)
  }

  function getMethodLabel(method: string) {
    return PAYMENT_METHODS.find(m => m.value === method)?.label ?? method
  }

  function getGuestName(payment: PaymentExtended) {
    return payment.reservation?.guest
      ? `${payment.reservation.guest.first_name} ${payment.reservation.guest.last_name}`
      : '-'
  }

  function handleSort(key: string) {
    setSortBy(prev => prev === key ? `-${key}` : prev === `-${key}` ? key : key)
  }

  const hasActiveFilters = Boolean(search || methodFilter || statusFilter || dateFrom || dateTo)

  function clearAllFilters() {
    setSearch('')
    setMethodFilter('')
    setStatusFilter('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  function getGuestInitials(payment: PaymentExtended) {
    const name = getGuestName(payment)
    if (name === '-') return '?'
    return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  }

  const columns: Column<PaymentExtended>[] = [
    {
      key: 'reference_number',
      label: 'Reference #',
      sortable: true,
      render: (r) => (
        <button onClick={() => openDetailModal(r)} className="text-primary hover:underline">
          {r.reference_number ?? `PAY-${r.id}`}
        </button>
      ),
    },
    {
      key: 'guest',
      label: 'Guest',
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {getGuestInitials(r)}
          </div>
          <div className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{getGuestName(r)}</span>
            <span className="block truncate text-xs text-muted">
              {r.reservation?.reservation_number ?? `#${r.reservation_id}`}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      className: 'whitespace-nowrap',
      render: (r) => (
        <div className="whitespace-nowrap">
          <span className="text-base font-semibold tabular-nums text-foreground">{formatCurrency(r.amount)}</span>
          {r.payment_type && (
            <span className="block text-xs capitalize text-muted">{r.payment_type}</span>
          )}
        </div>
      ),
    },
    {
      key: 'payment_method',
      label: 'Method',
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${methodTileClass(r.payment_method)}`}>
            {METHOD_ICONS[r.payment_method] ?? <Wallet className="h-4 w-4" />}
          </div>
          <span className="text-sm">{getMethodLabel(r.payment_method)}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'paid_at',
      label: 'Date',
      sortable: true,
      className: 'whitespace-nowrap',
      render: (r) => {
        const d = r.paid_at ?? r.created_at
        const time = d && !isNaN(new Date(d).getTime())
          ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : ''
        return (
          <div className="whitespace-nowrap">
            <span className="font-medium text-foreground">{formatDate(d)}</span>
            {time && <span className="block text-xs text-muted">{time}</span>}
          </div>
        )
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <RowActions>
          <RowActionButton
            tone="neutral"
            title="View"
            icon={<Eye className="h-4 w-4" />}
            onClick={() => openDetailModal(r)}
          />
        </RowActions>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Track and manage all payments."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="gold" onClick={() => setShowRefundModal(true)}>
              <RotateCcw className="h-4 w-4" />
              Record Refund
            </Button>
            <Button variant="gold" onClick={openNewForm}>
              <Plus className="h-4 w-4" />
              Record Payment
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Input
                placeholder="Search by reference or guest name..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <div className="w-44">
              <Select value={methodFilter} onChange={(e) => { setMethodFilter(e.target.value); setPage(1) }}>
                <option value="">All Methods</option>
                {PAYMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </Select>
            </div>
            <div className="w-44">
              <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
                {PAYMENT_STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>
            <div className="w-44">
              <DatePicker value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(1) }} placeholder="From date" clearable />
            </div>
            <div className="w-44">
              <DatePicker value={dateTo} onChange={(v) => { setDateTo(v); setPage(1) }} placeholder="To date" clearable />
            </div>
          </div>

          {/* Active Filter Bar */}
          {hasActiveFilters && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>Active filters:</span>
              {search && (
                <Badge variant="secondary" className="gap-1">
                  Search: {search}
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { setSearch(''); setPage(1) }}>
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {methodFilter && (
                <Badge variant="secondary" className="gap-1">
                  Method: {getMethodLabel(methodFilter)}
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { setMethodFilter(''); setPage(1) }}>
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {statusFilter && (
                <Badge variant="secondary" className="gap-1">
                  Status: {PAYMENT_STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { setStatusFilter(''); setPage(1) }}>
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {dateFrom && (
                <Badge variant="secondary" className="gap-1">
                  From: {dateFrom}
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { setDateFrom(''); setPage(1) }}>
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {dateTo && (
                <Badge variant="secondary" className="gap-1">
                  To: {dateTo}
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { setDateTo(''); setPage(1) }}>
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                Clear all
              </Button>
            </div>
          )}

          <DataTable
            columns={columns}
            data={payments}
            loading={isLoading}
            error={error ? 'Failed to load payments' : null}
            sortBy={sortBy}
            onSort={handleSort}
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <Banknote className="mb-3 h-10 w-10 text-muted/50" />
                <p className="text-sm font-medium text-foreground">No payments match your filters</p>
                <p className="text-sm text-muted">Try adjusting your search or filters.</p>
                {hasActiveFilters && (
                  <Button variant="outline" className="mt-4" onClick={clearAllFilters}>
                    Clear all filters
                  </Button>
                )}
              </div>
            }
            pagination={paymentsData ? {
              currentPage: page,
              lastPage: totalPages,
              total: paymentsData.total,
              from: (paymentsData.current_page - 1) * paymentsData.per_page + 1,
              to: Math.min(paymentsData.current_page * paymentsData.per_page, paymentsData.total),
              onPageChange: setPage,
            } : undefined}
            onRetry={() => refetch()}
            keyExtractor={(r) => r.id}
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Payment Details"
        size="xl"
        footer={
          <Button variant="outline" onClick={() => setShowDetailModal(false)}>
            Close
          </Button>
        }
      >
        {selectedPayment ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${methodTileClass(selectedPayment.payment_method)}`}>
                  {METHOD_ICONS[selectedPayment.payment_method] ?? <Wallet className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {selectedPayment.reference_number ?? `PAY-${selectedPayment.id}`}
                  </p>
                  <p className="text-xs text-muted">{getGuestName(selectedPayment)}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <StatusBadge status={selectedPayment.status} />
                <Badge variant="default">
                  {METHOD_ICONS[selectedPayment.payment_method] ?? null}
                  {getMethodLabel(selectedPayment.payment_method)}
                </Badge>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted">Amount Collected</p>
                  <p className="mt-0.5 text-2xl font-bold text-foreground">{formatCurrency(selectedPayment.amount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-muted">Date</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">{formatLongDate(selectedPayment.paid_at ?? selectedPayment.created_at)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <ReceiptText className="h-3.5 w-3.5" /> Reference Number
                  </p>
                  <p className="break-words text-sm font-semibold text-foreground">
                    {selectedPayment.reference_number ?? `PAY-${selectedPayment.id}`}
                  </p>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <ReceiptText className="h-3.5 w-3.5" /> Receipt Number
                  </p>
                  <p className="text-sm font-semibold text-foreground">RCT-{selectedPayment.id.toString().padStart(5, '0')}</p>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <CreditCard className="h-3.5 w-3.5" /> Status
                  </p>
                  {selectedPayment.status === 'pending' ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={statusDraft ?? selectedPayment.status}
                        onChange={(e) => handleStatusChange(selectedPayment.id, e.target.value)}
                        disabled={updatePayment.isPending}
                      >
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                      </Select>
                      {updatePayment.isPending && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" />}
                    </div>
                  ) : (
                    <div><StatusBadge status={selectedPayment.status} /></div>
                  )}
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <Wallet className="h-3.5 w-3.5" /> Payment Type
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {selectedPayment.payment_type ? selectedPayment.payment_type.charAt(0).toUpperCase() + selectedPayment.payment_type.slice(1) : '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <Hash className="h-3.5 w-3.5" /> Transaction ID
                  </p>
                  <p className="break-words text-sm font-semibold text-foreground">{selectedPayment.transaction_id || '—'}</p>
                </div>
                {selectedPayment.status === 'refunded' && selectedPayment.refund_gateway_id && (
                  <div className="rounded-xl bg-bg p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                      <Hash className="h-3.5 w-3.5" /> Refund ID
                    </p>
                    <p className="break-words text-sm font-semibold text-foreground">{selectedPayment.refund_gateway_id}</p>
                  </div>
                )}
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <CalendarDays className="h-3.5 w-3.5" /> Date
                  </p>
                  <p className="text-sm font-semibold text-foreground">{formatDate(selectedPayment.paid_at ?? selectedPayment.created_at)}</p>
                </div>
                {selectedPayment.notes && (
                  <div className="rounded-xl bg-bg p-3 sm:col-span-2">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                      <ReceiptText className="h-3.5 w-3.5" /> Notes
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm text-foreground">{selectedPayment.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {selectedPayment.reservation && (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BedDouble className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">Reservation Details</h4>
                  <span className="ml-auto text-xs font-medium text-primary">{selectedPayment.reservation.reservation_number}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-bg p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                      <UserRound className="h-3.5 w-3.5" /> Guest
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedPayment.reservation.guest?.first_name} {selectedPayment.reservation.guest?.last_name}
                    </p>
                    {selectedPayment.reservation.guest?.email && (
                      <p className="mt-0.5 truncate text-xs text-muted">{selectedPayment.reservation.guest.email}</p>
                    )}
                  </div>
                  <div className="rounded-xl bg-bg p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                      <BedDouble className="h-3.5 w-3.5" /> Room
                    </p>
                    <p className="text-sm font-semibold text-foreground">{selectedPayment.reservation.room?.room_number ?? '-'}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {selectedPayment.reservation.room?.room_type?.name ?? ''}
                    </p>
                  </div>
                  <div className="rounded-xl bg-bg p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                      <CalendarDays className="h-3.5 w-3.5" /> Stay
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {formatDateDisplay(selectedPayment.reservation.check_in)} → {formatDateDisplay(selectedPayment.reservation.check_out)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {nightsBetween(selectedPayment.reservation.check_in, selectedPayment.reservation.check_out)} night{nightsBetween(selectedPayment.reservation.check_in, selectedPayment.reservation.check_out) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="rounded-xl bg-bg p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                      <CreditCard className="h-3.5 w-3.5" /> Total
                    </p>
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(selectedPayment.reservation.total_amount)}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                      <span>Paid {formatCurrency(selectedPayment.reservation.paid_amount ?? 0)}</span>
                      <span>·</span>
                      <span className="font-medium text-success">Due {formatCurrency(selectedPayment.reservation.due_amount ?? 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 text-center">
            <AlertCircle className="mb-2 h-8 w-8 text-muted" />
            <p className="text-sm text-muted">Could not load payment details.</p>
          </div>
        )}
      </Modal>

      <PaymentModal
        isOpen={showFormModal}
        onClose={closeFormModal}
        reservations={reservations}
        showCheckInOption
        showCheckOutOption
      />

      <RefundModal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        payments={refundablePayments}
        onSuccess={(_payment) => {
          setShowRefundModal(false)
          addToast('Refund processed successfully', 'success')
          refetch()
        }}
      />

      <PaymentModal
        isOpen={showFormModal}
        onClose={closeFormModal}
        reservations={reservations}
        showCheckInOption
        showCheckOutOption
      />

    </div>
  )
}
