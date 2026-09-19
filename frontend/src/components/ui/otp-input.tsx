import { useRef, useCallback } from 'react'

interface OTPInputProps {
  length?: number
  value: string[]
  onChange: (digits: string[]) => void
  disabled?: boolean
  autoFocus?: boolean
  variant?: 'admin' | 'portal'
}

export function OTPInput({
  length = 6,
  value,
  onChange,
  disabled = false,
  autoFocus = true,
  variant = 'admin',
}: OTPInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const focusInput = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, length - 1))
    inputRefs.current[clamped]?.focus()
    inputRefs.current[clamped]?.select()
  }, [length])

  const handleDigitChange = useCallback((index: number, newValue: string) => {
    if (/\D/.test(newValue)) return
    const next = [...value]
    next[index] = newValue.slice(-1)
    onChange(next)
    if (newValue && index < length - 1) focusInput(index + 1)
  }, [value, onChange, length, focusInput])

  const handleDigitKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (!value[index] && index > 0) {
        const next = [...value]
        next[index - 1] = ''
        onChange(next)
        focusInput(index - 1)
      } else {
        const next = [...value]
        next[index] = ''
        onChange(next)
      }
      e.preventDefault()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusInput(index - 1)
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      focusInput(index + 1)
    }
  }, [value, onChange, length, focusInput])

  const handleDigitPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    const next = Array(length).fill('')
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    onChange(next)
    focusInput(Math.min(pasted.length, length - 1))
  }, [onChange, length, focusInput])

  const isPortal = variant === 'portal'

  return (
    <div className="flex justify-center gap-2.5">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={(e) => handleDigitChange(i, e.target.value)}
          onKeyDown={(e) => handleDigitKeyDown(i, e)}
          onPaste={handleDigitPaste}
          onFocus={(e) => e.target.select()}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          className={`w-12 h-14 text-center text-xl font-bold rounded-xl border transition-all duration-200 outline-none
            ${isPortal
              ? value[i]
                ? 'bg-gold/[0.08] border-gold/40 text-gold'
                : 'bg-[#0B132B]/80 border-slate-700 text-white'
              : value[i]
                ? 'bg-primary/5 border-primary/30 text-primary'
                : 'bg-card border-border text-foreground'
            }
            ${isPortal
              ? 'focus:border-gold/60 focus:bg-gold/[0.06] focus:ring-1 focus:ring-gold/20'
              : 'focus:border-primary/50 focus:bg-primary/5 focus:ring-1 focus:ring-primary/20'
            }
            disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  )
}
