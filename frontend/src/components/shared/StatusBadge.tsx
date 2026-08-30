import { cn } from '../../lib/utils'

const textColorMap: Record<string, string> = {
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
  info: 'text-sky-600',
  gold: 'text-amber-700',
  default: 'text-muted',
}

const variantMap: Record<string, string> = {
  pending: 'warning',
  confirmed: 'info',
  checked_in: 'success',
  checked_out: 'default',
  cancelled: 'danger',
  no_show: 'danger',
  unpaid: 'warning',
  partial: 'gold',
  paid: 'success',
  refunded: 'info',
  available: 'success',
  occupied: 'danger',
  maintenance: 'warning',
  reserved: 'info',
  cleaning: 'default',
  clean: 'success',
  dirty: 'warning',
  in_progress: 'info',
  inspected: 'gold',
  draft: 'default',
  sent: 'info',
  overdue: 'danger',
  failed: 'danger',
  completed: 'success',
  assigned: 'info',
  reported: 'warning',
  low: 'default',
  medium: 'info',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
  critical: 'danger',
  active: 'success',
  inactive: 'default',
}

const labelMap: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
  no_show: 'No Show',
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
  refunded: 'Refunded',
  available: 'Available',
  occupied: 'Occupied',
  maintenance: 'Maintenance',
  reserved: 'Reserved',
  cleaning: 'Cleaning',
  clean: 'Clean',
  dirty: 'Dirty',
  in_progress: 'In Progress',
  inspected: 'Inspected',
  draft: 'Draft',
  sent: 'Sent',
  overdue: 'Overdue',
  failed: 'Failed',
  completed: 'Completed',
  assigned: 'Assigned',
  reported: 'Reported',
  low: 'Low',
  medium: 'Medium',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
  critical: 'Critical',
  active: 'Active',
  inactive: 'Inactive',
}

export function StatusBadge({ status }: { status: string }) {
  const variant = variantMap[status] ?? 'default'
  const label = labelMap[status] ?? status
  const colorClass = textColorMap[variant] ?? textColorMap.default

  return (
    <span className={cn('whitespace-nowrap text-sm font-medium', colorClass)}>
      {label}
    </span>
  )
}
