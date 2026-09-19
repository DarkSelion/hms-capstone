import { useState, useRef, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { usePublicResetPassword, useHotelName } from '@/hooks/usePublicApi'
import { Loader2, ShieldCheck, CheckCircle, Mail, Eye, EyeOff, CircleCheck, Circle } from 'lucide-react'

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

  const pwChecks = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
  ]

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
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-canvas/60 to-canvas" />
        <div className="relative z-10 px-10 max-w-lg">
          <Link to="/public" className="text-xl font-bold text-gold tracking-wider">{hotelName}</Link>
          <h2 className="text-3xl font-bold text-white mt-6 leading-tight">
            Secure Your <span className="text-gold">Account</span>
          </h2>
          <p className="text-slate-400 text-sm mt-4 leading-relaxed">
            Enter the verification code sent to your email, then choose a new password.
          </p>
          <div className="gold-line-left mt-6" />
        </div>
      </div>

      {/* Right Panel — Form + Footer */}
      <div className="flex-1 flex flex-col bg-canvas h-screen">
        <div className="flex-1 flex items-center justify-center px-12 py-12 overflow-y-auto">
          <div className="w-full max-w-md animate-fade-in px-8">
            {/* Mobile logo */}
            <div className="text-center mb-10 lg:hidden">
              <Link to="/public" className="text-xl font-bold text-gold tracking-wider">{hotelName}</Link>
            </div>

            {success ? (
              <div className="bg-surface/80 backdrop-blur-md border border-slate-700/60 rounded-3xl p-8 shadow-2xl border-t-2 border-t-gold/50 text-center">
                <div className="w-16 h-16 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-3">Password Reset!</h1>
                <p className="text-slate-400 text-sm leading-relaxed mb-8">
                  Your password has been updated. Redirecting to login…
                </p>
                <Link
                  to="/public/login"
                  className="bg-gold hover:bg-gold-dark text-slate-950 font-bold py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-lg shadow-gold/10 inline-flex items-center justify-center gap-2 px-8 transition-all"
                >
                  Go to Login
                </Link>
              </div>
            ) : (
              <div className="bg-surface/80 backdrop-blur-md border border-slate-700/60 rounded-3xl p-8 shadow-2xl border-t-2 border-t-gold/50">
                {/* Header */}
                <div className="mb-6">
                  <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mb-4 mx-auto">
                    <ShieldCheck className="h-6 w-6 text-gold" />
                  </div>
                  <h1 className="text-2xl font-bold text-white text-center mb-2">Reset Password</h1>
                  <p className="text-slate-400 text-sm text-center">Enter the code from your email and choose a new password</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div role="alert" className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">
                      {error}
                    </div>
                  )}

                  {/* Section 1 — Verification Code */}
                  <div className="rounded-2xl border border-slate-700/60 bg-canvas/60 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Mail className="h-4 w-4 text-gold/70" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-gold-highlight">Verification Code</span>
                    </div>
                    <p className="text-gold/70 text-xs mb-4">Check your <span className="font-medium">spam/junk folder</span> if you don&apos;t see the email.</p>

                    {/* Email */}
                    <div className="mb-4">
                      <label htmlFor="rp_email" className="text-xs font-semibold uppercase tracking-wider text-gold-highlight block mb-2">Email</label>
                      <input
                        id="rp_email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-canvas/90 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none transition-colors w-full"
                        placeholder="you@email.com"
                      />
                    </div>

                    {/* 6-digit OTP boxes */}
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-gold-highlight block mb-2">Reset Code</label>
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
                            className={`w-12 h-14 text-center text-xl font-bold rounded-xl border transition-all duration-200 outline-none
                              ${digits[i]
                                ? 'bg-gold/[0.08] border-gold/40 text-gold'
                                : 'bg-canvas/80 border-slate-700 text-white'
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
                    <div className="flex-1 h-px bg-slate-700/60" />
                    <span className="text-[11px] uppercase tracking-[0.12em] text-slate-500/60">Set new password</span>
                    <div className="flex-1 h-px bg-slate-700/60" />
                  </div>

                  {/* Section 2 — New Password */}
                  <div className="rounded-2xl border border-slate-700/60 bg-canvas/60 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <ShieldCheck className="h-4 w-4 text-gold/70" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-gold-highlight">New Password</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label htmlFor="rp_password" className="text-xs font-semibold uppercase tracking-wider text-gold-highlight block mb-2">Password</label>
                        <div className="relative">
                          <input
                            id="rp_password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            className="bg-canvas/90 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 pr-10 text-sm focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none transition-colors w-full"
                            placeholder="Min. 8 characters"
                          />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <div className="mt-2 space-y-1">
                          {pwChecks.map((c) => (
                            <div key={c.label} className="flex items-center gap-1.5">
                              {c.met ? (
                                <CircleCheck className="h-3 w-3 text-success" />
                              ) : (
                                <Circle className="h-3 w-3 text-slate-500/40" />
                              )}
                              <span className={`text-[11px] ${c.met ? 'text-success' : 'text-slate-500/40'}`}>{c.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label htmlFor="rp_password_confirmation" className="text-xs font-semibold uppercase tracking-wider text-gold-highlight block mb-2">Confirm Password</label>
                        <div className="relative">
                          <input
                            id="rp_password_confirmation"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={passwordConfirmation}
                            onChange={(e) => setPasswordConfirmation(e.target.value)}
                            required
                            minLength={8}
                            className="bg-canvas/90 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 pr-10 text-sm focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none transition-colors w-full"
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
                    disabled={resetPassword.isPending || !codeComplete || !pwChecks.every(c => c.met)}
                    className="bg-gold hover:bg-gold-dark text-slate-950 font-bold py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-lg shadow-gold/10 w-full flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {resetPassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Reset Password
                  </button>
                </form>

                {/* Footer links */}
                <div className="mt-6 text-center text-sm text-slate-400">
                  <Link to="/public/forgot-password" className="text-gold hover:underline">Request a new code</Link>
                  {' '}&middot;{' '}
                  <Link to="/public/login" className="hover:text-gold transition-colors">Back to login</Link>
                  <p className="text-xs text-slate-500/50 mt-2">Tip: You can also check your spam folder.</p>
                </div>

                <p className="text-center text-xs text-slate-500/50 mt-6">
                  <Link to="/public" className="hover:text-gold transition-colors">&larr; Back to hotel website</Link>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Compact footer */}
        <div className="border-t border-slate-800 py-6 px-6">
          <p className="text-center text-[11px] text-slate-500">
            &copy; {new Date().getFullYear()} {hotelName}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
