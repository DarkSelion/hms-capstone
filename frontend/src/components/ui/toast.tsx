import { useState, createContext, useContext, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  message: string
  variant: ToastVariant
  duration: number
}

interface ToastContextType {
  addToast: (message: string, variant: ToastVariant, duration?: number) => void
}

const DEFAULT_DURATION = 4000

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const iconColor = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
}

const progressColor = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const Icon = iconMap[toast.variant]
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const pct = Math.max(0, 100 - (elapsed / toast.duration) * 100)
      setProgress(pct)
      if (pct > 0) requestAnimationFrame(tick)
    }
    const raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [toast.duration])

  useEffect(() => {
    const timer = setTimeout(() => onClose(), toast.duration)
    return () => clearTimeout(timer)
  }, [toast.duration, onClose])

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white shadow-xl shadow-black/10 animate-slide-in-right border border-gray-100 w-full sm:w-[360px]">
      <div className="flex items-start gap-3 p-4">
        <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', iconColor[toast.variant])} />
        <p className="flex-1 text-sm text-gray-800 leading-relaxed">{toast.message}</p>
        <button onClick={onClose} className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="h-0.5 bg-gray-100">
        <div
          className={cn('h-full transition-none rounded-full', progressColor[toast.variant])}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, variant: ToastVariant, duration: number = DEFAULT_DURATION) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, variant, duration }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-sm:left-4 max-sm:right-4 max-sm:bottom-4">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
