import type { ReactNode } from 'react'
import { RowActions, RowActionButton } from '@/components/shared/RowActions'
import { Eye, Pencil, XCircle, LogIn, LogOut, AlertTriangle, CalendarClock, Bell } from 'lucide-react'
import type { Reservation } from '@/types'

interface ReservationRowActionsProps {
  reservation: Reservation
  onView: () => void
  onEdit: () => void
  onCancel?: () => void
  onCheckIn?: () => void
  onCheckOut?: () => void
  onMarkNoShow?: () => void
  onLateArrival?: () => void
  onExtendStay?: () => void
  alwaysAllowCheckIn?: boolean
}

export function ReservationRowActions({
  reservation,
  onView,
  onEdit,
  onCancel,
  onCheckIn,
  onCheckOut,
  onMarkNoShow,
  onLateArrival,
  onExtendStay,
  alwaysAllowCheckIn,
}: ReservationRowActionsProps) {
  const { status, is_overdue } = reservation

  if (status === 'cancelled' || status === 'no_show' || status === 'checked_out') {
    return (
      <RowActions>
        <RowActionButton tone="neutral" title="View" icon={<Eye className="h-4 w-4" />} onClick={onView} />
      </RowActions>
    )
  }

  const overdue = status === 'confirmed' && !!is_overdue && !alwaysAllowCheckIn
  const showCheckIn = (status === 'pending' || status === 'confirmed') && onCheckIn
  const showCheckOut = status === 'checked_in' && onCheckOut

  const buttons: ReactNode[] = [
    <RowActionButton key="view" tone="neutral" title="View" icon={<Eye className="h-4 w-4" />} onClick={onView} />,
    <RowActionButton key="edit" tone="neutral" title="Edit" icon={<Pencil className="h-4 w-4" />} onClick={onEdit} />,
  ]

  if ((status === 'pending' || status === 'confirmed') && onCancel) {
    buttons.push(<RowActionButton key="cancel" tone="danger" title="Cancel" icon={<XCircle className="h-4 w-4" />} onClick={onCancel} />)
  }
  if (showCheckIn && !overdue) {
    buttons.push(<RowActionButton key="checkin" tone="success" title="Check In" icon={<LogIn className="h-4 w-4" />} onClick={onCheckIn} />)
  }
  if (overdue && onLateArrival) {
    buttons.push(<RowActionButton key="latearrival" tone="info" title="Notify Late Arrival" icon={<Bell className="h-4 w-4" />} onClick={onLateArrival} />)
  }
  if (overdue && onMarkNoShow) {
    buttons.push(<RowActionButton key="noshow" tone="warning" title="Mark No Show" icon={<AlertTriangle className="h-4 w-4" />} onClick={onMarkNoShow} />)
  }
  if (showCheckOut) {
    buttons.push(<RowActionButton key="checkout" tone="info" title="Check Out" icon={<LogOut className="h-4 w-4" />} onClick={onCheckOut} />)
  }
  if (status === 'checked_in' && onExtendStay) {
    buttons.push(<RowActionButton key="extend" tone="info" title="Extend Stay" icon={<CalendarClock className="h-4 w-4" />} onClick={onExtendStay} />)
  }

  return <RowActions>{buttons}</RowActions>
}
