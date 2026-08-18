import { useState } from 'react'
import { useRevenueReport, useOccupancyReport, useReservationReport } from '@/hooks/useApi'
import { formatCurrency, formatDateDisplay, toLocalDateStr } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableContainer } from '@/components/ui/table'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { DollarSign, CalendarDays, Percent, Hotel, Download, AlertCircle, RotateCcw, Inbox } from 'lucide-react'
import { downloadFile } from '@/lib/api'
import { useToast } from '@/components/ui/toast'

const REPORTS_TABS = ['Revenue', 'Occupancy', 'Reservations', 'Export'] as const

const REPORT_TYPES = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'occupancy', label: 'Occupancy' },
  { value: 'reservations', label: 'Reservations' },
]

const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'pdf', label: 'PDF' },
]

const PIE_COLORS = ['#f59e0b', '#1e3a5f', '#10b981', '#c9a84c', '#ef4444', '#6b7280']

const EARLIEST_DATE = '2000-01-01'

const PRESET_RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'thisYear', label: 'This year' },
]

function presetRange(key: string): { from: string; to: string } {
  const today = new Date()
  const to = toLocalDateStr(today)
  switch (key) {
    case 'today':
      return { from: to, to }
    case 'last7':
      return { from: toLocalDateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)), to }
    case 'last30':
      return { from: toLocalDateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)), to }
    case 'thisMonth':
      return {
        from: toLocalDateStr(new Date(today.getFullYear(), today.getMonth(), 1)),
        to: toLocalDateStr(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
      }
    case 'lastMonth':
      return {
        from: toLocalDateStr(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: toLocalDateStr(new Date(today.getFullYear(), today.getMonth(), 0)),
      }
    case 'thisYear':
      return {
        from: toLocalDateStr(new Date(today.getFullYear(), 0, 1)),
        to: toLocalDateStr(new Date(today.getFullYear(), 11, 31)),
      }
    default:
      return { from: to, to }
  }
}

function presetKeyFor(range: { from: string; to: string }): string | null {
  for (const p of PRESET_RANGES) {
    const r = presetRange(p.key)
    if (r.from === range.from && r.to === range.to) return p.key
  }
  return null
}

function dayCount(from: string, to: string): number {
  if (!from || !to) return 0
  const a = new Date(from + 'T00:00:00')
  const b = new Date(to + 'T00:00:00')
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return formatDateDisplay(dateStr)
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
      <p className="text-sm text-muted">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} className="text-sm font-semibold" style={{ color: entry.color }}>
          {typeof entry.value === 'number' && entry.name !== 'bookings' && entry.name !== 'rate'
            ? formatCurrency(entry.value)
            : entry.value}
        </p>
      ))}
    </div>
  )
}

function ReportRangeFilter({ value, onApply, max }: {
  value: { from: string; to: string }
  onApply: (range: { from: string; to: string }) => void
  max: string
}) {
  const [customOpen, setCustomOpen] = useState(false)
  const [pending, setPending] = useState(value)
  const active = presetKeyFor(value)

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {PRESET_RANGES.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              const r = presetRange(p.key)
              setPending(r)
              setCustomOpen(false)
              onApply(r)
            }}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              active === p.key
                ? 'bg-gold text-dark shadow-sm'
                : 'bg-bg text-muted hover:bg-cream hover:text-primary',
            )}
          >
            {p.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setCustomOpen(!customOpen)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
            customOpen
              ? 'bg-primary text-white shadow-sm'
              : 'bg-bg text-muted hover:bg-cream hover:text-primary',
          )}
        >
          <CalendarDays className="h-4 w-4" />
          Custom range
        </button>
      </div>

      {customOpen && (
        <div className="mt-3">
          <div className="w-64">
            <DateRangePicker
              value={pending}
              onChange={(r) => {
                setPending(r)
                if (r.from && r.to) {
                  onApply(r)
                  setCustomOpen(false)
                }
              }}
              min={EARLIEST_DATE}
              max={max}
              placeholder="Select a date range"
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            Pick a start and end date — the report updates automatically.
          </p>
        </div>
      )}

      <p className="mt-3 text-xs text-muted">
        Showing{' '}
        <span className="font-medium text-foreground">
          {formatDateDisplay(value.from)} — {formatDateDisplay(value.to)}
        </span>{' '}
        ({dayCount(value.from, value.to)} days)
      </p>
    </div>
  )
}

