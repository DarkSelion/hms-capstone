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
        <div className="absolute inset-0 bg-gradient-to-r from-dark/90 via-dark/15 to-dark" />
        <div className="relative z-10 px-10 max-w-lg">
          <Link to="/public" className="font-serif text-gold text-3xl font-light tracking-wider">{hotelName}</Link>
          <h2 className="font-serif text-white text-4xl font-light mt-6 leading-tight">
            Reset Your <span className="text-gold">Password</span>
          </h2>
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

            {sent ? (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-6">
                  <MailCheck className="h-8 w-8 text-success" />
                </div>
                <h1 className="font-serif text-white text-3xl font-light mb-3">Check Your Email</h1>
                <p className="text-white/50 text-sm leading-relaxed mb-2">
                  If an account exists with <span className="text-white/70">{email}</span>, we&apos;ve sent a 6-digit reset code.
                </p>
                <p className="text-white/50 text-sm leading-relaxed mb-2">
                  The code expires in <span className="text-gold">15 minutes</span>.
                </p>
                <p className="text-gold/70 text-xs leading-relaxed mb-8">
                  Didn&apos;t receive it? Check your <span className="text-gold font-medium">spam or junk folder</span>.
                </p>
                <Link
                  to="/public/reset-password"
                  state={{ email }}
                  className="btn-gold inline-flex items-center justify-center gap-2 px-8"
                >
                  Enter Reset Code
                </Link>
                <div className="mt-8">
                  <Link to="/public/login" className="text-sm text-white/30 hover:text-gold transition-colors">
                    &larr; Back to login
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h1 className="font-serif text-white text-3xl font-light mb-2">Forgot Password?</h1>
                  <p className="text-white/50 text-sm">Enter your email and we&apos;ll send you a reset code</p>
                  <div className="gold-line-left mt-4" />
                </div>

                <form onSubmit={handleSubmit} className="mt-10 space-y-5">
                  {error && (
                    <div role="alert" className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>
                  )}
                  <div>
                    <label htmlFor="fp_email" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Email</label>
                    <input
                      id="fp_email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="input-public"
                      placeholder="you@email.com"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={forgotPassword.isPending}
                    className="btn-gold w-full flex items-center justify-center gap-2"
                  >
                    {forgotPassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Send Reset Code
                  </button>
                </form>

                <div className="mt-8 text-center text-sm text-white/30">
                  Remember your password?{' '}
                  <Link to="/public/login" className="text-gold font-medium hover:underline">Sign in</Link>
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
