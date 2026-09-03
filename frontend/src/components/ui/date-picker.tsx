import { useState, useRef, useEffect, useMemo } from 'react'
import ReactDOM from 'react-dom'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react'

interface DatePickerProps {
  value: string
  onChange: (date: string) => void
  min?: string
  max?: string
  placeholder?: string
  error?: string
  className?: string
  label?: string
  clearable?: boolean
  portal?: boolean
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

export function DatePicker({ value, onChange, min, max, placeholder = 'Select date', error, className, label, clearable = false, portal = false }: DatePickerProps) {
  const selected = parseDate(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'days' | 'months' | 'years'>('days')
  const [viewMonth, setViewMonth] = useState(selected ? new Date(selected.getFullYear(), selected.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1))
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
      const popupHeight = 340
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
    if (selected) setViewMonth(new Date(selected.getFullYear(), selected.getMonth(), 1))
  }, [value])

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

  const minDate = min ? parseDate(min) : null
  const maxDate = max ? parseDate(max) : null

  function prevMonth() {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
  }

  function nextMonth() {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
  }

  const viewYear = viewMonth.getFullYear()
  const decadeStart = Math.floor(viewYear / 12) * 12
  const years = Array.from({ length: 12 }, (_, i) => decadeStart + i)

  function nav(dir: -1 | 1) {
    if (view === 'months') {
      setViewMonth(new Date(viewYear + dir, viewMonth.getMonth(), 1))
    } else if (view === 'years') {
      setViewMonth(new Date(viewMonth.getFullYear() + dir * 12, viewMonth.getMonth(), 1))
    } else if (dir === -1) {
      prevMonth()
    } else {
      nextMonth()
    }
  }

  function selectMonth(monthIndex: number) {
    setViewMonth(new Date(viewYear, monthIndex, 1))
    setView('days')
  }

  function selectYear(year: number) {
    setViewMonth(new Date(year, viewMonth.getMonth(), 1))
    setView('months')
  }

  function monthDisabled(monthIndex: number): boolean {
    const first = new Date(viewYear, monthIndex, 1)
    const last = new Date(viewYear, monthIndex + 1, 0)
    return !!(minDate && isBefore(last, minDate)) || !!(maxDate && isBefore(maxDate, first))
  }

  function yearDisabled(year: number): boolean {
    return !!(minDate && year < minDate.getFullYear()) || !!(maxDate && year > maxDate.getFullYear())
  }

  function selectDay(day: number) {
    const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day)
    if (minDate && isBefore(d, minDate)) return
    if (maxDate && isBefore(maxDate, d)) return
    onChange(toStr(d))
    setOpen(false)
  }

  const display = selected
    ? selected.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  const headerLabel =
    view === 'days'
      ? `${MONTHS[viewMonth.getMonth()]} ${viewYear}`
      : view === 'months'
        ? `${viewYear}`
        : `${decadeStart} — ${decadeStart + 11}`

  const calendar = (
    <div ref={popupRef} style={popupStyle} className={cn('rounded-xl border shadow-lg animate-in fade-in duration-150', portal ? 'border-zinc-700 bg-zinc-900' : 'border-border bg-card')}>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button type="button" onClick={() => nav(-1)} aria-label="Previous" className={cn('rounded-md p-1.5 transition-colors', portal ? 'text-white/50 hover:bg-white/10 hover:text-gold' : 'text-muted hover:bg-cream hover:text-primary')}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => view === 'days' ? setView('months') : view === 'months' ? setView('years') : setView('days')}
          className={cn('rounded-md px-2 py-1 text-sm font-semibold transition-colors', portal ? 'text-white hover:bg-white/10 hover:text-gold' : 'text-foreground hover:bg-cream hover:text-primary')}
          aria-label="Switch view"
        >
          {headerLabel}
        </button>
        <button type="button" onClick={() => nav(1)} aria-label="Next" className={cn('rounded-md p-1.5 transition-colors', portal ? 'text-white/50 hover:bg-white/10 hover:text-gold' : 'text-muted hover:bg-cream hover:text-primary')}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {view === 'days' && (
        <>
          <div className="grid grid-cols-7 px-4 pb-1">
            {DAYS.map(d => (
              <div key={d} className={cn('py-1 text-center text-[11px] font-medium', portal ? 'text-white/40' : 'text-muted')}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5 px-4 pb-4">
            {grid.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} />
              const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day)
              const isToday = isSameDay(d, today)
              const isSelected = !!selected && isSameDay(d, selected)
              const isDisabled = !!(minDate && isBefore(d, minDate)) || !!(maxDate && isBefore(maxDate, d))

              return (
                <button
                  key={`d-${i}`}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => selectDay(day)}
                  className={cn(
                    'mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all',
                    isSelected
                      ? 'bg-gold text-dark font-semibold shadow-sm'
                      : isToday
                        ? portal
                          ? 'text-gold ring-1 ring-gold/40 font-semibold'
                          : 'bg-gold/15 text-gold-dark font-semibold ring-1 ring-gold/30'
                        : isDisabled
                          ? portal
                            ? 'text-zinc-700 cursor-not-allowed'
                            : 'text-border cursor-not-allowed'
                          : portal
                            ? 'text-white hover:bg-white/10 hover:text-gold'
                            : 'text-foreground hover:bg-cream hover:text-primary',
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
            const isSelected = !!selected && selected.getFullYear() === viewYear && selected.getMonth() === i
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
                    ? 'bg-gold text-dark font-semibold shadow-sm'
                    : isCurrent
                      ? portal
                        ? 'text-gold ring-1 ring-gold/40 font-semibold'
                        : 'bg-gold/15 text-gold-dark font-semibold ring-1 ring-gold/30'
                      : disabled
                        ? portal
                          ? 'text-zinc-700 cursor-not-allowed'
                          : 'text-border cursor-not-allowed'
                        : portal
                          ? 'text-white hover:bg-white/10 hover:text-gold'
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
            const isSelected = !!selected && selected.getFullYear() === y
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
                    ? 'bg-gold text-dark font-semibold shadow-sm'
                    : isCurrent
                      ? portal
                        ? 'text-gold ring-1 ring-gold/40 font-semibold'
                        : 'bg-gold/15 text-gold-dark font-semibold ring-1 ring-gold/30'
                      : disabled
                        ? portal
                          ? 'text-zinc-700 cursor-not-allowed'
                          : 'text-border cursor-not-allowed'
                        : portal
                          ? 'text-white hover:bg-white/10 hover:text-gold'
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
      {label && <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>}
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            'flex w-full items-center rounded-lg border bg-card px-4 py-3 text-sm text-left ring-offset-card transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary',
            portal
              ? 'border-zinc-800 bg-zinc-900/60 text-white focus-visible:ring-gold/40 focus-visible:border-gold/50'
              : 'border-border hover:border-primary/40',
            error ? 'border-danger focus-visible:ring-danger/50' : '',
            !selected && (portal ? 'text-white/40' : 'text-muted'),
            clearable && selected && 'pr-8',
          )}
        >
          <Calendar className={cn('mr-2 h-4 w-4 shrink-0', portal ? 'text-white/30' : 'text-muted')} />
          <span className="flex-1 truncate">{display || placeholder}</span>
        </button>

        {clearable && selected && (
          <button
            type="button"
            aria-label="Clear date"
            onClick={(e) => {
              e.stopPropagation()
              onChange('')
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
