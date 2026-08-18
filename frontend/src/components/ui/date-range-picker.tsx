import { useState, useRef, useEffect, useMemo } from 'react'
import ReactDOM from 'react-dom'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react'

interface DateRange {
  from: string
  to: string
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  min?: string
  max?: string
  placeholder?: string
  error?: string
  className?: string
  clearable?: boolean
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseDate(str: string): Date | null {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime()
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function DateRangePicker({ value, onChange, min, max, placeholder = 'Select dates', error, className, clearable = false }: DateRangePickerProps) {
  const fromDate = parseDate(value.from)
  const toDate = parseDate(value.to)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'days' | 'months' | 'years'>('days')
  const [viewMonth, setViewMonth] = useState(fromDate ? new Date(fromDate.getFullYear(), fromDate.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1))
  const [selecting, setSelecting] = useState<'from' | 'to'>(!value.from ? 'from' : value.to ? 'from' : 'to')
  const [hoverDate, setHoverDate] = useState<Date | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({})

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (
        popupRef.current && !popupRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (!open) return
    setView('days')
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const popupWidth = Math.min(288, window.innerWidth - 16)
      const popupHeight = 400
      const spaceBelow = window.innerHeight - rect.bottom
      const showAbove = spaceBelow < popupHeight && rect.top > popupHeight
      setPopupStyle({
        position: 'fixed',
        ...(showAbove
          ? { bottom: `${window.innerHeight - rect.top + 4}px` }
          : { top: `${rect.bottom + 4}px` }
        ),
        left: `${Math.max(8, Math.min(rect.left, window.innerWidth - popupWidth - 8))}px`,
        zIndex: 9999,
        minWidth: `${popupWidth}px`,
        maxWidth: 'calc(100vw - 16px)',
      })
    }
  }, [open])

  useEffect(() => {
    if (fromDate) setViewMonth(new Date(fromDate.getFullYear(), fromDate.getMonth(), 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally sync on value.from only
  }, [value.from])

  const grid = useMemo(() => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    return cells
  }, [viewMonth])

  const minDate = (min ? parseDate(min) : null) ?? today
  const maxDate = max ? parseDate(max) : null

  const viewYear = viewMonth.getFullYear()
  const decadeStart = Math.floor(viewYear / 12) * 12
  const years = Array.from({ length: 12 }, (_, i) => decadeStart + i)

  function nav(dir: -1 | 1) {
    if (view === 'months') {
      setViewMonth(new Date(viewYear + dir, viewMonth.getMonth(), 1))
    } else if (view === 'years') {
      setViewMonth(new Date(viewMonth.getFullYear() + dir * 12, viewMonth.getMonth(), 1))
    } else if (dir === -1) {
      setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
    } else {
      setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
    }
  }

  function monthDisabled(monthIndex: number): boolean {
    const first = new Date(viewYear, monthIndex, 1)
    const last = new Date(viewYear, monthIndex + 1, 0)
    return isBefore(last, minDate) || !!(maxDate && isBefore(maxDate, first))
  }

  function yearDisabled(year: number): boolean {
    return year < minDate.getFullYear() || !!(maxDate && year > maxDate.getFullYear())
  }

  function selectMonth(monthIndex: number) {
    setViewMonth(new Date(viewYear, monthIndex, 1))
    setView('days')
  }

  function selectYear(year: number) {
    setViewMonth(new Date(year, viewMonth.getMonth(), 1))
    setView('months')
  }

  function isInRange(d: Date): boolean {
    if (!fromDate) return false
    if (selecting === 'to') {
      const end = hoverDate || toDate
      if (!end) return false
      if (isBefore(fromDate, end)) {
        return isBefore(fromDate, d) && isBefore(d, end)
      } else {
        return isBefore(end, d) && isBefore(d, fromDate)
      }
    }
    return false
  }

  function isRangeStart(d: Date): boolean {
    if (!fromDate) return false
    if (selecting === 'to') {
      const end = hoverDate || toDate
      if (!end) return false
      if (isBefore(fromDate, end)) return isSameDay(d, fromDate)
      return isSameDay(d, end)
    }
    return isSameDay(d, fromDate)
  }

  function isRangeEnd(d: Date): boolean {
    if (!fromDate) return false
    if (selecting === 'to') {
      const end = hoverDate || toDate
      if (!end) return false
      if (isBefore(fromDate, end)) return isSameDay(d, end)
      return isSameDay(d, fromDate)
    }
    return toDate ? isSameDay(d, toDate) : false
  }

  function selectDay(day: number) {
    const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day)
    if (isBefore(d, minDate)) return
    if (maxDate && isBefore(maxDate, d)) return

    if (selecting === 'from') {
      onChange({ from: toStr(d), to: '' })
      setSelecting('to')
    } else {
      if (!fromDate) {
        onChange({ from: toStr(d), to: '' })
        setSelecting('to')
        return
      }
      if (isSameDay(d, fromDate) || isBefore(d, fromDate)) {
        onChange({ from: toStr(d), to: '' })
        setSelecting('to')
        return
      }
      onChange({ from: value.from, to: toStr(d) })
      setSelecting('from')
      setOpen(false)
    }
  }

  const displayText = value.from && value.to
    ? `${fmtShort(fromDate!)} — ${fmtShort(toDate!)}`
    : value.from
      ? `${fmtShort(fromDate!)} — ?`
      : ''

  const headerLabel =
    view === 'days'
      ? `${MONTHS[viewMonth.getMonth()]} ${viewYear}`
      : view === 'months'
        ? `${viewYear}`
        : `${decadeStart} — ${decadeStart + 11}`

