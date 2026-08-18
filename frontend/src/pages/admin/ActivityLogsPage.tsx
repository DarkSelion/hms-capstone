import { useState, useMemo } from 'react'
import { useActivityLogs, useStaffAssignable } from '@/hooks/useApi'
import type { ActivityLog } from '@/types'
import { formatDateDisplay, formatCurrency } from '@/lib/format'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { RowActions, RowActionButton } from '@/components/shared/RowActions'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Eye, AlertCircle, UserX, Clock, Server, MonitorSmartphone, GitCompareArrows,
  BedDouble, CreditCard, ReceiptText, UserRound, Sparkles, Wrench, Wallet,
  DoorOpen, Users, Lock, Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

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

const MODULE_ICONS: Record<string, LucideIcon> = {
  reservations: BedDouble,
  payments: CreditCard,
  invoices: ReceiptText,
  guests: UserRound,
  housekeeping: Sparkles,
  maintenance: Wrench,
  expenses: Wallet,
  staff: Users,
  room_list: DoorOpen,
  rooms: DoorOpen,
  auth: Lock,
  settings: Settings,
}

function moduleTileClass(module: string): string {
  switch (MODULE_COLORS[module] ?? 'default') {
    case 'gold': return 'bg-gold/20 text-gold-dark'
    case 'success': return 'bg-success/10 text-success'
    case 'warning': return 'bg-warning/10 text-warning'
    case 'danger': return 'bg-danger/10 text-danger'
    case 'info': return 'bg-info/10 text-info'
    default: return 'bg-border/50 text-muted'
  }
}

/** Human-friendly labels for common changed fields in the diff table. */
const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  payment_status: 'Payment Status',
  cleaning_status: 'Cleaning Status',
  price_per_night: 'Price / Night',
  total_amount: 'Total Amount',
  paid_amount: 'Paid Amount',
  due_amount: 'Balance Due',
  discount_percent: 'Discount %',
  tax_percent: 'Tax %',
  room_id: 'Room',
  guest_id: 'Guest',
  check_in: 'Check-in',
  check_out: 'Check-out',
  is_active: 'Active',
  is_blacklisted: 'Blacklisted',
  is_overdue: 'Overdue',
  role_id: 'Role',
  notes: 'Notes',
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const CURRENCY_FIELDS = new Set(['price_per_night', 'total_amount', 'paid_amount', 'due_amount', 'discount_percent', 'tax_percent'])

/** Pretty-print a single changed value (currency, dates, booleans, JSON, plain text). */
function formatDiffValue(value: unknown, field?: string): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number' && field && CURRENCY_FIELDS.has(field)) {
    return formatCurrency(value)
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string' && field && CURRENCY_FIELDS.has(field) && value.trim() !== '') {
    const parsed = Number(value)
    if (!isNaN(parsed)) return formatCurrency(parsed)
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const formatted = formatDateDisplay(value)
      if (formatted !== '-') return formatted
    }
    return value
  }
  if (Array.isArray(value) || isPlainObject(value)) {
    return JSON.stringify(value)
  }
  return String(value)
}

