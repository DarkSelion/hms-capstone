export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount)
}

export function formatCurrencyWith(amount: number, code: string): string {
  const currency = code && code.trim() ? code.trim().toUpperCase() : 'PHP'
  try {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency,
    }).format(amount)
  } catch {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount)
  }
}

export function formatDateDisplay(dateStr: string, style: 'compact' | 'long' = 'compact'): string {
  if (!dateStr) return '-'
  const datePart = dateStr.split(/[\sT]/)[0]
  const date = new Date(datePart + 'T00:00:00')
  if (isNaN(date.getTime())) return '-'

  if (style === 'long') {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatTime(dateStr?: string | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const CHECKOUT_HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1))
export const CHECKOUT_MINUTE_OPTIONS = ['00', '15', '30', '45']

export interface ParsedCheckoutTime {
  hour12: string
  minute: string
  meridiem: 'AM' | 'PM'
}

export function parseCheckoutTime(value: string): ParsedCheckoutTime {
  const [h, m] = (value || '11:00').split(':')
  const hour = parseInt(h, 10)
  const safeHour = isNaN(hour) ? 11 : hour
  const minute = (m || '00').padStart(2, '0')
  const hour12 = safeHour % 12 === 0 ? 12 : safeHour % 12
  return {
    hour12: String(hour12),
    minute: CHECKOUT_MINUTE_OPTIONS.includes(minute) ? minute : '00',
    meridiem: safeHour >= 12 ? 'PM' : 'AM',
  }
}

export function buildCheckoutTime(hour12: string, minute: string, meridiem: 'AM' | 'PM'): string {
  const hour = meridiem === 'PM' ? (parseInt(hour12, 10) % 12) + 12 : parseInt(hour12, 10) % 12
  return `${String(hour).padStart(2, '0')}:${minute}`
}

export function formatCheckoutTime(value: string): string {
  const { hour12, minute, meridiem } = parseCheckoutTime(value)
  return `${hour12}:${minute} ${meridiem}`
}
