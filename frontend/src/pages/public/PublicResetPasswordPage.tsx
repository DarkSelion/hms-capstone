import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { usePublicResetPassword, useHotelName } from '@/hooks/usePublicApi'
import { Loader2, KeyRound, CheckCircle } from 'lucide-react'

export default function PublicResetPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const hotelName = useHotelName()
  const resetPassword = usePublicResetPassword()

  const prefillEmail = (location.state as { email?: string } | null)?.email || ''

  const [email, setEmail] = useState(prefillEmail)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
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
            Create a New <span className="text-gold">Password</span>
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

            {success ? (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
                <h1 className="font-serif text-white text-3xl font-light mb-3">Password Reset!</h1>
                <p className="text-white/50 text-sm leading-relaxed mb-8">
                  Your password has been updated. Redirecting to login...
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
                <div>
                  <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mb-4">
                    <KeyRound className="h-6 w-6 text-gold" />
                  </div>
                  <h1 className="font-serif text-white text-3xl font-light mb-2">Reset Password</h1>
                  <p className="text-white/50 text-sm">Enter the code from your email and your new password</p>
                  <div className="gold-line-left mt-4" />
                </div>

                <form onSubmit={handleSubmit} className="mt-10 space-y-5">
                  {error && (
                    <div role="alert" className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>
                  )}
                  <div>
                    <label htmlFor="rp_email" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Email</label>
                    <input
                      id="rp_email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="input-public"
                      placeholder="you@email.com"
                    />
                  </div>
                  <div>
                    <label htmlFor="rp_code" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Reset Code</label>
                    <input
                      id="rp_code"
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      className="input-public text-center tracking-[0.3em] text-lg"
                      placeholder="000000"
                      maxLength={6}
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <label htmlFor="rp_password" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">New Password</label>
                    <input
                      id="rp_password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="input-public"
                      placeholder="Min. 8 characters"
                    />
                  </div>
                  <div>
                    <label htmlFor="rp_password_confirmation" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Confirm Password</label>
                    <input
                      id="rp_password_confirmation"
                      type="password"
                      value={passwordConfirmation}
                      onChange={(e) => setPasswordConfirmation(e.target.value)}
                      required
                      minLength={8}
                      className="input-public"
                      placeholder="Re-enter your password"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={resetPassword.isPending}
                    className="btn-gold w-full flex items-center justify-center gap-2"
                  >
                    {resetPassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Reset Password
                  </button>
                </form>

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
