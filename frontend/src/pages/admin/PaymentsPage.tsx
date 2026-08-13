import { useState, useMemo } from 'react'
import { usePayments, useReservations, useUpdatePayment } from '@/hooks/useApi'
import type { Payment, Reservation } from '@/types'
import { formatCurrency, formatDateDisplay } from '@/lib/format'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { RowActions, RowActionButton } from '@/components/shared/RowActions'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PaymentModal } from '@/components/shared/PaymentModal'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { DatePicker } from '@/components/ui/date-picker'
import { useToast } from '@/components/ui/toast'
import { PAYMENT_METHODS } from '@/lib/constants'
import {
  Plus, Eye, Banknote, Smartphone, CreditCard,
  AlertCircle, Loader2,
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
  const { data: reservationsData } = useReservations({ per_page: 100, status: 'checked_in,checked_out,confirmed' })
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

  const columns: Column<PaymentExtended>[] = [
    {
      key: 'reference_number',
      label: 'Reference #',
      sortable: true,
      className: 'font-medium',
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
      render: (r) => <span>{getGuestName(r)}</span>,
    },
    {
      key: 'reservation_id',
      label: 'Reservation #',
      render: (r) => <span>{r.reservation?.reservation_number ?? `#${r.reservation_id}`}</span>,
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      render: (r) => <span className="font-medium">{formatCurrency(r.amount)}</span>,
    },
    {
      key: 'payment_method',
      label: 'Method',
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          {METHOD_ICONS[r.payment_method] ?? null}
          <span>{getMethodLabel(r.payment_method)}</span>
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
      render: (r) => <span>{formatDate(r.paid_at ?? r.created_at)}</span>,
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
          <Button variant="gold" onClick={openNewForm}>
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
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

          <DataTable
            columns={columns}
            data={payments}
            loading={isLoading}
            error={error ? 'Failed to load payments' : null}
            sortBy={sortBy}
            onSort={handleSort}
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
        size="lg"
      >
        {selectedPayment ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted">Reference Number</label>
                <p className="text-sm font-medium text-foreground">{selectedPayment.reference_number ?? `PAY-${selectedPayment.id}`}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Status</label>
                {selectedPayment.status === 'pending' ? (
                  <div className="flex items-center gap-2">
                    <Select
                      className="mt-0.5"
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
                  <div className="mt-0.5"><StatusBadge status={selectedPayment.status} /></div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Amount</label>
                <p className="text-lg font-bold text-foreground">{formatCurrency(selectedPayment.amount)}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Payment Method</label>
                <p className="flex items-center gap-1.5 text-sm text-foreground">
                  {METHOD_ICONS[selectedPayment.payment_method] ?? null}
                  {getMethodLabel(selectedPayment.payment_method)}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Date</label>
                <p className="text-sm text-foreground">{formatDate(selectedPayment.paid_at ?? selectedPayment.created_at)}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Receipt Number</label>
                <p className="text-sm text-foreground">RCT-{selectedPayment.id.toString().padStart(5, '0')}</p>
              </div>
            </div>

            {selectedPayment.reservation && (
              <div className="rounded-lg border border-border p-4">
                <h4 className="mb-2 text-sm font-semibold text-foreground">Reservation Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted">Reservation:</span>
                    <span className="ml-1 font-medium">{selectedPayment.reservation.reservation_number}</span>
                  </div>
                  <div>
                    <span className="text-muted">Guest:</span>
                    <span className="ml-1">{selectedPayment.reservation.guest?.first_name} {selectedPayment.reservation.guest?.last_name}</span>
                  </div>
                  <div>
                    <span className="text-muted">Room:</span>
                    <span className="ml-1">{selectedPayment.reservation.room?.room_number ?? '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted">Total Amount:</span>
                    <span className="ml-1 font-medium">{formatCurrency(selectedPayment.reservation.total_amount)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDetailModal(false)}>Close</Button>
            </div>
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
      />

    </div>
  )
}
