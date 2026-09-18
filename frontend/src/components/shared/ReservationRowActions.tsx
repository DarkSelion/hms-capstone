import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Reservation } from '@/types'
import {
  Eye, Pencil, XCircle, LogIn, LogOut, AlertTriangle,
  CalendarClock, RotateCcw, MoreHorizontal,
} from 'lucide-react'

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
  variant?: 'danger' | 'warning' | 'success' | 'info'
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
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false)
    }
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

  const dropdownItems: DropdownItem[] = []

  if (!isDead) {
    if ((status === 'pending' || status === 'confirmed') && onCancel) {
      dropdownItems.push({ label: 'Cancel', icon: <XCircle className="h-4 w-4" />, onClick: () => { setOpen(false); onCancel() }, variant: 'danger' })
    }
    if (status === 'confirmed' && is_overdue && onMarkNoShow) {
      dropdownItems.push({ label: 'Mark No Show', icon: <AlertTriangle className="h-4 w-4" />, onClick: () => { setOpen(false); onMarkNoShow() }, variant: 'warning' })
    }
    if (status === 'checked_in' && onExtendStay) {
      dropdownItems.push({ label: 'Extend Stay', icon: <CalendarClock className="h-4 w-4" />, onClick: () => { setOpen(false); onExtendStay() }, variant: 'info' })
    }
  }

  if (isRefundPending && !dropdownItems.find(i => i.label === 'Process Refund') && onProcessRefund) {
    dropdownItems.push({ label: 'Process Refund', icon: <RotateCcw className="h-4 w-4" />, onClick: () => { setOpen(false); onProcessRefund() }, variant: 'warning' })
  }

  const itemVariantStyles: Record<string, string> = {
    danger: 'text-rose-600 hover:bg-rose-50',
    warning: 'text-amber-600 hover:bg-amber-50',
    success: 'text-emerald-600 hover:bg-emerald-50',
    info: 'text-sky-600 hover:bg-sky-50',
  }

  const showCheckIn = (status === 'pending' || status === 'confirmed') && (alwaysAllowCheckIn || !is_overdue) && onCheckIn
  const showCheckOut = status === 'checked_in' && onCheckOut

  return (
    <div ref={ref} className="relative inline-flex items-center gap-1">
      <div className="inline-flex items-stretch rounded-lg bg-slate-100/80 p-1">
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

        {showCheckIn && (
          <>
            <div className="w-px bg-slate-200/80" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 rounded-md px-2 text-xs font-medium text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
              title="Check In"
              onClick={onCheckIn}
            >
              <LogIn className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Check In</span>
            </Button>
          </>
        )}

        {showCheckOut && (
          <>
            <div className="w-px bg-slate-200/80" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 rounded-md px-2 text-xs font-medium text-sky-600 hover:bg-sky-50 hover:text-sky-700"
              title="Check Out"
              onClick={onCheckOut}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Check Out</span>
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
          <button
            type="button"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            onClick={() => { setOpen(false); onEdit() }}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          {dropdownItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                item.variant
                  ? itemVariantStyles[item.variant]
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
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
