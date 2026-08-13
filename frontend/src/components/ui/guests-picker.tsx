import { useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { cn } from '@/lib/utils'
import { Minus, Plus, Users } from 'lucide-react'

interface GuestsValue {
  rooms: number
  adults: number
  children: number
}

interface GuestsPickerProps {
  value: GuestsValue
  onChange: (guests: GuestsValue) => void
  className?: string
  error?: string
}

export function GuestsPicker({ value, onChange, className, error }: GuestsPickerProps) {
  const [open, setOpen] = useState(false)
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
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const popupHeight = 260
      const spaceBelow = window.innerHeight - rect.bottom
      const showAbove = spaceBelow < popupHeight && rect.top > popupHeight
      setPopupStyle({
        position: 'fixed',
        ...(showAbove
          ? { bottom: `${window.innerHeight - rect.top + 4}px` }
          : { top: `${rect.bottom + 4}px` }
        ),
        left: `${Math.max(4, Math.min(rect.left, window.innerWidth - 260))}px`,
        zIndex: 9999,
        minWidth: '240px',
      })
    }
  }, [open])

  function adjust(field: keyof GuestsValue, delta: number) {
    const next = { ...value }
    next[field] = Math.max(
      field === 'children' ? 0 : 1,
      next[field] + delta
    )
    onChange(next)
  }

  const displayText = `${value.rooms} Room${value.rooms > 1 ? 's' : ''}, ${value.adults} Adult${value.adults > 1 ? 's' : ''}, ${value.children} Child${value.children !== 1 ? 'ren' : ''}`

  const popup = (
    <div
      ref={popupRef}
      style={popupStyle}
      className="rounded-xl border border-border bg-card shadow-lg animate-in fade-in duration-150 p-4 space-y-4"
    >
      {/* Rooms */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Rooms</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={value.rooms <= 1}
            onClick={() => adjust('rooms', -1)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted hover:bg-cream hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center text-sm font-medium text-foreground">{value.rooms}</span>
          <button
            type="button"
            onClick={() => adjust('rooms', 1)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted hover:bg-cream hover:text-primary transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Adults */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Adults</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={value.adults <= 1}
            onClick={() => adjust('adults', -1)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted hover:bg-cream hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center text-sm font-medium text-foreground">{value.adults}</span>
          <button
            type="button"
            onClick={() => adjust('adults', 1)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted hover:bg-cream hover:text-primary transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Children */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Children</p>
          <p className="text-[10px] text-muted">Ages 0–17</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={value.children <= 0}
            onClick={() => adjust('children', -1)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted hover:bg-cream hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center text-sm font-medium text-foreground">{value.children}</span>
          <button
            type="button"
            onClick={() => adjust('children', 1)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted hover:bg-cream hover:text-primary transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className={cn('', className)}>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            'flex h-10 w-full items-center rounded-lg border bg-card px-3 py-2 text-sm text-left ring-offset-card transition-colors',
            'hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary',
            error ? 'border-danger focus-visible:ring-danger/50' : 'border-border',
          )}
        >
          <Users className="mr-2 h-4 w-4 shrink-0 text-muted" />
          <span className="flex-1 truncate text-foreground">{displayText}</span>
        </button>

        {open && ReactDOM.createPortal(popup, document.body)}
      </div>

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}
