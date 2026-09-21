import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePublicForgotPassword, useHotelName } from '@/hooks/usePublicApi'
import { Loader2, MailCheck } from 'lucide-react'

export default function PublicForgotPasswordPage() {
  const hotelName = useHotelName()
  const forgotPassword = usePublicForgotPassword()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await forgotPassword.mutateAsync({ email })
      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
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
            Reset Your <span className="text-gold">Password</span>
          </h2>
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

            {sent ? (
              <div className="bg-surface/80 backdrop-blur-md border border-slate-700/60 rounded-3xl p-8 shadow-2xl border-t-2 border-t-gold/50 text-center">
                <div className="w-16 h-16 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-6">
                  <MailCheck className="h-8 w-8 text-success" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-3">Check Your Email</h1>
                <p className="text-slate-400 text-sm leading-relaxed mb-2">
                  If an account exists with <span className="text-white/70">{email}</span>, we&apos;ve sent a 6-digit reset code.
                </p>
                <p className="text-slate-400 text-sm leading-relaxed mb-2">
                  The code expires in <span className="text-gold">15 minutes</span>.
                </p>
                <p className="text-gold/70 text-xs leading-relaxed mb-8">
                  Didn&apos;t receive it? Check your <span className="text-gold font-medium">spam or junk folder</span>.
                </p>
                <Link
                  to="/public/reset-password"
                  state={{ email }}
                  className="bg-gold hover:bg-gold-dark text-slate-950 font-bold py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-lg shadow-gold/10 inline-flex items-center justify-center gap-2 px-8 transition-all"
                >
                  Enter Reset Code
                </Link>
                <div className="mt-8">
                  <Link to="/public/login" className="text-sm text-slate-400 hover:text-gold transition-colors">
                    &larr; Back to login
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-surface/80 backdrop-blur-md border border-slate-700/60 rounded-3xl p-8 shadow-2xl border-t-2 border-t-gold/50">
                <h1 className="text-2xl font-bold text-white text-center mb-2">Forgot Password?</h1>
                <p className="text-slate-400 text-sm text-center mb-6">Enter your email and we&apos;ll send you a reset code</p>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div role="alert" className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>
                  )}
                  <div>
                    <label htmlFor="fp_email" className="text-xs font-semibold uppercase tracking-wider text-gold-highlight block mb-2">Email</label>
                    <input
                      id="fp_email"
                      name="email"
                      aria-label="Email address"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-canvas/90 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none transition-colors w-full"
                      placeholder="you@email.com"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={forgotPassword.isPending}
                    className="bg-gold hover:bg-gold-dark text-slate-950 font-bold py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-lg shadow-gold/10 w-full flex items-center justify-center gap-2 transition-all"
                  >
                    {forgotPassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Send Reset Code
                  </button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-400">
                  Remember your password?{' '}
                  <Link to="/public/login" className="text-gold font-medium hover:underline">Sign in</Link>
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
