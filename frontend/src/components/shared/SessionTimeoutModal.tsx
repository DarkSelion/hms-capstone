import { Clock, LogOut, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SessionTimeoutModalProps {
  open: boolean
  secondsLeft: number
  onExtend: () => void
  onLogout: () => void
}

export function SessionTimeoutModal({ open, secondsLeft, onExtend, onLogout }: SessionTimeoutModalProps) {
  if (!open) return null

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative mx-4 w-full max-w-sm animate-[scaleIn_0.2s_ease-out] rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warning/10 ring-1 ring-warning/20">
            <Clock className="h-7 w-7 text-warning" />
          </div>

          <h3 className="mb-1 text-lg font-semibold text-foreground">
            Session Expiring Soon
          </h3>
          <p className="mb-4 text-sm text-muted">
            Your session will expire in
          </p>

          {/* Countdown */}
          <div className="mb-4 font-mono text-3xl font-bold text-warning">
            {timeString}
          </div>

          <p className="mb-6 text-xs text-muted">
            You will be logged out automatically when the timer reaches zero.
          </p>

          <div className="flex w-full gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onLogout}
              className="flex-1"
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              Log Out
            </Button>
            <Button
              type="button"
              onClick={onExtend}
              className="flex-1 bg-gradient-to-r from-gold to-gold-light text-white hover:from-gold-dark hover:to-gold"
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Stay Logged In
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
