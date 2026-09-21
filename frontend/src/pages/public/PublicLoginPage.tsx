import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { usePublicLogin, useHotelName } from '@/hooks/usePublicApi'
import { Loader2, Eye, EyeOff } from 'lucide-react'

export default function PublicLoginPage() {
  const navigate = useNavigate()
  const hotelName = useHotelName()
  const [searchParams] = useSearchParams()
  const login = usePublicLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const redirect = (() => {
    const r = searchParams.get('redirect') || '/public'
    // Prevent open redirect — only allow relative paths starting with /
    if (!r.startsWith('/') || r.startsWith('//')) return '/public'
    return r
  })()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await login.mutateAsync({ email, password })
      navigate(redirect, { replace: true })
    } catch (err: any) {
      setError(err.message || 'Invalid credentials')
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
            Where Every Stay Feels Like <span className="text-gold">Home</span>
          </h2>
          <div className="gold-line-left mt-6" />
        </div>
      </div>

      {/* Right Panel — Form + Footer */}
      <div className="flex-1 flex flex-col bg-canvas h-screen">
        <div className="flex-1 flex items-center justify-center px-12 py-12 overflow-y-auto">
          <div className="w-full max-w-xl animate-fade-in px-8">
            {/* Mobile logo */}
            <div className="text-center mb-10 lg:hidden">
              <Link to="/public" className="text-xl font-bold text-gold tracking-wider">{hotelName}</Link>
            </div>

            <div className="bg-surface/80 backdrop-blur-md border border-slate-700/60 rounded-3xl p-8 shadow-2xl border-t-2 border-t-gold/50">
              <h1 className="text-2xl font-bold text-white text-center mb-2">Welcome Back</h1>
              <p className="text-slate-400 text-sm text-center mb-6">Sign in to manage your reservations</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div role="alert" className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>
                )}
                <div>
                  <label htmlFor="login_email" className="text-xs font-semibold uppercase tracking-wider text-gold-highlight block mb-2">Email</label>
                  <input id="login_email" name="email" aria-label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-canvas/90 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none transition-colors w-full" placeholder="you@email.com" />
                </div>
                <div>
                  <label htmlFor="login_password" className="text-xs font-semibold uppercase tracking-wider text-gold-highlight block mb-2">Password</label>
                  <div className="relative">
                    <input id="login_password" name="password" aria-label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-canvas/90 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 pr-10 text-sm focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none transition-colors w-full" placeholder="Enter your password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={login.isPending}
                  className="bg-gold hover:bg-gold-dark text-slate-950 font-bold py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-lg shadow-gold/10 w-full flex items-center justify-center gap-2 transition-all"
                >
                  {login.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Sign In
                </button>
              </form>

              <div className="mt-3 text-center">
                <Link to="/public/forgot-password" className="text-xs text-slate-400 hover:text-gold transition-colors">
                  Forgot password?
                </Link>
              </div>

              <div className="mt-6 text-center text-sm text-slate-400">
                Don&apos;t have an account?{' '}
                <Link to="/public/register" className="text-gold font-medium hover:underline">Create one</Link>
              </div>

              <p className="text-center text-[11px] text-slate-500/50 mt-6">
                <Link to="/public" className="hover:text-gold transition-colors">&larr; Back to hotel website</Link>
              </p>
            </div>
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
