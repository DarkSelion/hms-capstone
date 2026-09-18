import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Eye, Pencil, XCircle, LogIn, LogOut, AlertTriangle,
  CalendarClock, RotateCcw, MoreHorizontal,
} from 'lucide-react'
import type { Reservation } from '@/types'

interface ReservationRowActionsProps {
  reservation: Reservation
  onView: () => void
  onEdit: () => void
  onCancel?: () => void
  onCheckIn?: () => void
  onCheckOut?: () => void
  onMarkNoShow?: () => void
  onExtendStay?: () => void
  onProcessRefund?: () => void
  alwaysAllowCheckIn?: boolean
}

interface DropdownItem {
  label: string
  icon: React.ReactNode
  onClick: () => void
  variant?: 'danger' | 'warning'
}

export function ReservationRowActions({
  reservation,
  onView,
  onEdit,
  onCancel,
  onCheckIn,
  onCheckOut,
  onMarkNoShow,
  onExtendStay,
  onProcessRefund,
  alwaysAllowCheckIn,
}: ReservationRowActionsProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
  }, [])

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, handleClickOutside])

  const { status, is_overdue } = reservation
  const isDead = status === 'cancelled' || status === 'no_show' || status === 'checked_out'
  const isRefundPending = reservation.refund_requested_at && reservation.payment_status !== 'refunded'

  if (isDead) {
    return (
      <div className="flex justify-end items-center">
        <div className="inline-flex items-center gap-1 bg-slate-100/80 p-1 rounded-lg border border-slate-200/60 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-900"
            title="View"
            onClick={onView}
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">View</span>
          </Button>
        </div>
      </div>
    )
  }

  const close = () => setOpen(false)

  const dropdownItems: DropdownItem[] = [
    { label: 'Edit', icon: <Pencil className="h-4 w-4" />, onClick: () => { close(); onEdit() } },
  ]

  if ((status === 'pending' || status === 'confirmed') && onCancel) {
    dropdownItems.push({ label: 'Cancel', icon: <XCircle className="h-4 w-4" />, onClick: () => { close(); onCancel() }, variant: 'danger' })
  }
  if (status === 'confirmed' && is_overdue && onMarkNoShow) {
    dropdownItems.push({ label: 'Mark No Show', icon: <AlertTriangle className="h-4 w-4" />, onClick: () => { close(); onMarkNoShow() }, variant: 'warning' })
  }
  if (status === 'checked_in' && onExtendStay) {
    dropdownItems.push({ label: 'Extend Stay', icon: <CalendarClock className="h-4 w-4" />, onClick: () => { close(); onExtendStay() } })
  }
  if (isRefundPending && onProcessRefund) {
    dropdownItems.push({ label: 'Process Refund', icon: <RotateCcw className="h-4 w-4" />, onClick: () => { close(); onProcessRefund() }, variant: 'warning' })
  }

  const variantStyles: Record<string, string> = {
    danger: 'text-rose-600 hover:bg-rose-50',
    warning: 'text-amber-600 hover:bg-amber-50',
  }

  const overdue = status === 'confirmed' && !!is_overdue && !alwaysAllowCheckIn
  const primaryAction = (() => {
    if ((status === 'pending' || status === 'confirmed') && !overdue && onCheckIn) {
      return { label: 'Check In', icon: <LogIn className="h-3.5 w-3.5" />, tone: 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700' }
    }
    if (status === 'checked_in' && onCheckOut) {
      return { label: 'Check Out', icon: <LogOut className="h-3.5 w-3.5" />, tone: 'text-sky-600 hover:bg-sky-50 hover:text-sky-700' }
    }
    return null
  })()

  return (
    <div ref={ref} className="relative flex justify-end items-center">
      <div className="inline-flex items-center gap-1 bg-slate-100/80 p-1 rounded-lg border border-slate-200/60 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-900"
          title="View"
          onClick={onView}
        >
          <Eye className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">View</span>
        </Button>

        {primaryAction && (
          <>
            <div className="w-px bg-slate-200/80" />
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-7 gap-1.5 rounded-md px-2 text-xs font-medium', primaryAction.tone)}
              title={primaryAction.label}
              onClick={primaryAction.label === 'Check In' ? onCheckIn : onCheckOut}
            >
              {primaryAction.icon}
              <span className="hidden xl:inline">{primaryAction.label}</span>
            </Button>
          </>
        )}

        {dropdownItems.length > 0 && (
          <>
            <div className="w-px bg-slate-200/80" />
            <button
              type="button"
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white hover:text-slate-600',
                open && 'bg-white text-slate-600 shadow-sm',
              )}
              title="More actions"
              aria-label="More actions"
              aria-expanded={open}
              onClick={() => setOpen(v => !v)}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {open && dropdownItems.length > 0 && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {dropdownItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                item.variant ? variantStyles[item.variant] : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
              onClick={item.onClick}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
