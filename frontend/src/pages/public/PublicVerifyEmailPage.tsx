import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useVerifyEmail, useSendVerificationEmail, useHotelName, usePublicMe } from '@/hooks/usePublicApi'
import { usePublicAuthStore } from '@/stores/publicAuthStore'
import { OTPInput } from '@/components/ui/otp-input'
import { Loader2, CheckCircle, Mail, ArrowLeft } from 'lucide-react'

const OTP_LENGTH = 6

export default function PublicVerifyEmailPage() {
  const hotelName = useHotelName()
  const navigate = useNavigate()
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

  // Auto-send OTP on mount
  useEffect(() => {
    if (email) {
      sendVerification.mutate(undefined, {
        onError: () => {},
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
        onSuccess: (res) => {
          setSuccess(true)
          queryClient.invalidateQueries({ queryKey: ['public-me'] })
        },
        onError: (err: any) => {
          setError(err.message || 'Invalid or expired code. Please try again.')
          setDigits(Array(OTP_LENGTH).fill(''))
        },
      }
    )
  }, [codeComplete, email, verifyEmail, queryClient])

  // Auto-submit when 6 digits are entered
  useEffect(() => {
    if (codeComplete && !verifyEmail.isPending && !success) {
      handleVerify()
    }
  }, [codeComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Hotel Image */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&h=900&fit=crop"
          alt={hotelName}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-dark/90 via-dark/15 to-dark" />
        <div className="relative z-10 px-10 max-w-lg">
          <Link to="/public" className="font-serif text-gold text-3xl font-light tracking-wider">{hotelName}</Link>
          <h2 className="font-serif text-white text-4xl font-light mt-6 leading-tight">
            Email <span className="text-gold">Verification</span>
          </h2>
          <p className="text-white/50 text-sm mt-4 leading-relaxed">
            Enter the 6-digit code sent to your email to verify your account.
          </p>
          <div className="gold-line-left mt-6" />
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex flex-col bg-dark min-h-screen">
        <div className="flex-1 flex items-center justify-center px-12 py-12">
          <div className="w-full max-w-md animate-fade-in px-8">
            {/* Mobile logo */}
            <div className="text-center mb-10 lg:hidden">
              <Link to="/public" className="font-serif text-gold text-2xl font-light tracking-wider">{hotelName}</Link>
            </div>

            {success ? (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
                <h1 className="font-serif text-white text-3xl font-light mb-3">Email Verified!</h1>
                <p className="text-white/50 text-sm leading-relaxed mb-8">
                  Your email has been verified. You can now make reservations.
                </p>
                <Link
                  to="/public/rooms"
                  className="btn-gold inline-flex items-center justify-center gap-2 px-8"
                >
                  Start Booking
                </Link>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="mb-8">
                  <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mb-4">
                    <Mail className="h-6 w-6 text-gold" />
                  </div>
                  <h1 className="font-serif text-white text-3xl font-light mb-2">Verify Your Email</h1>
                  <p className="text-white/50 text-sm">
                    {email ? (
                      <>We sent a 6-digit code to <span className="text-white/70">{email}</span></>
                    ) : (
                      'Enter the code sent to your email address.'
                    )}
                  </p>
                  <div className="gold-line-left mt-4" />
                </div>

                {error && (
                  <div role="alert" className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg mb-6">
                    {error}
                  </div>
                )}

                {/* OTP Section */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Mail className="h-4 w-4 text-gold/70" />
                    <span className="text-xs uppercase tracking-[0.12em] text-white/50 font-medium">Verification Code</span>
                  </div>

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
                  className="btn-gold w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {verifyEmail.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Verify Email
                </button>

                {/* Resend */}
                <div className="mt-6 text-center">
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

                {/* Footer links */}
                <div className="mt-8 text-center text-sm text-white/30">
                  <Link to="/public/my-reservations" className="inline-flex items-center gap-1.5 hover:text-gold transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to My Reservations
                  </Link>
                </div>

                <p className="text-center text-[11px] text-white/15 mt-8">
                  <Link to="/public" className="hover:text-gold transition-colors">&larr; Back to hotel website</Link>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Compact footer */}
        <div className="border-t border-white/5 py-6 px-6">
          <p className="text-center text-[11px] text-white/20">
            &copy; {new Date().getFullYear()} {hotelName}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
