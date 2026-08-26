import { useState, useMemo, useCallback } from 'react'
import {
  useReservations, useCancelReservation, useMarkNoShow,
} from '@/hooks/useApi'
import { useCheckInOutModal } from '@/hooks/useCheckInOutModal'
import { formatCurrency, formatDateDisplay } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { ReservationRowActions } from '@/components/shared/ReservationRowActions'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { NoShowModal } from '@/components/shared/NoShowModal'
import { CancelReservationModal } from '@/components/shared/CancelReservationModal'
import { ReservationDetailModal } from '@/components/shared/ReservationDetailModal'
import { ReservationFormModal } from '@/components/shared/ReservationFormModal'
import { ReservationCheckInOutModal } from '@/components/shared/ReservationCheckInOutModal'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertTriangle, Luggage } from 'lucide-react'
import type { Reservation } from '@/types'

export default function CheckInPage() {
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('check_in')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null)
  const [noShowTarget, setNoShowTarget] = useState<Reservation | null>(null)

  const checkInModal = useCheckInOutModal('check-in')
  const {
    open: openCheckIn, close: closeCheckIn, confirm: confirmCheckIn, confirmAfterPayment: confirmAfterCheckIn,
  } = checkInModal

  const queryParams = useMemo(() => {
    const params: Record<string, string | number | undefined> = {
      status: 'confirmed',
      page,
      sort_field: sortField,
      sort_dir: sortDir,
    }
    if (search) params.search = search
    return params
  }, [page, sortField, sortDir, search])

  const { data: reservationsData, isLoading, error, refetch } = useReservations(queryParams)
  const cancelReservation = useCancelReservation()
  const markNoShow = useMarkNoShow()

  const reservations = reservationsData?.data ?? []
  const totalPages = reservationsData?.last_page ?? 1
  const sortBy = sortDir === 'asc' ? sortField : `-${sortField}`

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    setPage(1)
  }, [])

  const handleSort = useCallback((key: string) => {
    setSortField(prevField => {
      if (prevField === key) {
        setSortDir(prevDir => prevDir === 'asc' ? 'desc' : 'asc')
        return prevField
      }
      setSortDir('asc')
      return key
    })
  }, [])

  function openDetailModal(reservation: Reservation) {
    setSelectedReservation(reservation)
    setShowDetailModal(true)
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

  async function handleCancelConfirm() {
    if (!cancelTarget) return
    try {
      await cancelReservation.mutateAsync(cancelTarget.id)
      setCancelTarget(null)
    } catch {
      // handled by react-query
    }
  }

  function handleMarkNoShow(reservation: Reservation) {
    setNoShowTarget(reservation)
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

  const columns: Column<Reservation>[] = useMemo(() => [
    {
      key: 'reservation_number',
      label: 'Reservation #',
      sortable: true,
      render: (r) => <span className="font-medium">{r.reservation_number}</span>,
    },
    {
      key: 'guest',
      label: 'Guest',
      sortable: false,
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
      sortable: false,
      render: (r) => (
        <div className="min-w-0">
          <span className="font-semibold text-foreground">{r.room?.room_number ?? '-'}</span>
          <span className="block truncate text-xs text-muted">{r.room?.room_type?.name ?? '\u00A0'}</span>
        </div>
      ),
    },
    {
      key: 'check_in',
      label: 'Arrival',
      sortable: true,
      className: 'whitespace-nowrap',
      render: (r) => (
        <div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span>{formatDateDisplay(r.check_in)}</span>
            {r.is_overdue && (
              <Badge variant="warning">
                <AlertTriangle className="h-3 w-3" />
                Overdue
              </Badge>
            )}
          </div>
          <span className="block text-xs text-muted">departs {formatDateDisplay(r.check_out)}</span>
        </div>
      ),
    },
    {
      key: 'adults',
      label: 'Guests',
      sortable: false,
      className: 'whitespace-nowrap',
      render: (r) => (
        <span>{r.adults} Adult{r.adults !== 1 ? 's' : ''}{r.children > 0 ? `, ${r.children} Child${r.children !== 1 ? 'ren' : ''}` : ''}</span>
      ),
    },
    {
      key: 'total_amount',
      label: 'Billing',
      sortable: true,
      className: 'whitespace-nowrap',
      render: (r) => {
        const due = Number(r.due_amount ?? 0)
        return (
          <div className="whitespace-nowrap">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold tabular-nums text-foreground">{formatCurrency(r.total_amount)}</span>
              <StatusBadge status={r.payment_status} />
            </div>
            <span className={cn('block text-xs tabular-nums', due > 0 ? 'text-amber-600' : 'text-emerald-600')}>
              {due > 0 ? `Due ${formatCurrency(due)}` : 'Fully paid'}
            </span>
          </div>
        )
      },
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
          onCancel={() => setCancelTarget(r)}
          onCheckIn={() => openCheckIn(r)}
          onMarkNoShow={() => handleMarkNoShow(r)}
        />
      ),
    },
  ], [openCheckIn])

  return (
    <div>
      <PageHeader
        title="Check In"
        description="Guests arriving today — confirmed reservations ready for check-in"
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
          </div>

          <DataTable
            columns={columns}
            data={reservations}
            loading={isLoading}
            error={error ? 'Failed to load reservations' : null}
            sortBy={sortBy}
            onSort={handleSort}
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <Luggage className="mb-3 h-10 w-10 text-muted/50" />
                <p className="text-sm font-medium text-foreground">No arrivals match your search</p>
                <p className="text-sm text-muted">Try adjusting your search.</p>
                {search && (
                  <Button variant="outline" className="mt-4" onClick={() => handleSearchChange('')}>
                    Clear search
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
        onClose={closeCheckIn}
        onConfirm={confirmCheckIn}
        onConfirmAfterPayment={confirmAfterCheckIn}
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
