import { useState, useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useVerifyEmail, useSendVerificationEmail } from '@/hooks/usePublicApi'
import { usePublicAuthStore } from '@/stores/publicAuthStore'
import { OTPInput } from '@/components/ui/otp-input'
import { Loader2, CheckCircle, Mail, X } from 'lucide-react'

const OTP_LENGTH = 6

interface EmailVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  onVerified?: () => void
}

export function EmailVerificationModal({ isOpen, onClose, onVerified }: EmailVerificationModalProps) {
  const queryClient = useQueryClient()
  const user = usePublicAuthStore((s) => s.user)
  const email = user?.email || ''

  const verifyEmail = useVerifyEmail()
  const sendVerification = useSendVerificationEmail()

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const code = digits.join('')
  const codeComplete = code.length === OTP_LENGTH
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sentRef = useRef(false)

  // Auto-send OTP on open (once)
  useEffect(() => {
    if (isOpen && email && !sentRef.current) {
      sentRef.current = true
      sendVerification.mutate(undefined, {
        onError: () => {},
      })
    }
    if (!isOpen) {
      sentRef.current = false
    }
  }, [isOpen, email]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setDigits(Array(OTP_LENGTH).fill(''))
      setError('')
      setSuccess(false)
      setCooldown(0)
    }
  }, [isOpen])

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current) }
  }, [cooldown > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleResend = useCallback(() => {
    if (cooldown > 0 || !email) return
    setError('')
    setDigits(Array(OTP_LENGTH).fill(''))
    sendVerification.mutate(undefined, {
      onSuccess: () => {
        setCooldown(60)
        setError('')
      },
      onError: () => setError('Failed to send verification code. Please try again.'),
    })
  }, [cooldown, email, sendVerification])

  const handleVerify = useCallback(() => {
    if (!codeComplete || !email) return
    setError('')
    verifyEmail.mutate(
      { email, code },
      {
        onSuccess: () => {
          setSuccess(true)
          queryClient.invalidateQueries({ queryKey: ['public-me'] })
          onVerified?.()
        },
        onError: (err: any) => {
          setError(err.message || 'Invalid or expired code. Please try again.')
          setDigits(Array(OTP_LENGTH).fill(''))
        },
      }
    )
  }, [codeComplete, email, verifyEmail, queryClient, onVerified])

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (codeComplete && !verifyEmail.isPending && !success) {
      handleVerify()
    }
  }, [codeComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md mx-4 rounded-2xl bg-dark border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
              <Mail className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Verify Your Email</h2>
              <p className="text-xs text-white/40">
                {email ? `Code sent to ${email}` : 'Enter the code sent to your email'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/30 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-4">
          {success ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-7 w-7 text-emerald-400" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-1">Email Verified!</h3>
              <p className="text-white/40 text-sm mb-6">
                Your email has been verified. You can now make reservations.
              </p>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-lg bg-gold text-dark text-sm font-semibold hover:bg-gold/90 transition-colors"
              >
                Continue
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              {/* OTP Section */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-3.5 w-3.5 text-gold/60" />
                  <span className="text-[11px] uppercase tracking-[0.12em] text-white/40 font-medium">Verification Code</span>
                </div>
                <p className="text-gold/60 text-xs mb-4">
                  Check your <span className="font-medium">spam/junk folder</span> if you don&apos;t see the email.
                </p>
                <OTPInput
                  length={OTP_LENGTH}
                  value={digits}
                  onChange={setDigits}
                  disabled={verifyEmail.isPending}
                  variant="portal"
                />
                <div className="flex justify-center mt-3">
                  {codeComplete && (
                    <span className="text-[11px] text-success/70 animate-fade-in">{code}</span>
                  )}
                </div>
              </div>

              {/* Verify Button */}
              <button
                onClick={handleVerify}
                disabled={!codeComplete || verifyEmail.isPending}
                className="w-full py-2.5 rounded-lg bg-gold text-dark text-sm font-semibold flex items-center justify-center gap-2 hover:bg-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {verifyEmail.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify Email
              </button>

              {/* Resend */}
              <div className="mt-4 text-center">
                {cooldown > 0 ? (
                  <p className="text-white/30 text-sm">
                    Resend code in <span className="text-white/50">{cooldown}s</span>
                  </p>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={sendVerification.isPending}
                    className="text-gold text-sm hover:underline disabled:opacity-50"
                  >
                    {sendVerification.isPending ? 'Sending...' : 'Resend Code'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
