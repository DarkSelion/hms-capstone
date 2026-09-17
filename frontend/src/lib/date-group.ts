export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isSameDay(dateStr: string | null | undefined, today?: Date): boolean {
  if (!dateStr) return false
  const d = today ?? new Date()
  return dateStr === toLocalDateStr(d)
}

export function isAfterDay(dateStr: string | null | undefined, today?: Date): boolean {
  if (!dateStr) return true
  const d = today ?? new Date()
  return dateStr > toLocalDateStr(d)
}

export function formatDateHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC']
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`
}

export function formatTodayLabel(date?: Date): string {
  return formatDateHeader(toLocalDateStr(date ?? new Date()))
}

export type DateGroup = 'today' | 'upcoming'

export function getDateGroup(dateStr: string | null | undefined, today?: Date): DateGroup {
  if (isSameDay(dateStr, today)) return 'today'
  return 'upcoming'
}
