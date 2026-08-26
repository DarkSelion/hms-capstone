import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TONES = {
  neutral: 'bg-border/50 text-muted hover:bg-border',
  danger: 'bg-danger/10 text-danger hover:bg-danger/20',
  success: 'bg-success/10 text-success hover:bg-success/20',
  info: 'bg-info/10 text-info hover:bg-info/20',
  warning: 'bg-warning/10 text-warning hover:bg-warning/20',
} as const

export type RowActionTone = keyof typeof TONES

interface RowActionsProps {
  children: ReactNode
}

export function RowActions({ children }: RowActionsProps) {
  return (
    <div className="inline-flex h-8 items-stretch rounded-lg border border-border divide-x divide-border">
      {children}
    </div>
  )
}

interface RowActionButtonProps {
  tone?: RowActionTone
  title?: string
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  icon?: ReactNode
  label?: string
}

export function RowActionButton({ tone = 'neutral', title, onClick, icon, label }: RowActionButtonProps) {
  // Ensure icon is accessible-hidden if present
  const accessibleIcon = icon ? (
    <span aria-hidden="true">{icon}</span>
  ) : null

  return (
    <Button
      variant="ghost"
      size="sm"
      square={!label}
      className={cn('rounded-none border-0', label && 'px-2.5 text-xs', TONES[tone])}
      title={title}
      aria-label={label || title}
      onClick={onClick}
    >
      {accessibleIcon}
      {label && <span>{label}</span>}
    </Button>
  )
}
