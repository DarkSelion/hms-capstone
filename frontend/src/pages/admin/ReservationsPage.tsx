import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  useReservations, useCancelReservation, useMarkNoShow, useExtendStay,
} from '@/hooks/useApi'
import { useCheckInOutModal } from '@/hooks/useCheckInOutModal'
import { formatCurrency, formatDateDisplay } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { NoShowModal } from '@/components/shared/NoShowModal'
import { CancelReservationModal } from '@/components/shared/CancelReservationModal'
import { ReservationDetailModal } from '@/components/shared/ReservationDetailModal'
import { ReservationFormModal } from '@/components/shared/ReservationFormModal'
import { ReservationCheckInOutModal } from '@/components/shared/ReservationCheckInOutModal'
import { ReservationRowActions } from '@/components/shared/ReservationRowActions'
import { ExtendStayModal } from '@/components/shared/ExtendStayModal'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Select } from '@/components/ui/select'
import type { Reservation } from '@/types'
import {
  Plus, AlertTriangle, X, ArrowRight, CalendarX2,
} from 'lucide-react'

function formatDate(dateStr: string) {
  return formatDateDisplay(dateStr)
}

function nightsBetween(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 0
  const diff = Math.floor((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
  return Number.isNaN(diff) ? 0 : Math.max(diff, 0)
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked In' },
  { value: 'checked_out', label: 'Checked Out' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
]

export default function ReservationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const statusFilter = searchParams.get('status') ?? ''
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('-created_at')
  const [page, setPage] = useState(1)

  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)

  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null)
  const [noShowTarget, setNoShowTarget] = useState<Reservation | null>(null)
  const [extendTarget, setExtendTarget] = useState<Reservation | null>(null)

  const checkInModal = useCheckInOutModal('check-in')
  const checkOutModal = useCheckInOutModal('check-out')
  const { open: openCheckIn, confirmAfterPayment: confirmAfterCheckIn } = checkInModal
  const { open: openCheckOut, confirmAfterPayment: confirmAfterCheckOut } = checkOutModal

  const queryParams = useMemo(() => {
    const params: Record<string, string | number | undefined> = {
      page,
      sort_field: sortBy.replace(/^-/, ''),
      sort_dir: sortBy.startsWith('-') ? 'desc' : 'asc',
    }
    if (search) params.search = search
    if (statusFilter) params.status = statusFilter
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    return params
  }, [page, sortBy, search, statusFilter, dateFrom, dateTo])

  const { data: reservationsData, isLoading, error, refetch } = useReservations(queryParams)

  const cancelReservation = useCancelReservation()
  const markNoShow = useMarkNoShow()
  const extendStay = useExtendStay()

  const reservations = reservationsData?.data ?? []
  const totalPages = reservationsData?.last_page ?? 1

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    setPage(1)
  }, [])

  const handleStatusFilterValue = useCallback((value: string) => {
    setPage(1)
    setSearchParams((prev) => {
      if (value) {
        prev.set('status', value)
      } else {
        prev.delete('status')
      }
      return prev
    })
  }, [setSearchParams])

  const handleStatusFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    handleStatusFilterValue(e.target.value)
  }, [handleStatusFilterValue])

  const hasActiveFilters = Boolean(search || statusFilter || dateFrom || dateTo)

  const clearAllFilters = useCallback(() => {
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
    setSearchParams((prev) => {
      prev.delete('status')
      return prev
    })
  }, [setSearchParams])

  const handleSort = useCallback((key: string) => {
    setSortBy(prev => prev === key ? `-${key}` : prev === `-${key}` ? key : key)
  }, [])

  function openDetailModal(reservation: Reservation) {
    setSelectedReservation(reservation)
    setShowDetailModal(true)
  }

  function openNewForm() {
    setEditingReservation(null)
    setShowFormModal(true)
  }

  function openEditForm(reservation: Reservation) {
    setEditingReservation(reservation)
    setShowDetailModal(false)
    setShowFormModal(true)
  }

  function closeFormModal() {
    setShowFormModal(false)
    setEditingReservation(null)
  }

  function openCancelDialog(reservation: Reservation) {
    setCancelTarget(reservation)
  }

  async function handleCancelConfirm() {
    if (!cancelTarget) return
    try {
      await cancelReservation.mutateAsync(cancelTarget.id)
      setCancelTarget(null)
    } catch {
      // handled by react-query
    }
  }

  async function handleMarkNoShowConfirm() {
    if (!noShowTarget) return
    try {
      await markNoShow.mutateAsync(noShowTarget.id)
      setNoShowTarget(null)
    } catch {
      // handled by react-query
    }
  }

  function openExtendStay(reservation: Reservation) {
    setShowDetailModal(false)
    setExtendTarget(reservation)
  }

  async function handleExtendStayConfirm(newCheckOut: string) {
    if (!extendTarget) return
    try {
      await extendStay.mutateAsync({ id: extendTarget.id, new_check_out: newCheckOut })
      setExtendTarget(null)
    } catch {
      // handled by react-query
    }
  }

  const columns: Column<Reservation>[] = useMemo(() => [
    {
      key: 'reservation_number',
      label: 'Reservation #',
      sortable: true,
      render: (r) => (
        <button
          onClick={() => openDetailModal(r)}
          className="block max-w-[160px] truncate text-primary hover:underline"
        >
          {r.reservation_number}
        </button>
      ),
    },
    {
      key: 'guest',
      label: 'Guest',
      sortable: true,
      className: 'truncate max-w-[300px]',
      render: (r) => {
        const name = `${r.guest?.first_name ?? ''} ${r.guest?.last_name ?? ''}`.trim() || '-'
        const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
        return (
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials}
            </div>
            <div className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">{name}</span>
              <span className="block truncate text-xs text-muted">{r.guest?.email}</span>
            </div>
          </div>
        )
      },
    },
    {
      key: 'room',
      label: 'Room',
      sortable: true,
      render: (r) => (
        <div className="min-w-0">
          <span className="font-semibold text-foreground">{r.room?.room_number ?? '-'}</span>
          <span className="block truncate text-xs text-muted">{r.room?.room_type?.name ?? '\u00A0'}</span>
        </div>
      ),
    },
    {
      key: 'check_in',
      label: 'Stay',
      sortable: true,
      className: 'whitespace-nowrap',
      render: (r) => {
        const nights = nightsBetween(r.check_in, r.check_out)
        return (
          <div>
            <div className="flex items-center gap-1 whitespace-nowrap text-sm">
              <span>{formatDate(r.check_in)}</span>
              <ArrowRight className="h-3 w-3 text-muted" />
              <span>{formatDate(r.check_out)}</span>
            </div>
            <span className="text-xs text-muted">{nights} night{nights !== 1 ? 's' : ''}</span>
          </div>
        )
      },
    },
    {
      key: 'total_amount',
      label: 'Total',
      sortable: true,
      className: 'whitespace-nowrap',
      render: (r) => {
        const due = Number(r.due_amount ?? 0)
        return (
          <div className="whitespace-nowrap">
            <span className="font-semibold tabular-nums text-foreground">{formatCurrency(r.total_amount)}</span>
            <span className={cn('block text-xs tabular-nums', due > 0 ? 'text-amber-600' : 'text-emerald-600')}>
              {due > 0 ? `Due ${formatCurrency(due)}` : 'Fully paid'}
            </span>
          </div>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      className: 'whitespace-nowrap',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={r.status} />
          {r.status === 'confirmed' && r.is_overdue && (
            <Badge variant="warning">
              <AlertTriangle className="h-3 w-3" />
              Overdue
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'payment_status',
      label: 'Payment',
      sortable: true,
      className: 'whitespace-nowrap',
      render: (r) => <StatusBadge status={r.payment_status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'whitespace-nowrap',
      render: (r) => (
        <ReservationRowActions
          reservation={r}
          onView={() => openDetailModal(r)}
          onEdit={() => openEditForm(r)}
          onCancel={() => openCancelDialog(r)}
          onCheckIn={() => openCheckIn(r)}
          onCheckOut={() => openCheckOut(r)}
          onMarkNoShow={() => setNoShowTarget(r)}
          onExtendStay={() => openExtendStay(r)}
        />
      ),
    },
  ], [openCheckIn, openCheckOut])

  return (
    <div>
      <PageHeader
        title="Reservations"
        description="Manage hotel reservations"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={openNewForm}>
              <Plus className="h-4 w-4" />
              New Reservation
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Input
                placeholder="Search by reservation # or guest name..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <div className="w-44">
              <Select value={statusFilter} onChange={handleStatusFilterChange}>
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>
            <div className="w-44">
              <DatePicker
                value={dateFrom}
                onChange={(v) => { setDateFrom(v); setPage(1) }}
                placeholder="From date"
                clearable
              />
            </div>
            <div className="w-44">
              <DatePicker
                value={dateTo}
                onChange={(v) => { setDateTo(v); setPage(1) }}
                placeholder="To date"
                clearable
              />
            </div>
          </div>

          {/* Active Filter Bar */}
          {hasActiveFilters && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>Active filters:</span>
              {search && (
                <Badge variant="secondary" className="gap-1">
                  Search: {search}
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => handleSearchChange('')}>
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {statusFilter && (
                <Badge variant="secondary" className="gap-1">
                  Status: {STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => handleStatusFilterValue('')}>
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
            data={reservations}
            loading={isLoading}
            error={error ? 'Failed to load reservations' : null}
            sortBy={sortBy}
            onSort={handleSort}
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <CalendarX2 className="mb-3 h-10 w-10 text-muted/50" />
                <p className="text-sm font-medium text-foreground">No reservations match your filters</p>
                <p className="text-sm text-muted">Try adjusting your search or filters.</p>
                {hasActiveFilters && (
                  <Button variant="outline" className="mt-4" onClick={clearAllFilters}>
                    Clear all filters
                  </Button>
                )}
              </div>
            }
            pagination={reservationsData ? {
              currentPage: page,
              lastPage: totalPages,
              total: reservationsData.total,
              from: (reservationsData.current_page - 1) * reservationsData.per_page + 1,
              to: Math.min(reservationsData.current_page * reservationsData.per_page, reservationsData.total),
              onPageChange: setPage,
            } : undefined}
            onRetry={() => refetch()}
            keyExtractor={(r) => r.id}
          />
        </CardContent>
      </Card>

      <ReservationDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        reservation={selectedReservation}
        onEdit={openEditForm}
        onExtendStay={openExtendStay}
      />

      <ReservationFormModal
        isOpen={showFormModal}
        onClose={closeFormModal}
        reservation={editingReservation}
      />

      <ReservationCheckInOutModal
        mode="check-in"
        reservation={checkInModal.target}
        isOpen={checkInModal.isOpen}
        isLoading={checkInModal.isLoading}
        error={checkInModal.error}
        onClose={checkInModal.close}
        onConfirm={checkInModal.confirm}
        onConfirmAfterPayment={confirmAfterCheckIn}
      />

      <ReservationCheckInOutModal
        mode="check-out"
        reservation={checkOutModal.target}
        isOpen={checkOutModal.isOpen}
        isLoading={checkOutModal.isLoading}
        error={checkOutModal.error}
        onClose={checkOutModal.close}
        onConfirm={checkOutModal.confirm}
        onConfirmAfterPayment={confirmAfterCheckOut}
      />

      <ExtendStayModal
        isOpen={!!extendTarget}
        onClose={() => setExtendTarget(null)}
        reservation={extendTarget}
        isLoading={extendStay.isPending}
        error={extendStay.error?.message ?? null}
        onConfirm={handleExtendStayConfirm}
      />

      <CancelReservationModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        reservation={cancelTarget}
        isLoading={cancelReservation.isPending}
        onConfirm={handleCancelConfirm}
      />

      <NoShowModal
        isOpen={!!noShowTarget}
        onClose={() => setNoShowTarget(null)}
        reservation={noShowTarget}
        isLoading={markNoShow.isPending}
        onConfirm={handleMarkNoShowConfirm}
      />
    </div>
  )
}
