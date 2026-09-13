import { useState, useRef, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { usePublicResetPassword, useHotelName } from '@/hooks/usePublicApi'
import { Loader2, ShieldCheck, CheckCircle, Mail, Eye, EyeOff } from 'lucide-react'

const OTP_LENGTH = 6

export default function PublicResetPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const hotelName = useHotelName()
  const resetPassword = usePublicResetPassword()

  const prefillEmail = (location.state as { email?: string } | null)?.email || ''

  const [email, setEmail] = useState(prefillEmail)
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const code = digits.join('')

  const focusInput = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, OTP_LENGTH - 1))
    inputRefs.current[clamped]?.focus()
    inputRefs.current[clamped]?.select()
  }, [])

  const handleDigitChange = useCallback((index: number, value: string) => {
    if (/\D/.test(value)) return
    const next = [...digits]
    next[index] = value.slice(-1)
    setDigits(next)
    if (value && index < OTP_LENGTH - 1) focusInput(index + 1)
  }, [digits, focusInput])

  const handleDigitKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const next = [...digits]
        next[index - 1] = ''
        setDigits(next)
        focusInput(index - 1)
      } else {
        const next = [...digits]
        next[index] = ''
        setDigits(next)
      }
      e.preventDefault()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusInput(index - 1)
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      focusInput(index + 1)
    }
  }, [digits, focusInput])

  const handleDigitPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    const next = Array(OTP_LENGTH).fill('')
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    setDigits(next)
    focusInput(Math.min(pasted.length, OTP_LENGTH - 1))
  }, [focusInput])

  const codeComplete = code.length === OTP_LENGTH

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!codeComplete) {
      setError('Please enter the full 6-digit code.')
      return
    }
    try {
      await resetPassword.mutateAsync({ email, code, password, password_confirmation: passwordConfirmation })
      setSuccess(true)
      setTimeout(() => navigate('/public/login', { replace: true }), 3000)
    } catch (err: any) {
      setError(err.message || 'Invalid code or expired. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Hotel Image */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&h=900&fit=crop"
          alt={hotelName}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-dark/90 via-dark/15 to-dark" />
        <div className="relative z-10 px-10 max-w-lg">
          <Link to="/public" className="font-serif text-gold text-3xl font-light tracking-wider">{hotelName}</Link>
          <h2 className="font-serif text-white text-4xl font-light mt-6 leading-tight">
            Secure Your <span className="text-gold">Account</span>
          </h2>
          <p className="text-white/50 text-sm mt-4 leading-relaxed">
            Enter the verification code sent to your email, then choose a new password.
          </p>
          <div className="gold-line-left mt-6" />
        </div>
      </div>

      {/* Right Panel — Form + Footer */}
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
                <h1 className="font-serif text-white text-3xl font-light mb-3">Password Reset!</h1>
                <p className="text-white/50 text-sm leading-relaxed mb-8">
                  Your password has been updated. Redirecting to login…
                </p>
                <Link
                  to="/public/login"
                  className="btn-gold inline-flex items-center justify-center gap-2 px-8"
                >
                  Go to Login
                </Link>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="mb-8">
                  <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mb-4">
                    <ShieldCheck className="h-6 w-6 text-gold" />
                  </div>
                  <h1 className="font-serif text-white text-3xl font-light mb-2">Reset Password</h1>
                  <p className="text-white/50 text-sm">Enter the code from your email and choose a new password</p>
                  <div className="gold-line-left mt-4" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div role="alert" className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">
                      {error}
                    </div>
                  )}

                  {/* Section 1 — Verification Code */}
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Mail className="h-4 w-4 text-gold/70" />
                      <span className="text-xs uppercase tracking-[0.12em] text-white/50 font-medium">Verification Code</span>
                    </div>

                    {/* Email */}
                    <div className="mb-4">
                      <label htmlFor="rp_email" className="text-[11px] uppercase tracking-[0.12em] text-white/30 block mb-1.5">Email</label>
                      <input
                        id="rp_email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="input-public text-sm"
                        placeholder="you@email.com"
                      />
                    </div>

                    {/* 6-digit OTP boxes */}
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.12em] text-white/30 block mb-2">Reset Code</label>
                      <div className="flex justify-center gap-2.5">
                        {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                          <input
                            key={i}
                            ref={(el) => { inputRefs.current[i] = el }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digits[i]}
                            onChange={(e) => handleDigitChange(i, e.target.value)}
                            onKeyDown={(e) => handleDigitKeyDown(i, e)}
                            onPaste={handleDigitPaste}
                            onFocus={(e) => e.target.select()}
                            className={`w-11 h-13 text-center text-lg font-semibold rounded-lg border transition-all duration-200 outline-none
                              ${digits[i]
                                ? 'bg-gold/[0.08] border-gold/40 text-gold'
                                : 'bg-white/[0.04] border-white/[0.08] text-white'
                              }
                              focus:border-gold/60 focus:bg-gold/[0.06] focus:ring-1 focus:ring-gold/20`}
                            aria-label={`Digit ${i + 1}`}
                          />
                        ))}
                      </div>
                      <div className="flex justify-center mt-2">
                        {codeComplete && (
                          <span className="text-[11px] text-success/70 animate-fade-in">{code}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/[0.06]" />
                    <span className="text-[11px] uppercase tracking-[0.12em] text-white/20">Set new password</span>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                  </div>

                  {/* Section 2 — New Password */}
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <ShieldCheck className="h-4 w-4 text-gold/70" />
                      <span className="text-xs uppercase tracking-[0.12em] text-white/50 font-medium">New Password</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label htmlFor="rp_password" className="text-[11px] uppercase tracking-[0.12em] text-white/30 block mb-1.5">Password</label>
                        <div className="relative">
                          <input
                            id="rp_password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            className="input-public text-sm pr-10"
                            placeholder="Min. 8 characters"
                          />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="rp_password_confirmation" className="text-[11px] uppercase tracking-[0.12em] text-white/30 block mb-1.5">Confirm Password</label>
                        <div className="relative">
                          <input
                            id="rp_password_confirmation"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={passwordConfirmation}
                            onChange={(e) => setPasswordConfirmation(e.target.value)}
                            required
                            minLength={8}
                            className="input-public text-sm pr-10"
                            placeholder="Re-enter your password"
                          />
                          <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={resetPassword.isPending || !codeComplete}
                    className="btn-gold w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {resetPassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Reset Password
                  </button>
                </form>

                {/* Footer links */}
                <div className="mt-8 text-center text-sm text-white/30">
                  <Link to="/public/forgot-password" className="text-gold hover:underline">Request a new code</Link>
                  {' '}&middot;{' '}
                  <Link to="/public/login" className="hover:text-gold transition-colors">Back to login</Link>
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
