import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  useReservations, useCancelReservation, useMarkNoShow, useExtendStay, useNotifyLateArrival, useSettings,
} from '@/hooks/useApi'
import { useCheckInOutModal } from '@/hooks/useCheckInOutModal'
import { formatCurrency, formatDateDisplay } from '@/lib/format'
import { cn } from '@/lib/utils'
import { getDateGroup, formatTodayLabel, toLocalDateStr } from '@/lib/date-group'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { TodayBadge } from '@/components/shared/TodayBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { NoShowModal } from '@/components/shared/NoShowModal'
import { LateArrivalModal } from '@/components/shared/LateArrivalModal'
import { CancelReservationModal } from '@/components/shared/CancelReservationModal'
import { ReservationDetailModal } from '@/components/shared/ReservationDetailModal'
import { ReservationFormModal } from '@/components/shared/ReservationFormModal'
import { ReservationCheckInOutModal } from '@/components/shared/ReservationCheckInOutModal'
import { ReservationRowActions } from '@/components/shared/ReservationRowActions'
import { ExtendStayModal } from '@/components/shared/ExtendStayModal'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import type { Reservation } from '@/types'
import {
  Plus, AlertTriangle, X, CalendarX2, CalendarDays, Search, Bell,
} from 'lucide-react'

function formatDate(dateStr: string) {
  return formatDateDisplay(dateStr)
}