  const calendar = (
    <div ref={popupRef} style={popupStyle} className="rounded-xl border border-border bg-card shadow-lg animate-in fade-in duration-150">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button type="button" onClick={() => nav(-1)} aria-label="Previous" className="rounded-md p-1.5 text-muted hover:bg-cream hover:text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => view === 'days' ? setView('months') : view === 'months' ? setView('years') : setView('days')}
          aria-label="Switch view"
          className="rounded-md px-2 py-1 text-sm font-semibold text-foreground hover:bg-cream hover:text-primary transition-colors"
        >
          {headerLabel}
        </button>
        <button type="button" onClick={() => nav(1)} aria-label="Next" className="rounded-md p-1.5 text-muted hover:bg-cream hover:text-primary transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mx-4 mb-2 flex items-center justify-between rounded-lg bg-cream px-3 py-2">
        <span className="text-xs font-medium text-primary">
          {selecting === 'from' ? 'Select start date' : 'Select end date'}
        </span>
        <span className="truncate pl-2 text-xs text-muted">
          {displayText || 'No dates selected'}
        </span>
      </div>

      {view === 'days' && (
        <>
          <div className="grid grid-cols-7 px-4 pb-1">
            {DAYS.map(d => (
              <div key={d} className="py-1 text-center text-[11px] font-medium text-muted">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5 px-4 pb-4">
            {grid.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} />
              const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day)
              const isToday = isSameDay(d, today)
              const isDisabled = isBefore(d, minDate) || (maxDate ? isBefore(maxDate, d) : false)
              const dFrom = fromDate && isSameDay(d, fromDate)
              const dTo = toDate && isSameDay(d, toDate)
              const inRange = isInRange(d)
              const rangeStart = isRangeStart(d)
              const rangeEnd = isRangeEnd(d)
              const isHovered = hoverDate && isSameDay(d, hoverDate)
              const isSelected = dFrom || dTo

              return (
                <button
                  key={`d-${i}`}
                  type="button"
                  disabled={isDisabled}
                  onMouseEnter={() => {
                    if (selecting === 'to' && fromDate && !isDisabled) setHoverDate(d)
                  }}
                  onMouseLeave={() => setHoverDate(null)}
                  onClick={() => selectDay(day)}
                  className={cn(
                    'mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all relative',
                    (rangeStart || rangeEnd) && 'bg-primary text-white font-semibold shadow-sm',
                    !(rangeStart || rangeEnd) && inRange && 'bg-primary/10',
                    !(rangeStart || rangeEnd) && isToday && !isSelected && 'bg-gold/15 text-gold-dark font-semibold ring-1 ring-gold/30',
                    !(rangeStart || rangeEnd) && isDisabled && 'text-border cursor-not-allowed',
                    !(rangeStart || rangeEnd) && !inRange && !isDisabled && !isToday && 'text-foreground hover:bg-cream hover:text-primary',
                    isHovered && !isSelected && !inRange && !isDisabled && 'bg-cream',
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </>
      )}

      {view === 'months' && (
        <div className="grid grid-cols-3 gap-y-1 px-4 pb-4">
          {MONTH_SHORT.map((m, i) => {
            const isSelected = !!fromDate && fromDate.getFullYear() === viewYear && fromDate.getMonth() === i
            const isCurrent = today.getFullYear() === viewYear && today.getMonth() === i
            const disabled = monthDisabled(i)
            return (
              <button
                key={m}
                type="button"
                disabled={disabled}
                onClick={() => selectMonth(i)}
                className={cn(
                  'mx-auto h-9 w-full rounded-lg text-sm font-medium transition-all',
                  isSelected
                    ? 'bg-primary text-white font-semibold shadow-sm'
                    : isCurrent
                      ? 'bg-gold/15 text-gold-dark font-semibold ring-1 ring-gold/30'
                      : disabled
                        ? 'text-border cursor-not-allowed'
                        : 'text-foreground hover:bg-cream hover:text-primary',
                )}
              >
                {m}
              </button>
            )
          })}
        </div>
      )}

      {view === 'years' && (
        <div className="grid grid-cols-3 gap-y-1 px-4 pb-4">
          {years.map((y) => {
            const isSelected = !!fromDate && fromDate.getFullYear() === y
            const isCurrent = today.getFullYear() === y
            const disabled = yearDisabled(y)
            return (
              <button
                key={y}
                type="button"
                disabled={disabled}
                onClick={() => selectYear(y)}
                className={cn(
                  'mx-auto h-9 w-full rounded-lg text-sm font-medium transition-all',
                  isSelected
                    ? 'bg-primary text-white font-semibold shadow-sm'
                    : isCurrent
                      ? 'bg-gold/15 text-gold-dark font-semibold ring-1 ring-gold/30'
                      : disabled
                        ? 'text-border cursor-not-allowed'
                        : 'text-foreground hover:bg-cream hover:text-primary',
                )}
              >
                {y}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div className={cn('', className)} ref={wrapperRef}>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            'flex h-10 w-full items-center rounded-lg border bg-card px-3 py-2 text-sm text-left ring-offset-card transition-colors',
            'hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary',
            error ? 'border-danger focus-visible:ring-danger/50' : 'border-border',
            !value.from && 'text-muted',
            clearable && value.from && value.to && 'pr-8',
          )}
        >
          <Calendar className="mr-2 h-4 w-4 shrink-0 text-muted" />
          <span className="flex-1 truncate">{displayText || placeholder}</span>
        </button>

        {clearable && value.from && value.to && (
          <button
            type="button"
            aria-label="Clear date range"
            onClick={(e) => {
              e.stopPropagation()
              onChange({ from: '', to: '' })
              setSelecting('from')
              setOpen(false)
            }}
            className="absolute right-2 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-bg hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {open && ReactDOM.createPortal(calendar, document.body)}
      </div>

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}