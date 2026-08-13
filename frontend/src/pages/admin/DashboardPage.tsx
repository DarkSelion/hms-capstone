import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useDashboardStats,
  useDashboardRevenue,
  useBookingSources,
  useRecentActivities,
  useReservations,
} from '@/hooks/useApi'
import { formatCurrency } from '@/lib/format'
import { BOOKING_SOURCES } from '@/lib/constants'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { OccupancyHero } from '@/components/dashboard/OccupancyHero'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  DollarSign, LogIn, LogOut,
  Activity, RefreshCw, Calendar, ArrowRight,
} from 'lucide-react'
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend as RechartsLegend,
} from 'recharts'
import type { Reservation } from '@/types'

const PIE_COLORS = ['#1e3a5f', '#10b981', '#f59e0b', '#6b7280', '#ef4444']

const formatTime = (dateStr: string) =>
  new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

function StatCardSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-border bg-card ${compact ? 'px-4 py-3' : 'p-5'}`}>
      <Skeleton className="mb-2 h-3 w-20" />
      <Skeleton className={`rounded ${compact ? 'h-7 w-16' : 'h-10 w-24'}`} />
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <Skeleton className="mb-4 h-5 w-40" />
      <Skeleton className="h-[280px] w-full rounded-lg" />
    </div>
  )
}

function PieChartSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <Skeleton className="mb-4 h-5 w-36" />
      <div className="flex items-center justify-center">
        <Skeleton className="h-[220px] w-[220px] rounded-full" />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats()
  const { data: revenueData, isLoading: revenueLoading } = useDashboardRevenue()
  const { data: sources, isLoading: sourcesLoading } = useBookingSources()
  const { data: activities, isLoading: activitiesLoading } = useRecentActivities()
  const { data: reservationsData, isLoading: reservationsLoading, error: reservationsError } = useReservations({ per_page: 5 })

  const [chartTab, setChartTab] = useState<'revenue' | 'bookings'>('revenue')

  const initialLoading = statsLoading && !stats
  const hasError = statsError || reservationsError

  const reservations = reservationsData?.data ?? []
  const revenueChartData = revenueData ?? []
  const mappedSources = (sources ?? []).map((s) => ({
    ...s,
    source: BOOKING_SOURCES.find((b) => b.value === s.source)?.label ?? s.source,
  }))

  const totalDirtyRooms = stats?.dirty_rooms ?? 0

  if (hasError) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Hotel overview & statistics" />
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-12 text-center">
          <div className="mb-4 rounded-full bg-danger/10 p-3 text-danger">
            <RefreshCw className="h-6 w-6" />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-foreground">Failed to load dashboard</h3>
          <p className="mb-4 text-sm text-muted">Something went wrong. Please try again.</p>
          <Button variant="primary" onClick={() => refetchStats()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Dashboard" description="Hotel overview & statistics" />

      {/* Hero: Occupancy Bar */}
      <div className="mb-4">
        {initialLoading || !stats ? (
          <div className="rounded-xl border border-border bg-primary p-5">
            <Skeleton className="mb-3 h-4 w-32 bg-card/10" />
            <Skeleton className="mb-4 h-12 w-40 bg-card/10" />
            <Skeleton className="h-2 w-full rounded-full bg-card/10" />
          </div>
        ) : (
          <OccupancyHero
            occupancyRate={stats.occupancy_rate}
            occupiedRooms={stats.booked_rooms}
            totalRooms={stats.total_rooms}
          />
        )}
      </div>

      {/* Hero Stats: Revenue, Check-ins, Check-outs */}
      <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {initialLoading || !stats ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              icon={<DollarSign className="h-4 w-4" />}
              label="Today's Revenue"
              value={formatCurrency(stats.today_revenue)}
              variant="hero"
            />
            <StatCard
              icon={<LogIn className="h-4 w-4" />}
              label="Check-ins Today"
              value={stats.check_ins_today}
              variant="hero"
            />
            <StatCard
              icon={<LogOut className="h-4 w-4" />}
              label="Check-outs Today"
              value={stats.check_outs_today}
              variant="hero"
            />
          </>
        )}
      </div>

      {/* Secondary Metrics: Compact Row */}
      <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {initialLoading || !stats ? (
          <>
            {Array.from({ length: 5 }).map((_, i) => (
              <StatCardSkeleton key={i} compact />
            ))}
          </>
        ) : (
          <>
            <StatCard label="Booked" value={stats.booked_rooms} variant="compact" />
            <StatCard label="Pending" value={stats.pending_reservations} variant="compact" />
            <StatCard label="Dirty Rooms" value={totalDirtyRooms} variant="compact" />
            <StatCard label="Available" value={`${stats.available_rooms}/${stats.total_rooms}`} variant="compact" />
          </>
        )}
      </div>

      {/* Divider: subtle line signals section boundary */}
      <div className="mb-8 border-t border-border" />

      {/* Charts Section */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Revenue Chart */}
        <div className="lg:col-span-2">
          {revenueLoading ? (
            <ChartSkeleton />
          ) : revenueChartData && revenueChartData.length > 0 ? (
            <RevenueChart
              data={revenueChartData}
              activeTab={chartTab}
              onTabChange={(tab) => setChartTab(tab)}
            />
          ) : (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted">No revenue data available</p>
            </div>
          )}
        </div>

        {/* Booking Sources */}
        <div>
          {sourcesLoading ? (
            <PieChartSkeleton />
          ) : (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Booking Sources</h3>
              {mappedSources && mappedSources.length > 0 ? (
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mappedSources}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={76}
                        paddingAngle={3}
                        dataKey="count"
                        nameKey="source"
                      >
                        {mappedSources.map((_, index) => (
                          <Cell
                            key={index}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <RechartsLegend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value: string) => (
                          <span className="text-xs text-muted">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-[220px] items-center justify-center text-sm text-muted">
                  No booking data
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activities & Latest Reservations */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent Activities */}
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Recent Activities</h3>
          </div>
          <div className="p-5">
            {activitiesLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="mb-1 h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activities && activities.length > 0 ? (
              <div className="space-y-0">
                {activities.slice(0, 7).map((activity, index) => (
                  <div
                    key={activity.id}
                    className={`relative flex items-start gap-3 pb-3 ${
                      index < Math.min(activities.length, 7) - 1
                        ? 'border-l-2 border-border pl-4'
                        : 'pl-4'
                    }`}
                  >
                    <div
                      className={`absolute left-0 mt-1.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-white ${
                        getActivityColor(activity.module)
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {activity.description || activity.action}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatTime(activity.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 rounded-full bg-border/50 p-3 text-muted">
                  <Activity className="h-5 w-5" />
                </div>
                <p className="text-sm text-muted">No recent activities</p>
              </div>
            )}
          </div>
        </div>

        {/* Latest Reservations */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Latest Reservations</h3>
            <Link
              to="/admin/reservations"
              className="group flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-light"
            >
              View All
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div className="p-0">
            {reservationsLoading ? (
              <div className="divide-y divide-gray-100">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3">
                    <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                ))}
              </div>
            ) : reservations.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {reservations.map((reservation: Reservation) => {
                  const initials = reservation.guest
                    ? `${reservation.guest.first_name?.[0] ?? ''}${reservation.guest.last_name?.[0] ?? ''}`.toUpperCase()
                    : '?'
                  const statusColors: Record<string, string> = {
                    pending: 'border-l-warning',
                    confirmed: 'border-l-info',
                    checked_in: 'border-l-success',
                    checked_out: 'border-l-muted',
                    cancelled: 'border-l-danger',
                    no_show: 'border-l-danger',
                  }
                  return (
                    <div
                      key={reservation.id}
                      className={`flex items-center gap-4 border-l-4 ${statusColors[reservation.status] || 'border-l-border'} px-5 py-3 transition-colors hover:bg-bg`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {reservation.guest?.first_name} {reservation.guest?.last_name}
                        </p>
                        <p className="text-xs text-muted">
                          {reservation.reservation_number} · Room {reservation.room?.room_number ?? '-'}
                        </p>
                      </div>
                      <StatusBadge status={reservation.status} />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 rounded-full bg-border/50 p-3 text-muted">
                  <Calendar className="h-5 w-5" />
                </div>
                <p className="text-sm text-muted">No reservations found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function getActivityColor(module: string): string {
  const map: Record<string, string> = {
    reservation: 'bg-primary',
    payment: 'bg-success',
    guest: 'bg-warning',
    room: 'bg-info',
    housekeeping: 'bg-purple',
    maintenance: 'bg-danger',
  }
    return map[module] || 'bg-muted'
}
