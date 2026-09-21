import { useState, useMemo, useCallback } from 'react'
import {
  useReservations, useCancelReservation, useMarkNoShow, useNotifyLateArrival,
} from '@/hooks/useApi'
import { useCheckInOutModal } from '@/hooks/useCheckInOutModal'
import { formatCurrency, formatDateDisplay } from '@/lib/format'
import { cn } from '@/lib/utils'
import { getDateGroup, formatTodayLabel, toLocalDateStr } from '@/lib/date-group'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { TodayBadge } from '@/components/shared/TodayBadge'
import { ReservationRowActions } from '@/components/shared/ReservationRowActions'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { NoShowModal } from '@/components/shared/NoShowModal'
import { LateArrivalModal } from '@/components/shared/LateArrivalModal'
import { CancelReservationModal } from '@/components/shared/CancelReservationModal'
import { ReservationDetailModal } from '@/components/shared/ReservationDetailModal'
import { ReservationFormModal } from '@/components/shared/ReservationFormModal'
import { ReservationCheckInOutModal } from '@/components/shared/ReservationCheckInOutModal'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Luggage, CalendarDays } from 'lucide-react'
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
  const [lateArrivalTarget, setLateArrivalTarget] = useState<Reservation | null>(null)

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
  const notifyLateArrival = useNotifyLateArrival()

  const todayStr = toLocalDateStr(new Date())
  const { data: todayData } = useReservations({
    status: 'confirmed',
    date_from: todayStr,
    per_page: 100,
    sort_field: 'check_in',
    sort_dir: 'asc',
  })

  const reservations = reservationsData?.data ?? []
  const totalPages = reservationsData?.last_page ?? 1
  const sortBy = sortDir === 'asc' ? sortField : `-${sortField}`

  const todayArrivals = useMemo(() => {
    const all = (todayData?.data ?? []) as Reservation[]
    return all.filter((r) => r.check_in === todayStr)
  }, [todayData, todayStr])

  const todayArrivalIds = useMemo(() => new Set(todayArrivals.map((r) => r.id)), [todayArrivals])

  const tableData = useMemo(() => {
    return reservations.filter((r) => !todayArrivalIds.has(r.id))
  }, [reservations, todayArrivalIds])

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

  function handleLateArrival(reservation: Reservation) {
    setLateArrivalTarget(reservation)
  }

  async function handleLateArrivalConfirm(deadline: string, notes: string) {
    if (!lateArrivalTarget) return
    try {
      await notifyLateArrival.mutateAsync({ id: lateArrivalTarget.id, deadline, notes })
      setLateArrivalTarget(null)
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
      className: 'max-w-[180px]',
      render: (r) => {
        const name = `${r.guest?.first_name ?? ''} ${r.guest?.last_name ?? ''}`.trim() || '-'
        const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
        return (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
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
            {getDateGroup(r.check_in) === 'today' && <TodayBadge variant="arrival" />}
          </div>
          <span className="block text-xs text-muted">departs {formatDateDisplay(r.check_out)}</span>
        </div>
      ),
    },
    {
      key: 'adults',
      label: 'Guests',
      sortable: false,
      render: (r) => (
        <div>
          <div className="font-medium text-foreground">{r.adults} {r.adults === 1 ? 'Adult' : 'Adults'}</div>
          {r.children > 0 && (
            <div className="text-xs text-muted">{r.children} {r.children === 1 ? 'Child' : 'Children'}</div>
          )}
        </div>
      ),
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
      key: 'alerts',
      label: 'Alerts',
      sortable: false,
      className: 'whitespace-nowrap',
      render: (r) => {
        const hasOverdue = r.is_overdue
        const isLateArrival = r.status === 'late_arrival'
        const hasRefund = r.refund_requested_at && r.payment_status !== 'refunded'
        if (!hasOverdue && !isLateArrival && !hasRefund) {
          return <span className="text-slate-300">—</span>
        }
        return (
          <div className="flex items-center gap-1 flex-wrap">
            {hasOverdue && (
              <span className="inline-flex items-center px-2.5 py-0.5 text-[10px] font-medium rounded-full bg-rose-50 text-rose-700 border border-rose-200/60">
                {r.payment_status === 'paid' || r.payment_status === 'partial' ? 'Late Arrival' : 'Overdue'}
              </span>
            )}
            {isLateArrival && (
              <span className="inline-flex items-center px-2.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
                Notified — Hold Active
              </span>
            )}
            {hasRefund && (
              <span className="inline-flex items-center px-2.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
                Refund
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'payment_status',
      label: 'Payment',
      sortable: true,
      className: 'whitespace-nowrap',
      render: (r) => <StatusBadge status={r.payment_status} pill />,
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'whitespace-nowrap align-middle pr-2',
      render: (r) => (
        <ReservationRowActions
          reservation={r}
          onView={() => openDetailModal(r)}
          onEdit={() => openEditForm(r)}
          onCancel={() => setCancelTarget(r)}
          onCheckIn={() => openCheckIn(r)}
          onMarkNoShow={() => handleMarkNoShow(r)}
          onLateArrival={() => handleLateArrival(r)}
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

          {todayArrivals.length > 0 && !search && (
            <div className="mb-5">
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/60 rounded-xl px-4 py-2.5 mb-3">
                <CalendarDays className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Today — {formatTodayLabel()} ({todayArrivals.length} arrival{todayArrivals.length !== 1 ? 's' : ''})
                </span>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/20 overflow-hidden">
                <table className="w-full table-auto border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-amber-200/40 text-left text-xs font-medium uppercase tracking-wider text-amber-600/70">
                      <th className="px-2 py-2.5">Reservation</th>
                      <th className="px-2 py-2.5">Guest</th>
                      <th className="px-2 py-2.5">Room</th>
                      <th className="whitespace-nowrap px-2 py-2.5">Arrival</th>
                      <th className="whitespace-nowrap px-2 py-2.5">Guests</th>
                      <th className="whitespace-nowrap px-2 py-2.5">Total</th>
                      <th className="whitespace-nowrap px-2 py-2.5">Alerts</th>
                      <th className="whitespace-nowrap px-2 py-2.5">Payment</th>
                      <th className="whitespace-nowrap px-2 py-2.5 pr-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100/60">
                    {todayArrivals.map((r) => {
                      const due = Number(r.due_amount ?? 0)
                      const hasOverdue = r.is_overdue
                      const isLateArrival = r.status === 'late_arrival'
                      const hasRefund = r.refund_requested_at && r.payment_status !== 'refunded'
                      return (
                      <tr key={r.id} className="bg-amber-50/30 hover:bg-amber-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <button onClick={() => openDetailModal(r)} className="font-medium text-primary hover:underline">
                            {r.reservation_number}
                          </button>
                        </td>
                        <td className="px-2 py-3">
                          {(() => {
                            const name = `${r.guest?.first_name ?? ''} ${r.guest?.last_name ?? ''}`.trim() || '-'
                            const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
                            return (
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials}</div>
                                <div className="min-w-0">
                                  <span className="block truncate text-sm font-medium text-foreground">{name}</span>
                                  <span className="block truncate text-xs text-muted">{r.guest?.email}</span>
                                </div>
                              </div>
                            )
                          })()}
                        </td>
                        <td className="px-2 py-3">
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground">{r.room?.room_number ?? '-'}</span>
                            <span className="block truncate text-xs text-muted">{r.room?.room_type?.name ?? '\u00A0'}</span>
                          </div>
                        </td>
                        <td className="px-2 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{formatDateDisplay(r.check_in)}</span>
                            <TodayBadge variant="arrival" />
                          </div>
                          <span className="block text-xs text-muted">departs {formatDateDisplay(r.check_out)}</span>
                        </td>
                        <td className="px-2 py-3 whitespace-nowrap">
                          <div className="font-medium text-foreground">{r.adults} {r.adults === 1 ? 'Adult' : 'Adults'}</div>
                          {r.children > 0 && (
                            <div className="text-xs text-muted">{r.children} {r.children === 1 ? 'Child' : 'Children'}</div>
                          )}
                        </td>
                        <td className="px-2 py-3 whitespace-nowrap">
                          <div>
                            <span className="font-semibold tabular-nums text-foreground">{formatCurrency(r.total_amount)}</span>
                            <span className={cn('block text-xs tabular-nums', due > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                              {due > 0 ? `Due ${formatCurrency(due)}` : 'Fully paid'}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-3 whitespace-nowrap">
                          {!hasOverdue && !isLateArrival && !hasRefund ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <div className="flex items-center gap-1 flex-wrap">
                              {hasOverdue && (
                                <span className="inline-flex items-center px-2.5 py-0.5 text-[10px] font-medium rounded-full bg-rose-50 text-rose-700 border border-rose-200/60">
                                  {r.payment_status === 'paid' || r.payment_status === 'partial' ? 'Late Arrival' : 'Overdue'}
                                </span>
                              )}
                              {isLateArrival && (
                                <span className="inline-flex items-center px-2.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
                                  Notified — Hold Active
                                </span>
                              )}
                              {hasRefund && (
                                <span className="inline-flex items-center px-2.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
                                  Refund
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-3 whitespace-nowrap">
                          <StatusBadge status={r.payment_status} pill />
                        </td>
                        <td className="px-2 py-3 whitespace-nowrap pr-2">
                          <ReservationRowActions
                            reservation={r}
                            onView={() => openDetailModal(r)}
                            onEdit={() => openEditForm(r)}
                            onCancel={() => setCancelTarget(r)}
                            onCheckIn={() => openCheckIn(r)}
                            onMarkNoShow={() => handleMarkNoShow(r)}
                            onLateArrival={() => handleLateArrival(r)}
                          />
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DataTable
            columns={columns}
            data={tableData}
            loading={isLoading}
            error={error ? 'Failed to load reservations' : null}
            sortBy={sortBy}
            onSort={handleSort}
            tableClassName="table-auto border-collapse"
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

      <LateArrivalModal
        isOpen={!!lateArrivalTarget}
        onClose={() => setLateArrivalTarget(null)}
        reservation={lateArrivalTarget}
        isLoading={notifyLateArrival.isPending}
        onConfirm={handleLateArrivalConfirm}
      />
    </div>
  )
}
