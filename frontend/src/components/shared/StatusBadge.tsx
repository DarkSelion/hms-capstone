import { cn } from '@/lib/utils'

const variantMap: Record<string, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  gold: 'text-gold-dark',
  purple: 'text-purple-600',
  default: 'text-muted',
}

const pillBgMap: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
  info: 'bg-sky-50 text-sky-700',
  gold: 'bg-gold/15 text-gold-dark',
  purple: 'bg-purple-50 text-purple-700',
  default: 'bg-slate-100 text-slate-600',
}

const variantMapByStatus: Record<string, string> = {
  confirmed: 'info',
  checked_in: 'success',
  checked_out: 'default',
  cancelled: 'danger',
  no_show: 'purple',
  late_arrival: 'warning',
  pending: 'warning',
  unpaid: 'warning',
  partial: 'info',
  paid: 'success',
  refunded: 'default',
  draft: 'default',
  sent: 'info',
  overdue: 'danger',
  failed: 'danger',
  completed: 'success',
  active: 'success',
  inactive: 'danger',
  available: 'success',
  occupied: 'warning',
  maintenance: 'danger',
  reserved: 'info',
  dirty: 'warning',
  clean: 'success',
  in_progress: 'info',
  inspected: 'success',
  assigned: 'info',
  reported: 'warning',
  low: 'default',
  medium: 'warning',
  normal: 'default',
  high: 'danger',
  urgent: 'danger',
  critical: 'danger',
}

const labelMap: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
  no_show: 'No Show',
  late_arrival: 'Late Arrival',
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
  refunded: 'Refunded',
  draft: 'Draft',
  sent: 'Sent',
  overdue: 'Overdue',
  failed: 'Failed',
  completed: 'Completed',
  active: 'Active',
  inactive: 'Inactive',
  available: 'Available',
  occupied: 'Occupied',
  maintenance: 'Maintenance',
  reserved: 'Reserved',
  dirty: 'Dirty',
  clean: 'Clean',
  in_progress: 'In Progress',
  inspected: 'Inspected',
  assigned: 'Assigned',
  reported: 'Reported',
  low: 'Low',
  medium: 'Medium',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
  critical: 'Critical',
}

interface StatusBadgeProps {
  status: string
  pill?: boolean
  className?: string
}

function StatusBadge({ status, pill = false, className }: StatusBadgeProps) {
  const variant = variantMapByStatus[status] ?? 'default'

  if (pill) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
          pillBgMap[variant] ?? pillBgMap.default,
          className,
        )}
      >
        {labelMap[status] ?? status}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'whitespace-nowrap text-sm font-medium',
        variantMap[variant] ?? variantMap.default,
        className,
      )}
    >
      {labelMap[status] ?? status}
    </span>
  )
}

export { StatusBadge }