const STATUS_TABS = [
  { value: '', label: 'All', dot: 'bg-slate-400' },
  { value: 'pending', label: 'Pending', dot: 'bg-yellow-500' },
  { value: 'confirmed', label: 'Confirmed', dot: 'bg-sky-500' },
  { value: 'late_arrival', label: 'Late Arrival', dot: 'bg-amber-500' },
  { value: 'checked_in', label: 'Checked In', dot: 'bg-emerald-500' },
  { value: 'checked_out', label: 'Checked Out', dot: 'bg-slate-400' },
  { value: 'cancelled', label: 'Cancelled', dot: 'bg-red-500' },
  { value: 'no_show', label: 'No Show', dot: 'bg-rose-500' },
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
  const [lateArrivalTarget, setLateArrivalTarget] = useState<Reservation | null>(null)
  const [extendTarget, setExtendTarget] = useState<Reservation | null>(null)

  const checkInModal = useCheckInOutModal('check-in')
  const checkOutModal = useCheckInOutModal('check-out')
  const { open: openCheckIn, confirmAfterPayment: confirmAfterCheckIn } = checkInModal
  const { open: openCheckOut, confirmAfterPayment: confirmAfterCheckOut } = checkOutModal

  const { data: settings } = useSettings()
  const bookingSettings = settings as Record<string, unknown> | undefined
  const holdHours = Number(bookingSettings?.late_arrival_hold_hours ?? 48)
  const earlyCheckinFeeSetting = Number(bookingSettings?.early_checkin_fee ?? 0)

  const lateArrivalDefaultDeadline = useMemo(() => {
    const d = new Date()
    d.setHours(d.getHours() + holdHours)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${day}T${h}:${min}`
  }, [holdHours])

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

  const todayStr = toLocalDateStr(new Date())
  const { data: todayArrivalsData } = useReservations({
    date_from: todayStr,
    per_page: 100,
    sort_field: 'check_in',
    sort_dir: 'asc',
  })

  const cancelReservation = useCancelReservation()
  const markNoShow = useMarkNoShow()
  const notifyLateArrival = useNotifyLateArrival()
  const extendStay = useExtendStay()

  const reservations = reservationsData?.data ?? []
  const totalPages = reservationsData?.last_page ?? 1

  const todayArrivals = useMemo(() => {
    const all = (todayArrivalsData?.data ?? []) as Reservation[]
    return all.filter((r) => r.check_in === todayStr && r.status !== 'cancelled' && r.status !== 'no_show')
  }, [todayArrivalsData, todayStr])

  const todayArrivalIds = useMemo(() => new Set(todayArrivals.map((r) => r.id)), [todayArrivals])

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

  const hasActiveFilters = Boolean(search || statusFilter || dateFrom || dateTo)

  const tableReservations = useMemo(() => {
    let data = reservations
    if (!hasActiveFilters) {
      data = reservations.filter((r) => !todayArrivalIds.has(r.id))
    }
    return [...data].sort((a, b) => {
      const aDead = a.status === 'cancelled' || a.status === 'no_show' ? 1 : 0
      const bDead = b.status === 'cancelled' || b.status === 'no_show' ? 1 : 0
      return aDead - bDead
    })
  }, [reservations, todayArrivalIds, hasActiveFilters])

  const clearAllFilters = useCallback(() => {
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setRefundRequestedOnly(false)
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
        const isTodayCheckIn = getDateGroup(r.check_in) === 'today'
        const isTodayCheckOut = getDateGroup(r.check_out) === 'today'
        return (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-sm">
              {isTodayCheckIn && <TodayBadge variant="arrival" />}
              <span>{formatDate(r.check_in)}</span>
            </div>
            <span className="text-xs text-slate-500">
              Departs {formatDate(r.check_out)}
              {isTodayCheckOut && <TodayBadge variant="departure" />}
            </span>
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
      render: (r) => <StatusBadge status={r.status} pill />,
    },
    {
      key: 'alerts',
      label: 'Alerts',
      sortable: false,
      className: 'whitespace-nowrap',
      render: (r) => {
        const hasNoShow = r.status === 'confirmed' && r.is_overdue
        const isLateArrival = r.status === 'late_arrival'
        const isOverstay = r.status === 'checked_in' && r.check_out < todayStr
        const overstayDays = isOverstay
          ? Math.ceil((new Date(todayStr).getTime() - new Date(r.check_out).getTime()) / 86400000)
          : 0
        if (!hasNoShow && !isLateArrival && !isOverstay) {
          return <span className="text-slate-300">—</span>
        }
        return (
          <div className="flex items-center gap-1 flex-wrap">
            {hasNoShow && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-rose-50 text-rose-700 border border-rose-200/60">
                <AlertTriangle className="h-3 w-3" />
                Overdue
              </span>
            )}
            {isLateArrival && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
                <Bell className="h-3 w-3" />
                Hold Active
              </span>
            )}
            {isOverstay && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-orange-50 text-orange-700 border border-orange-200/60">
                <AlertTriangle className="h-3 w-3" />
                Overstay ({overstayDays}d)
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
          onCancel={() => openCancelDialog(r)}
          onCheckIn={() => openCheckIn(r)}
          onCheckOut={() => openCheckOut(r)}
          onMarkNoShow={() => setNoShowTarget(r)}
          onLateArrival={() => handleLateArrival(r)}
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
          {/* ── Row 1: Status Tabs ── */}
          <div className="mb-5 inline-flex flex-wrap items-center gap-0.5 rounded-xl bg-slate-100 p-1">
            {STATUS_TABS.map((tab) => {
              const isActive = statusFilter === tab.value
              return (
                <button
                  key={tab.value}
                  onClick={() => handleStatusFilterValue(tab.value)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[#1A2238] text-white shadow-sm'
                      : 'bg-transparent text-slate-600 hover:bg-white/80 hover:text-slate-900'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${tab.dot}`} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* ── Row 2: Search + Controls ── */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                id="reservation-search"
                name="reservationSearch"
                aria-label="Search by reservation number or guest name"
                type="text"
                placeholder="Search by reservation # or guest name..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-lg border border-slate-200 bg-white text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
              />
            </div>

            {/* Date Pickers */}
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
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Active:</span>
              {search && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
                  Search: {search}
                  <button onClick={() => handleSearchChange('')} className="hover:text-red-500 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
                  Status: {STATUS_TABS.find(o => o.value === statusFilter)?.label}
                  <button onClick={() => handleStatusFilterValue('')} className="hover:text-red-500 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {dateFrom && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
                  From: {dateFrom}
                  <button onClick={() => { setDateFrom(''); setPage(1) }} className="hover:text-red-500 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {dateTo && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
                  To: {dateTo}
                  <button onClick={() => { setDateTo(''); setPage(1) }} className="hover:text-red-500 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <button
                onClick={clearAllFilters}
                className="text-xs font-medium text-slate-400 hover:text-red-500 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}

          {todayArrivals.length > 0 && !hasActiveFilters && (
            <div className="mb-5">
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/60 rounded-xl px-4 py-2.5 mb-3">
                <CalendarDays className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Arriving Today — {formatTodayLabel()} ({todayArrivals.length} reservation{todayArrivals.length !== 1 ? 's' : ''})
                </span>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/20 overflow-hidden">
                <table className="w-full table-auto border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-amber-200/40 text-left text-xs font-medium uppercase tracking-wider text-amber-600/70">
                      <th className="px-2 h-10">Reservation</th>
                      <th className="px-2 h-10">Guest</th>
                      <th className="px-2 h-10">Room</th>
                      <th className="whitespace-nowrap px-2 h-10">Stay</th>
                      <th className="whitespace-nowrap px-2 h-10">Total</th>
                      <th className="whitespace-nowrap px-2 h-10">Status</th>
                      <th className="whitespace-nowrap px-2 h-10">Alerts</th>
                      <th className="whitespace-nowrap px-2 h-10">Payment</th>
                      <th className="whitespace-nowrap px-2 h-10 pr-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100/60">
                    {todayArrivals.map((r) => {
                      const name = `${r.guest?.first_name ?? ''} ${r.guest?.last_name ?? ''}`.trim() || '-'
                      const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
                      const due = Number(r.due_amount ?? 0)
                      return (
                        <tr key={r.id} className="h-16 bg-amber-50/30 hover:bg-amber-50/60 transition-colors align-middle">
                          <td className="px-2">
                            <button
                              onClick={() => openDetailModal(r)}
                              className="block max-w-[160px] truncate text-primary hover:underline font-medium"
                            >
                              {r.reservation_number}
                            </button>
                          </td>
                          <td className="px-2">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <span className="block truncate text-sm font-medium text-foreground">{name}</span>
                                <span className="block truncate text-xs text-muted">{r.guest?.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-2">
                            <div className="min-w-0">
                              <span className="font-semibold text-foreground">{r.room?.room_number ?? '-'}</span>
                              <span className="block truncate text-xs text-muted">{r.room?.room_type?.name ?? '\u00A0'}</span>
                            </div>
                          </td>
                          <td className="px-2 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 text-sm">
                                <TodayBadge variant="arrival" />
                                <span>{formatDate(r.check_in)}</span>
                              </div>
                              <span className="text-xs text-slate-500">Departs {formatDate(r.check_out)}</span>
                            </div>
                          </td>
                          <td className="px-2 whitespace-nowrap">
                            <div>
                              <span className="font-semibold tabular-nums text-foreground">{formatCurrency(r.total_amount)}</span>
                              <span className={cn('block text-xs tabular-nums', due > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                                {due > 0 ? `Due ${formatCurrency(due)}` : 'Fully paid'}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 whitespace-nowrap">
                            <StatusBadge status={r.status} pill />
                          </td>
                          <td className="px-2 whitespace-nowrap">
                            {(() => {
                              const hasNoShow = r.status === 'confirmed' && r.is_overdue
                              const isOverstay = r.status === 'checked_in' && r.check_out < todayStr
                              const overstayDays = isOverstay
                                ? Math.ceil((new Date(todayStr).getTime() - new Date(r.check_out).getTime()) / 86400000)
                                : 0
                              if (!hasNoShow && !isOverstay) {
                                return <span className="text-slate-300">—</span>
                              }
                              return (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {hasNoShow && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-rose-50 text-rose-700 border border-rose-200/60">
                                      <AlertTriangle className="h-3 w-3" />
                                      Overdue
                                    </span>
                                  )}
                                  {isOverstay && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-orange-50 text-orange-700 border border-orange-200/60">
                                      <AlertTriangle className="h-3 w-3" />
                                      Overstay ({overstayDays}d)
                                    </span>
                                  )}
                                </div>
                              )
                            })()}
                          </td>
                          <td className="px-2 whitespace-nowrap">
                            <StatusBadge status={r.payment_status} pill />
                          </td>
                           <td className="px-2 whitespace-nowrap pr-2">
                            <ReservationRowActions
                              reservation={r}
                              onView={() => openDetailModal(r)}
                              onEdit={() => openEditForm(r)}
                              onCancel={() => openCancelDialog(r)}
                              onCheckIn={() => openCheckIn(r)}
                              onCheckOut={() => openCheckOut(r)}
                              onMarkNoShow={() => setNoShowTarget(r)}
                              onLateArrival={() => handleLateArrival(r)}
                              onExtendStay={() => openExtendStay(r)}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DataTable
            columns={columns}
            data={tableReservations}
            loading={isLoading}
            error={error ? 'Failed to load reservations' : null}
            sortBy={sortBy}
            onSort={handleSort}
            tableClassName="table-auto border-collapse"
            renderGroupHeader={(_key, rows) => (
              <div className="flex items-center gap-2 -mx-4 px-4 py-2.5">
                <CalendarDays className="h-4 w-4 text-muted" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  All Reservations ({rows.length})
                </span>
              </div>
            )}
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
        earlyCheckinFee={earlyCheckinFeeSetting}
        waiveEarlyFee={checkInModal.waiveEarlyFee}
        onSetWaive={checkInModal.setWaive}
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

      <LateArrivalModal
        isOpen={!!lateArrivalTarget}
        onClose={() => setLateArrivalTarget(null)}
        reservation={lateArrivalTarget}
        defaultDeadline={lateArrivalDefaultDeadline}
        isLoading={notifyLateArrival.isPending}
        onConfirm={handleLateArrivalConfirm}
      />
    </div>
  )
}
