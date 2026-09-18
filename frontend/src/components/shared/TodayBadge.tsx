import { cn } from '../../lib/utils'

interface TodayBadgeProps {
  variant: 'arrival' | 'departure'
  className?: string
}

const dotColors: Record<TodayBadgeProps['variant'], string> = {
  arrival: 'bg-emerald-500',
  departure: 'bg-sky-500',
}

const labels: Record<TodayBadgeProps['variant'], string> = {
  arrival: 'Arriving today',
  departure: 'Departing today',
}

export function TodayBadge({ variant, className }: TodayBadgeProps) {
  return (
    <span
      className={cn(
        'relative inline-flex h-2 w-2 shrink-0 rounded-full',
        dotColors[variant],
        className,
      )}
      title={labels[variant]}
      aria-label={labels[variant]}
    >
      <span className={cn(
        'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
        dotColors[variant],
      )} />
    </span>
  )
}