function humanizeField(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Friendly change view: side-by-side Before/After table over the union of
 * keys in old_values and new_values. Falls back to showing just the "After"
 * values when old values are absent (e.g. a record was created).
 */
function ChangeTable({
  oldValues,
  newValues,
}: {
  oldValues: Record<string, unknown> | null | undefined
  newValues: Record<string, unknown> | null | undefined
}) {
  const oldObj = isPlainObject(oldValues) ? oldValues : {}
  const newObj = isPlainObject(newValues) ? newValues : {}
  const keys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]))

  if (keys.length === 0) {
    return <p className="text-sm text-muted">No field-level changes recorded.</p>
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-bg text-xs text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Field</th>
            <th className="px-3 py-2 font-medium">Before</th>
            <th className="px-3 py-2 font-medium">After</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {keys.map((key) => (
            <tr key={key}>
              <td className="px-3 py-2 font-medium text-foreground">{humanizeField(key)}</td>
              <td className="px-3 py-2 text-muted">
                <span className="block max-w-[200px] truncate" title={formatDiffValue(oldObj[key], key)}>
                  {formatDiffValue(oldObj[key], key)}
                </span>
              </td>
              <td className="px-3 py-2 text-foreground">
                <span className="block max-w-[200px] truncate" title={formatDiffValue(newObj[key], key)}>
                  {formatDiffValue(newObj[key], key)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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

function formatLongDateTime(dateStr: string) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '-'
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return `${formatDateDisplay(dateStr, 'long')} · ${time}`
}

function isGuestRow(a: ActivityLog): boolean {
  return !a.user && !a.user_id
}

type DescriptionToken =
  | { type: 'text'; value: string }
  | { type: 'reservation'; value: string }
  | { type: 'id'; value: string }
  | { type: 'currency'; value: string }
  | { type: 'email'; value: string }

const DESCRIPTION_TOKEN_PATTERN =
  /(#(?:BK|INV|PAY|REF)-\d{4}-\d{4}(?:-[A-Za-z0-9]+)?)|(#\d+)|(₱[\d,]+(?:\.\d{2})?)|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g

function splitDescription(description: string): DescriptionToken[] {
  const tokens: DescriptionToken[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  DESCRIPTION_TOKEN_PATTERN.lastIndex = 0
  while ((match = DESCRIPTION_TOKEN_PATTERN.exec(description)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: description.slice(lastIndex, match.index) })
    }
    if (match[1]) {
      tokens.push({ type: 'reservation', value: match[1] })
    } else if (match[2]) {
      tokens.push({ type: 'id', value: match[2] })
    } else if (match[3]) {
      tokens.push({ type: 'currency', value: match[3] })
    } else if (match[4]) {
      tokens.push({ type: 'email', value: match[4] })
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < description.length) {
    tokens.push({ type: 'text', value: description.slice(lastIndex) })
  }
  return tokens
}

function DescriptionText({ description }: { description?: string }) {
  if (!description) return <span className="text-sm text-muted">—</span>
  const tokens = splitDescription(description)
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
      {tokens.map((token, i) => {
        if (token.type === 'reservation') {
          return (
            <span
              key={i}
              className="inline-flex items-center rounded-md bg-gold/15 px-1.5 py-0.5 font-mono text-xs font-semibold text-gold-dark"
            >
              {token.value}
            </span>
          )
        }
        if (token.type === 'id') {
          return (
            <span
              key={i}
              className="inline-flex items-center rounded-md bg-bg px-1.5 py-0.5 font-mono text-xs font-medium text-primary"
            >
              {token.value}
            </span>
          )
        }
        if (token.type === 'currency') {
          return (
            <span key={i} className="font-semibold text-success">
              {token.value}
            </span>
          )
        }
        if (token.type === 'email') {
          return (
            <span key={i} className="font-mono text-xs text-muted">
              {token.value}
            </span>
          )
        }
        return <span key={i}>{token.value}</span>
      })}
    </p>
  )
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
        size="xl"
        footer={
          <Button variant="outline" onClick={() => setShowDetail(false)}>
            Close
          </Button>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${moduleTileClass(selected.module)}`}>
                  {(() => {
                    const Icon = MODULE_ICONS[selected.module] ?? UserRound
                    return <Icon className="h-5 w-5" />
                  })()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {isGuestRow(selected) ? 'Guest' : (selected.user?.name ?? 'Unknown')}
                  </p>
                  <p className="text-xs text-muted">
                    {isGuestRow(selected) ? 'Portal / customer action' : 'Staff member'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Badge variant={ACTION_COLORS[selected.action] ?? 'default'}>
                  {ACTION_LABELS[selected.action] ?? selected.action}
                </Badge>
                <Badge variant={MODULE_COLORS[selected.module] ?? 'default'}>
                  {MODULE_LABELS[selected.module] ?? selected.module}
                </Badge>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${moduleTileClass(selected.module)}`}>
                  {(() => {
                    const Icon = MODULE_ICONS[selected.module] ?? UserRound
                    return <Icon className="h-4 w-4" />
                  })()}
                </div>
                <h4 className="text-sm font-semibold text-foreground">What Happened</h4>
              </div>
              <DescriptionText description={selected.description} />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <UserRound className="h-3.5 w-3.5" /> Actor
                  </p>
                  <p className="break-words text-sm font-semibold text-foreground">
                    {isGuestRow(selected) ? 'Guest' : (selected.user?.name ?? 'Unknown')}
                  </p>
                  {selected.user?.email && (
                    <p className="mt-0.5 truncate text-xs text-muted">{selected.user.email}</p>
                  )}
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <Clock className="h-3.5 w-3.5" /> Time
                  </p>
                  <p className="text-sm font-semibold text-foreground">{formatLongDateTime(selected.created_at)}</p>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <Server className="h-3.5 w-3.5" /> IP Address
                  </p>
                  <p className="break-words text-sm font-semibold text-foreground">{selected.ip_address || '—'}</p>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <MonitorSmartphone className="h-3.5 w-3.5" /> Device
                  </p>
                  <p className="truncate text-sm font-semibold text-foreground" title={selected.user_agent}>
                    {selected.user_agent || '—'}
                  </p>
                </div>
                {selected.model_type && (
                  <div className="rounded-xl bg-bg p-3 sm:col-span-2">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                      <BedDouble className="h-3.5 w-3.5" /> Related Record
                    </p>
                    <p className="break-words text-sm font-semibold text-foreground">
                      {selected.model_type}
                      {selected.model_id ? ` #${selected.model_id}` : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {hasDiff && (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10 text-info">
                    <GitCompareArrows className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">Changes</h4>
                </div>
                <ChangeTable oldValues={selected.old_values} newValues={selected.new_values} />
              </div>
            )}
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
