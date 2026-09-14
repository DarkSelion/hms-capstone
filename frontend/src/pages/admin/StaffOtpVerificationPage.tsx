import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hotel, ShieldCheck, Loader2, ArrowLeft, RefreshCw, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OTPInput } from '@/components/ui/otp-input'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useHotelName } from '@/hooks/usePublicApi'

const OTP_LENGTH = 6
const MAX_ATTEMPTS = 5

function getDeviceInfo() {
  const ua = navigator.userAgent
  let browser = 'Other'
  if (ua.includes('Edg/')) browser = 'Edge'
  else if (ua.includes('OPR/') || ua.includes('Opera')) browser = 'Opera'
  else if (ua.includes('Chrome') && !ua.includes('Edg/')) browser = 'Chrome'
  else if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'

  let os = 'Other'
  if (ua.includes('Windows NT 10')) os = 'Windows 10/11'
  else if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac OS X')) os = 'macOS'
  else if (ua.includes('Linux') && !ua.includes('Android')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'

  return { browser, os, deviceName: `${browser} on ${os}` }
}

async function computeDeviceHash(): Promise<string> {
  const ua = navigator.userAgent
  const lang = navigator.language
  const screen = `${screen.width}x${screen.height}`
  const data = `${ua}|${lang}|${screen}`
  const encoder = new TextEncoder()
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function StaffOtpVerificationPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const tempToken = useAuthStore((s) => s.tempToken)
  const hotelName = useHotelName()

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [trustDevice, setTrustDevice] = useState(true)

  const deviceInfo = useMemo(() => getDeviceInfo(), [])
  const [deviceHash, setDeviceHash] = useState<string>('')

  useEffect(() => {
    computeDeviceHash().then(setDeviceHash)
  }, [])

  const code = digits.join('')
  const codeComplete = code.length === OTP_LENGTH

  // Redirect if no temp token
  useEffect(() => {
    if (!tempToken) {
      navigate('/admin/login', { replace: true })
    }
  }, [tempToken, navigate])

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const handleVerify = useCallback(async () => {
    if (!codeComplete || !tempToken) return
    setError('')

    try {
      const response = await api.post<{ token: string; user: any }>('/login/verify-otp', {
        temp_token: tempToken,
        otp: code,
        trust_device: trustDevice,
        device_name: deviceInfo.deviceName,
      })

      const { token, user } = response
      const rawRole = user?.role
      const roleSlug = typeof rawRole === 'object' && rawRole
        ? rawRole?.slug ?? ''
        : typeof rawRole === 'string' ? rawRole : ''

      setAuth(token, { ...user, role: roleSlug })
      navigate('/admin/dashboard')
    } catch (err: any) {
      const newAttempts = attempts + 1
      setAttempts(newAttempts)

      if (newAttempts >= MAX_ATTEMPTS) {
        setError('Too many failed attempts. Please log in again.')
        setTimeout(() => navigate('/admin/login', { replace: true }), 2000)
      } else {
        setError(err.message || 'Invalid code. Please try again.')
        setDigits(Array(OTP_LENGTH).fill(''))
      }
    }
  }, [code, codeComplete, tempToken, attempts, trustDevice, deviceInfo, setAuth, navigate])

  // Auto-submit when code is complete
  useEffect(() => {
    if (codeComplete && attempts < MAX_ATTEMPTS) {
      handleVerify()
    }
  }, [codeComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleResend = () => {
    setError('Please go back to login and sign in again to receive a new code.')
  }

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding */}
      <div className="relative hidden flex-1 items-center justify-center bg-gradient-to-br from-primary via-primary-dark to-primary p-12 lg:flex">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full border border-white/10" />
          <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full border border-white/5" />
          <div className="absolute left-1/2 top-1/3 h-px w-64 -translate-x-1/2 bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
        </div>
        <div className="relative text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/20 ring-1 ring-gold/30">
            <Hotel className="h-8 w-8 text-gold" />
          </div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight text-white">
            {hotelName}
          </h1>
          <p className="text-lg text-white/80">
            Admin Dashboard
          </p>
          <div className="mt-8 flex items-center justify-center gap-2 text-gold/60">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-sm">Two-Factor Authentication</span>
          </div>
        </div>
      </div>

      {/* Right Panel - OTP Form */}
      <div className="flex flex-1 items-center justify-center bg-bg p-4">
        <div className="w-full max-w-md animate-[fadeIn_0.6s_ease-out]">
          {/* Mobile header */}
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Hotel className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-primary">
              {hotelName}
            </h1>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
            <div className="mb-6 animate-[fadeIn_0.5s_ease-out_0.05s_forwards] opacity-0">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/20">
                <ShieldCheck className="h-6 w-6 text-gold" />
              </div>
              <h2 className="text-xl font-semibold text-foreground text-center">
                Verify Your Identity
              </h2>
              <p className="mt-2 text-sm text-muted text-center">
                Enter the 6-digit code sent to your email
              </p>
            </div>

            {error && (
              <div className="mb-4 animate-[fadeIn_0.3s_ease-out] rounded-lg bg-danger/10 p-3 text-sm text-danger text-center">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {/* OTP Input */}
              <div className="animate-[fadeIn_0.5s_ease-out_0.1s_forwards] opacity-0">
                <label className="text-xs uppercase tracking-widest text-muted block mb-3 text-center">
                  Verification Code
                </label>
                <OTPInput
                  length={OTP_LENGTH}
                  value={digits}
                  onChange={setDigits}
                  disabled={attempts >= MAX_ATTEMPTS}
                  variant="admin"
                />
              </div>

              {/* Attempts counter */}
              {attempts > 0 && attempts < MAX_ATTEMPTS && (
                <p className="text-xs text-muted text-center">
                  {MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts !== 1 ? 's' : ''} remaining
                </p>
              )}

              {/* Trust this device */}
              <div className="animate-[fadeIn_0.5s_ease-out_0.15s_forwards] opacity-0">
                <label className="flex items-start gap-3 rounded-xl bg-bg p-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/50"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      Trust this device
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      Skip verification on future logins from {deviceInfo.deviceName}
                    </p>
                  </div>
                  <Monitor className="mt-0.5 h-4 w-4 text-muted" />
                </label>
              </div>

              {/* Verify button */}
              <div className="animate-[fadeIn_0.5s_ease-out_0.2s_forwards] opacity-0">
                <Button
                  type="button"
                  onClick={handleVerify}
                  disabled={!codeComplete || attempts >= MAX_ATTEMPTS}
                  size="lg"
                  className="w-full bg-gradient-to-r from-gold to-gold-light text-white hover:from-gold-dark hover:to-gold"
                >
                  {attempts >= MAX_ATTEMPTS ? (
                    'Too many attempts'
                  ) : (
                    'Verify Code'
                  )}
                </Button>
              </div>

              {/* Resend */}
              <div className="animate-[fadeIn_0.5s_ease-out_0.3s_forwards] opacity-0 text-center">
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-sm text-gold hover:underline inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Resend Code
                </button>
              </div>
            </div>

            {/* Back to login */}
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => navigate('/admin/login', { replace: true })}
                className="text-sm text-muted hover:text-foreground inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