export default function ReportsPage() {
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState<string>('Revenue')

  const today = toLocalDateStr(new Date())

  const [revenueRange, setRevenueRange] = useState(() => presetRange('last30'))
  const [occupancyRange, setOccupancyRange] = useState(() => presetRange('last30'))
  const [reservationRange, setReservationRange] = useState(() => presetRange('last30'))
  const [exportRange, setExportRange] = useState(() => presetRange('last30'))

  const [exportType, setExportType] = useState('revenue')
  const [exportFormat, setExportFormat] = useState('csv')

  const { data: revenueData, isLoading: revenueLoading, error: revenueError, refetch: refetchRevenue } = useRevenueReport({ from: revenueRange.from, to: revenueRange.to })
  const { data: occupancyData, isLoading: occupancyLoading, error: occupancyError, refetch: refetchOccupancy } = useOccupancyReport({ from: occupancyRange.from, to: occupancyRange.to })
  const { data: reservationData, isLoading: reservationLoading, error: reservationError, refetch: refetchReservations } = useReservationReport({ from: reservationRange.from, to: reservationRange.to })

  const revenue = (revenueData ?? []) as any[]
  const occupancy = (occupancyData ?? []) as any[]
  const reservations = (reservationData ?? []) as any

  const totalRevenue = revenue.reduce((sum: number, r: any) => sum + (r.revenue ?? 0), 0)
  const totalBookings = revenue.reduce((sum: number, r: any) => sum + (r.bookings ?? 0), 0)
  const avgDailyRate = totalBookings > 0 ? totalRevenue / totalBookings : 0
  const revpar = revenue.length > 0 ? totalRevenue / revenue.length : 0

  const avgOccupancy = occupancy.length > 0
    ? occupancy.reduce((sum: number, o: any) => sum + (o.rate ?? 0), 0) / occupancy.length
    : 0

  const statusBreakdown = reservations?.status_breakdown ?? []
  const totalReservations = reservations?.total ?? 0

  async function handleExport() {
    const params = new URLSearchParams({
      format: exportFormat === 'pdf' ? 'pdf' : 'csv',
      from: exportRange.from,
      to: exportRange.to,
    })
    try {
      const { blob, filename } = await downloadFile(
        `/reports/export/${exportType}?${params}`,
        exportFormat === 'pdf' ? 'application/pdf' : 'text/csv',
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      addToast('Export failed. Please try again.', 'error')
    }
  }

  return (
    <div>
      <PageHeader title="Reports" />

      <div className="mb-6 flex gap-1 rounded-lg bg-border/50 p-0.5 w-fit">
        {REPORTS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Revenue' && (
        <div className="space-y-6">
          <ReportRangeFilter value={revenueRange} onApply={setRevenueRange} max={today} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<DollarSign className="h-5 w-5" />} label="Total Revenue" value={formatCurrency(totalRevenue)} />
            <StatCard icon={<Percent className="h-5 w-5" />} label="Average Daily Rate" value={formatCurrency(avgDailyRate)} />
            <StatCard icon={<CalendarDays className="h-5 w-5" />} label="Total Bookings" value={totalBookings} />
            <StatCard icon={<Hotel className="h-5 w-5" />} label="RevPAR" value={formatCurrency(revpar)} />
          </div>

          {revenueLoading ? (
            <ChartSkeleton />
          ) : revenueError ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12">
              <AlertCircle className="mb-3 h-10 w-10 text-danger" />
              <p className="mb-4 text-sm text-muted">{(revenueError as Error).message}</p>
              <Button variant="outline" onClick={() => refetchRevenue()}>
                <RotateCcw className="h-4 w-4" /> Retry
              </Button>
            </div>
          ) : revenue.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12">
              <Inbox className="mb-3 h-10 w-10 text-muted/50" />
              <p className="text-sm font-medium text-foreground">No data for selected period</p>
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Daily Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenue}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          tickFormatter={(val) => {
                            const d = new Date(val)
                            return `${d.getMonth() + 1}/${d.getDate()}`
                          }}
                        />
                        <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="revenue" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue Details</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {revenueLoading ? (
                    <TableSkeleton />
                  ) : (
                    <TableContainer>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Revenue</TableHead>
                            <TableHead>Bookings</TableHead>
                            <TableHead>ADR</TableHead>
                            <TableHead>Occupancy %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {revenue.map((r: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{formatDate(r.date)}</TableCell>
                              <TableCell>{formatCurrency(r.revenue ?? 0)}</TableCell>
                              <TableCell>{r.bookings ?? 0}</TableCell>
                              <TableCell>{formatCurrency(r.adr ?? 0)}</TableCell>
                              <TableCell>{r.occupancy_rate != null ? `${Math.round(r.occupancy_rate)}%` : '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {activeTab === 'Occupancy' && (
        <div className="space-y-6">
          <ReportRangeFilter value={occupancyRange} onApply={setOccupancyRange} max={today} />

          {occupancyLoading ? (
            <ChartSkeleton />
          ) : occupancyError ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12">
              <AlertCircle className="mb-3 h-10 w-10 text-danger" />
              <p className="mb-4 text-sm text-muted">{(occupancyError as Error).message}</p>
              <Button variant="outline" onClick={() => refetchOccupancy()}>
                <RotateCcw className="h-4 w-4" /> Retry
              </Button>
            </div>
          ) : occupancy.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12">
              <Inbox className="mb-3 h-10 w-10 text-muted/50" />
              <p className="text-sm font-medium text-foreground">No data for selected period</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  icon={<Percent className="h-5 w-5" />}
                  label="Average Occupancy"
                  value={`${Math.round(avgOccupancy)}%`}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Occupancy Rate Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={occupancy}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          tickFormatter={(val) => {
                            const d = new Date(val)
                            return `${d.getMonth() + 1}/${d.getDate()}`
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          tickFormatter={(val) => `${val}%`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="rate"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#10b981' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Occupancy Details</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <TableContainer>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Available Rooms</TableHead>
                          <TableHead>Booked Rooms</TableHead>
                          <TableHead>Occupancy %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {occupancy.map((o: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{formatDate(o.date)}</TableCell>
                            <TableCell>{o.available_rooms ?? '-'}</TableCell>
                            <TableCell>{o.booked_rooms ?? '-'}</TableCell>
                            <TableCell>{o.rate != null ? `${Math.round(o.rate)}%` : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {activeTab === 'Reservations' && (
        <div className="space-y-6">
          <ReportRangeFilter value={reservationRange} onApply={setReservationRange} max={today} />

          {reservationLoading ? (
            <ChartSkeleton />
          ) : reservationError ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12">
              <AlertCircle className="mb-3 h-10 w-10 text-danger" />
              <p className="mb-4 text-sm text-muted">{(reservationError as Error).message}</p>
              <Button variant="outline" onClick={() => refetchReservations()}>
                <RotateCcw className="h-4 w-4" /> Retry
              </Button>
            </div>
          ) : !statusBreakdown || statusBreakdown.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12">
              <Inbox className="mb-3 h-10 w-10 text-muted/50" />
              <p className="text-sm font-medium text-foreground">No data for selected period</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  icon={<CalendarDays className="h-5 w-5" />}
                  label="Total Reservations"
                  value={totalReservations}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Status Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusBreakdown}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            dataKey="total"
                            nameKey="status"
                            label={({ status, percent }: any) => `${status} (${(percent * 100).toFixed(0)}%)`}
                          >
                            {statusBreakdown.map((_: any, index: number) => (
                              <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Status Details</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <TableContainer>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>Count</TableHead>
                            <TableHead>Percentage</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {statusBreakdown.map((item: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium capitalize">{item.status ?? item.name}</TableCell>
                              <TableCell>{item.total ?? 0}</TableCell>
                              <TableCell>
                                {totalReservations > 0
                                  ? `${(((item.total ?? 0) / totalReservations) * 100).toFixed(1)}%`
                                  : '0%'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'Export' && (
        <Card>
          <CardContent className="pt-6">
            <div className="max-w-md space-y-4">
              <Select
                label="Report Type"
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
              >
                {REPORT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>

              <Select
                label="Format"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
              >
                {EXPORT_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </Select>

              <ReportRangeFilter value={exportRange} onApply={setExportRange} max={today} />

              <Button variant="primary" onClick={handleExport}>
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}