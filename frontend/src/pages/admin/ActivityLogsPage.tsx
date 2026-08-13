import { useState, useMemo } from 'react'
import { useActivityLogs, useStaffAssignable } from '@/hooks/useApi'
import type { ActivityLog } from '@/types'
import { formatDateDisplay } from '@/lib/format'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { RowActions, RowActionButton } from '@/components/shared/RowActions'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Eye, AlertCircle, User, UserX, Clock, Server, Braces } from 'lucide-react'

const MODULES = [
  'reservations',
  'payments',
  'invoices',
  'guests',
  'housekeeping',
  'maintenance',
  'expenses',
  'staff',
  'room_list',
  'rooms',
  'auth',
  'settings',
]

const MODULE_LABELS: Record<string, string> = {
  reservations: 'Reservations',
  payments: 'Payments',
  invoices: 'Invoices',
  guests: 'Guests',
  housekeeping: 'Housekeeping',
  maintenance: 'Maintenance',
  expenses: 'Expenses',
  staff: 'Staff',
  room_list: 'Room List',
  rooms: 'Rooms',
  auth: 'Auth',
  settings: 'Settings',
}

const MODULE_COLORS: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'default' | 'gold'> = {
  reservations: 'info',
  payments: 'success',
  invoices: 'gold',
  guests: 'warning',
  housekeeping: 'default',
  maintenance: 'danger',
  expenses: 'info',
  staff: 'default',
  room_list: 'default',
  rooms: 'warning',
  auth: 'default',
  settings: 'default',
}

const ACTIONS = [
  'created',
  'updated',
  'deleted',
  'checked_in',
  'checked_out',
  'cancelled',
  'marked_no_show',
  'extended_stay',
  'status_changed',
  'assigned',
  'flagged_overdue',
  'cleared_overdue',
  'notified_overdue',
  'late_checkout',
]

const ACTION_LABELS: Record<string, string> = {
  created: 'Created',
  updated: 'Updated',
  deleted: 'Deleted',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
  marked_no_show: 'No Show',
  extended_stay: 'Extended Stay',
  status_changed: 'Status Changed',
  assigned: 'Assigned',
  flagged_overdue: 'Flagged Overdue',
  cleared_overdue: 'Cleared Overdue',
  notified_overdue: 'Overdue Notified',
  late_checkout: 'Late Check-Out',
}

const ACTION_COLORS: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  created: 'success',
  updated: 'info',
  deleted: 'danger',
  checked_in: 'success',
  checked_out: 'warning',
  cancelled: 'danger',
  marked_no_show: 'danger',
  extended_stay: 'info',
  status_changed: 'warning',
  assigned: 'info',
  flagged_overdue: 'danger',
  cleared_overdue: 'success',
  notified_overdue: 'warning',
  late_checkout: 'warning',
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '-'
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return `${formatDateDisplay(dateStr)} · ${time}`
}

function isGuestRow(a: ActivityLog): boolean {
  return !a.user && !a.user_id
}

