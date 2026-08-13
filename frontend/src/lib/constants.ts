export const BOOKING_SOURCES = [
  { value: 'direct', label: 'Direct Booking' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'online_travel_agent', label: 'Online Travel Agent' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'travel_agent', label: 'Travel Agent' },
  { value: 'booking_engine', label: 'Booking Engine' },
] as const

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: 'Banknote' },
  { value: 'gcash', label: 'GCash', icon: 'Smartphone' },
  { value: 'online', label: 'Online', icon: 'CreditCard' },
] as const

export const PAYMENT_STATUS = {
  unpaid: { label: 'Unpaid', variant: 'danger' },
  partial: { label: 'Partial', variant: 'warning' },
  paid: { label: 'Paid', variant: 'success' },
  refunded: { label: 'Refunded', variant: 'default' },
} as const

export const TASK_PRIORITY = {
  low: { label: 'Low', variant: 'default' },
  medium: { label: 'Medium', variant: 'warning' },
  high: { label: 'High', variant: 'danger' },
} as const

export const TASK_STATUS = {
  pending: { label: 'Pending', variant: 'default' },
  in_progress: { label: 'In Progress', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
} as const