import { cn } from '../../lib/utils'

interface TodayBadgeProps {
  variant: 'arrival' | 'departure'
  className?: string
}

const variantStyles: Record<TodayBadgeProps['variant'], string> = {
  arrival: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
  departure: 'bg-sky-50 text-sky-700 border border-sky-200/60',
}

export function TodayBadge({ variant, className }: TodayBadgeProps) {
  const label = variant === 'arrival' ? 'TODAY' : 'DEPARTING TODAY'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        variantStyles[variant],
        className,
      )}
    >
      {label}
    </span>
  )
}