export default function ActivityLogsPage() {
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [staffFilter, setStaffFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ActivityLog | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  const queryParams = useMemo(() => {
    const params: Record<string, string | number | undefined> = { page }
    if (search) params.search = search
    if (scope) params.scope = scope
    if (moduleFilter) params.module = moduleFilter
    if (actionFilter) params.action = actionFilter
    if (staffFilter) params.user_id = staffFilter
    return params
  }, [page, search, scope, moduleFilter, actionFilter, staffFilter])

  const { data: logsData, isLoading, error, refetch } = useActivityLogs(queryParams)
  const { data: staffOptions } = useStaffAssignable()

  const logs = logsData?.data ?? []
  const totalPages = logsData?.last_page ?? 1

  function openDetail(log: ActivityLog) {
    setSelected(log)
    setShowDetail(true)
  }

  function resetPage(fn: (v: string) => void) {
    return (v: string) => { fn(v); setPage(1) }
  }

  const columns: Column<ActivityLog>[] = [
    {
      key: 'created_at',
      label: 'Time',
      render: (a) => <span className="whitespace-nowrap text-muted">{formatDateTime(a.created_at)}</span>,
    },
    {
      key: 'actor',
      label: 'Actor',
      render: (a) =>
        isGuestRow(a) ? (
          <span className="inline-flex items-center gap-1 text-muted">
            <UserX className="h-3.5 w-3.5" /> Guest
          </span>
        ) : (
          <span className="font-medium text-foreground">{a.user?.name ?? 'Unknown'}</span>
        ),
    },
    {
      key: 'module',
      label: 'Module',
      render: (a) => (
        <Badge variant={MODULE_COLORS[a.module] ?? 'default'}>
          {MODULE_LABELS[a.module] ?? a.module}
        </Badge>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (a) => (
        <Badge variant={ACTION_COLORS[a.action] ?? 'default'}>
          {ACTION_LABELS[a.action] ?? a.action}
        </Badge>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (a) => (
        <span className="block max-w-[360px] truncate text-foreground">{a.description || '-'}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (a) => (
        <RowActions>
          <RowActionButton
            tone="neutral"
            title="View"
            icon={<Eye className="h-4 w-4" />}
            onClick={() => openDetail(a)}
          />
        </RowActions>
      ),
    },
  ]

  const hasDiff = selected && (selected.old_values || selected.new_values)

  return (
    <div>
      <PageHeader
        title="Activity Logs"
        description="Audit trail of staff and guest actions across the system."
      />

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative max-w-xs flex-1">
              <Input
                placeholder="Search description..."
                value={search}
                onChange={(e) => resetPage(setSearch)(e.target.value)}
              />
            </div>
            <Select
              value={scope}
              onChange={(e) => { setScope(e.target.value); setPage(1) }}
              className="w-36"
            >
              <option value="">All Actors</option>
              <option value="staff">Staff</option>
              <option value="guest">Guest</option>
            </Select>
            <Select
              value={moduleFilter}
              onChange={(e) => { setModuleFilter(e.target.value); setPage(1) }}
              className="w-40"
            >
              <option value="">All Modules</option>
              {MODULES.map((m) => (
                <option key={m} value={m}>{MODULE_LABELS[m] ?? m}</option>
              ))}
            </Select>
            <Select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
              className="w-40"
            >
              <option value="">All Actions</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
              ))}
            </Select>
            {scope !== 'guest' && (
              <Select
                value={staffFilter}
                onChange={(e) => { setStaffFilter(e.target.value); setPage(1) }}
                className="w-44"
              >
                <option value="">All Staff</option>
                {(staffOptions ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            )}
          </div>

          <DataTable
            columns={columns}
            data={logs}
            loading={isLoading}
            error={error ? 'Failed to load activity logs' : null}
            pagination={logsData ? {
              currentPage: page,
              lastPage: totalPages,
              total: logsData.total,
              from: (logsData.current_page - 1) * logsData.per_page + 1,
              to: Math.min(logsData.current_page * logsData.per_page, logsData.total),
              onPageChange: setPage,
            } : undefined}
            onRetry={() => refetch()}
            keyExtractor={(a) => a.id}
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        title="Activity Details"
        size="lg"
      >
        {selected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted flex items-center gap-1">
                  <User className="h-3 w-3" /> Actor
                </label>
                <p className="mt-0.5 text-sm text-foreground break-words">
                  {isGuestRow(selected) ? (
                    <span className="inline-flex items-center gap-1 text-muted">
                      <UserX className="h-3.5 w-3.5" /> Guest
                    </span>
                  ) : (
                    selected.user?.name ?? 'Unknown'
                  )}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Time
                </label>
                <p className="mt-0.5 text-sm text-foreground">{formatDateTime(selected.created_at)}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Module</label>
                <div className="mt-0.5">
                  <Badge variant={MODULE_COLORS[selected.module] ?? 'default'}>
                    {MODULE_LABELS[selected.module] ?? selected.module}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Action</label>
                <div className="mt-0.5">
                  <Badge variant={ACTION_COLORS[selected.action] ?? 'default'}>
                    {ACTION_LABELS[selected.action] ?? selected.action}
                  </Badge>
                </div>
              </div>
              {selected.model_type && (
                <div>
                  <label className="text-xs font-medium text-muted">Model</label>
                  <p className="mt-0.5 text-sm text-muted">
                    {selected.model_type}
                    {selected.model_id ? ` #${selected.model_id}` : ''}
                  </p>
                </div>
              )}
              {selected.ip_address && (
                <div>
                  <label className="text-xs font-medium text-muted flex items-center gap-1">
                    <Server className="h-3 w-3" /> IP Address
                  </label>
                  <p className="mt-0.5 text-sm text-muted">{selected.ip_address}</p>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted">Description</label>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">{selected.description || '-'}</p>
              </div>
              {hasDiff && (
                <div className="sm:col-span-2 space-y-3">
                  {selected.new_values && (
                    <div>
                      <label className="text-xs font-medium text-muted flex items-center gap-1">
                        <Braces className="h-3 w-3" /> New Values
                      </label>
                      <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg p-3 text-xs text-foreground">
                        {JSON.stringify(selected.new_values, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selected.old_values && (
                    <div>
                      <label className="text-xs font-medium text-muted flex items-center gap-1">
                        <Braces className="h-3 w-3" /> Old Values
                      </label>
                      <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg p-3 text-xs text-foreground">
                        {JSON.stringify(selected.old_values, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 text-center">
            <AlertCircle className="mb-2 h-8 w-8 text-muted" />
            <p className="text-sm text-muted">Could not load activity details.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
