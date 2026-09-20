import { useState, useMemo, useCallback } from 'react'
import {
  useReservations, useExtendStay,
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
import { ReservationDetailModal } from '@/components/shared/ReservationDetailModal'
import { ReservationFormModal } from '@/components/shared/ReservationFormModal'
import { ReservationCheckInOutModal } from '@/components/shared/ReservationCheckInOutModal'
import { ExtendStayModal } from '@/components/shared/ExtendStayModal'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, DoorOpen, CalendarDays, AlertTriangle } from 'lucide-react'
import type { Reservation } from '@/types'

function nightsBetween(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 0
  const diff = Math.floor((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
  return Number.isNaN(diff) ? 0 : Math.max(diff, 0)
}

export default function CheckOutPage() {
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('check_out')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [extendTarget, setExtendTarget] = useState<Reservation | null>(null)

  const checkOutModal = useCheckInOutModal('check-out')
  const {
    open: openCheckOut, close: closeCheckOut, confirm: confirmCheckOut, confirmAfterPayment: confirmAfterCheckOut,
  } = checkOutModal
  const extendStay = useExtendStay()

  const queryParams = useMemo(() => {
    const params: Record<string, string | number | undefined> = {
      status: 'checked_in',
      page,
      sort_field: sortField,
      sort_dir: sortDir,
    }
    if (search) params.search = search
    return params
  }, [page, sortField, sortDir, search])

  const { data: reservationsData, isLoading, error, refetch } = useReservations(queryParams)

  const todayStr = toLocalDateStr(new Date())
  const { data: todayData } = useReservations({
    status: 'checked_in',
    per_page: 100,
    sort_field: 'check_out',
    sort_dir: 'asc',
  })

  const reservations = reservationsData?.data ?? []
  const totalPages = reservationsData?.last_page ?? 1
  const sortBy = sortDir === 'asc' ? sortField : `-${sortField}`

  const todayDepartures = useMemo(() => {
    const all = (todayData?.data ?? []) as Reservation[]
    return all.filter((r) => r.check_out === todayStr)
  }, [todayData, todayStr])

  const todayDepartureIds = useMemo(() => new Set(todayDepartures.map((r) => r.id)), [todayDepartures])

  const tableData = useMemo(() => {
    return reservations.filter((r) => !todayDepartureIds.has(r.id))
  }, [reservations, todayDepartureIds])

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
      className: 'w-[14%]',
      render: (r) => <span className="font-medium">{r.reservation_number}</span>,
    },
    {
      key: 'guest',
      label: 'Guest',
      sortable: false,
      className: 'w-[22%] truncate max-w-[300px]',
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
      className: 'w-[12%]',
      render: (r) => (
        <div className="min-w-0">
          <span className="font-semibold text-foreground">{r.room?.room_number ?? '-'}</span>
          <span className="block truncate text-xs text-muted">{r.room?.room_type?.name ?? '\u00A0'}</span>
        </div>
      ),
    },
    {
      key: 'check_out',
      label: 'Departure',
      sortable: true,
      className: 'w-[16%] whitespace-nowrap',
      render: (r) => {
        const nights = nightsBetween(r.check_in, r.check_out)
        return (
          <div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="font-medium text-foreground">{formatDateDisplay(r.check_out)}</span>
              {getDateGroup(r.check_out) === 'today' && <TodayBadge variant="departure" />}
            </div>
            <span className="block text-xs text-muted">
              arrived {formatDateDisplay(r.check_in)} · {nights} night{nights !== 1 ? 's' : ''}
            </span>
          </div>
        )
      },
    },
    {
      key: 'total_amount',
      label: 'Total',
      sortable: true,
      className: 'w-[11%] whitespace-nowrap',
      render: (r) => {
        const due = Number(r.due_amount ?? 0)
        return (
          <div className="whitespace-nowrap">
            <span className="font-semibold tabular-nums text-foreground">{formatCurrency(r.total_amount)}</span>
            {due > 0 ? (
              <span className="block text-xs font-semibold tabular-nums text-danger">
                Due {formatCurrency(due)}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-medium text-success">
                <CheckCircle2 className="h-3 w-3" /> Settled
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'alerts',
      label: 'Alerts',
      sortable: false,
      className: 'w-[11%] whitespace-nowrap',
      render: (r) => {
        const isOverstay = r.status === 'checked_in' && r.check_out < todayStr
        const overstayDays = isOverstay
          ? Math.ceil((new Date(todayStr).getTime() - new Date(r.check_out).getTime()) / 86400000)
          : 0
        const hasRefund = r.refund_requested_at && r.payment_status !== 'refunded'
        if (!isOverstay && !hasRefund) {
          return <span className="text-slate-300">—</span>
        }
        return (
          <div className="flex items-center gap-1 flex-wrap">
            {isOverstay && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-orange-50 text-orange-700 border border-orange-200/60">
                <AlertTriangle className="h-3 w-3" />
                Overstay ({overstayDays}d)
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
      className: 'w-[11%] whitespace-nowrap',
      render: (r) => <StatusBadge status={r.payment_status} pill />,
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-[16%] whitespace-nowrap',
      render: (r) => (
        <ReservationRowActions
          reservation={r}
          onView={() => openDetailModal(r)}
          onEdit={() => openEditForm(r)}
          onCheckOut={() => openCheckOut(r)}
          onExtendStay={() => openExtendStay(r)}
        />
      ),
    },
  ], [openCheckOut])

  return (
    <div>
      <PageHeader
        title="Check Out"
        description="Guests departing today — checked-in reservations ready for check-out"
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

          {todayDepartures.length > 0 && !search && (
            <div className="mb-5">
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/60 rounded-xl px-4 py-2.5 mb-3">
                <CalendarDays className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Today — {formatTodayLabel()} ({todayDepartures.length} departure{todayDepartures.length !== 1 ? 's' : ''})
                </span>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/20 overflow-hidden">
                <table className="w-full table-fixed border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-amber-200/40 text-left text-xs font-medium uppercase tracking-wider text-amber-600/70">
                      <th className="w-[14%] px-4 py-2.5">Reservation</th>
                      <th className="w-[22%] px-4 py-2.5">Guest</th>
                      <th className="w-[12%] px-4 py-2.5">Room</th>
                      <th className="w-[16%] px-4 py-2.5">Departure</th>
                      <th className="w-[11%] px-4 py-2.5">Total</th>
                      <th className="w-[11%] px-4 py-2.5">Alerts</th>
                      <th className="w-[11%] px-4 py-2.5">Payment</th>
                      <th className="w-[16%] px-4 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100/60">
                    {todayDepartures.map((r) => {
                      const due = Number(r.due_amount ?? 0)
                      const isOverstay = r.status === 'checked_in' && r.check_out < todayStr
                      const overstayDays = isOverstay
                        ? Math.ceil((new Date(todayStr).getTime() - new Date(r.check_out).getTime()) / 86400000)
                        : 0
                      const hasRefund = r.refund_requested_at && r.payment_status !== 'refunded'
                      return (
                      <tr key={r.id} className="bg-amber-50/30 hover:bg-amber-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <button onClick={() => openDetailModal(r)} className="font-medium text-primary hover:underline">
                            {r.reservation_number}
                          </button>
                        </td>
                        <td className="px-4 py-3">
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
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground">{r.room?.room_number ?? '-'}</span>
                            <span className="block truncate text-xs text-muted">{r.room?.room_type?.name ?? '\u00A0'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{formatDateDisplay(r.check_out)}</span>
                            <TodayBadge variant="departure" />
                          </div>
                          <span className="block text-xs text-muted">arrived {formatDateDisplay(r.check_in)}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>
                            <span className="font-semibold tabular-nums text-foreground">{formatCurrency(r.total_amount)}</span>
                            {due > 0 ? (
                              <span className="block text-xs font-semibold tabular-nums text-danger">
                                Due {formatCurrency(due)}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs font-medium text-success">
                                <CheckCircle2 className="h-3 w-3" /> Settled
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {!isOverstay && !hasRefund ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <div className="flex items-center gap-1 flex-wrap">
                              {isOverstay && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-orange-50 text-orange-700 border border-orange-200/60">
                                  <AlertTriangle className="h-3 w-3" />
                                  Overstay ({overstayDays}d)
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
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={r.payment_status} pill />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <ReservationRowActions
                            reservation={r}
                            onView={() => openDetailModal(r)}
                            onEdit={() => openEditForm(r)}
                            onCheckOut={() => openCheckOut(r)}
                            onExtendStay={() => openExtendStay(r)}
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
            tableClassName="table-fixed border-collapse"
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <DoorOpen className="mb-3 h-10 w-10 text-muted/50" />
                <p className="text-sm font-medium text-foreground">No departures match your search</p>
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
        onExtendStay={openExtendStay}
      />

      <ReservationFormModal
        isOpen={showFormModal}
        onClose={closeFormModal}
        reservation={editingReservation}
      />

      <ReservationCheckInOutModal
        mode="check-out"
        reservation={checkOutModal.target}
        isOpen={checkOutModal.isOpen}
        isLoading={checkOutModal.isLoading}
        error={checkOutModal.error}
        onClose={closeCheckOut}
        onConfirm={confirmCheckOut}
        onConfirmAfterPayment={confirmAfterCheckOut}
      />

      <ExtendStayModal
        isOpen={!!extendTarget}
        onClose={() => setExtendTarget(null)}
        reservation={extendTarget}
        isLoading={extendStay.isPending}
        onConfirm={handleExtendStayConfirm}
      />
    </div>
  )
}
