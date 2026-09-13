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

  const redirect = searchParams.get('redirect') || '/public'

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
        <div className="absolute inset-0 bg-gradient-to-r from-dark/90 via-dark/15 to-dark" />
        <div className="relative z-10 px-10 max-w-lg">
          <Link to="/public" className="font-serif text-gold text-3xl font-light tracking-wider">{hotelName}</Link>
          <h2 className="font-serif text-white text-4xl font-light mt-6 leading-tight">
            Where Every Stay Feels Like <span className="text-gold">Home</span>
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

            <div>
              <h1 className="font-serif text-white text-3xl font-light mb-2">Welcome Back</h1>
              <p className="text-white/50 text-sm">Sign in to manage your reservations</p>
              <div className="gold-line-left mt-4" />
            </div>

            <form onSubmit={handleSubmit} className="mt-10 space-y-5">
              {error && (
                <div role="alert" className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>
              )}
              <div>
                <label htmlFor="login_email" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Email</label>
                <input id="login_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-public" placeholder="you@email.com" />
              </div>
              <div>
                <label htmlFor="login_password" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Password</label>
                <div className="relative">
                  <input id="login_password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required className="input-public pr-10" placeholder="Enter your password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={login.isPending}
                className="btn-gold w-full flex items-center justify-center gap-2"
              >
                {login.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign In
              </button>
            </form>

            <div className="mt-3 text-center">
              <Link to="/public/forgot-password" className="text-xs text-white/30 hover:text-gold transition-colors">
                Forgot password?
              </Link>
            </div>

            <div className="mt-8 text-center text-sm text-white/30">
              Don&apos;t have an account?{' '}
              <Link to="/public/register" className="text-gold font-medium hover:underline">Create one</Link>
            </div>

            <p className="text-center text-[11px] text-white/15 mt-8">
              <Link to="/public" className="hover:text-gold transition-colors">&larr; Back to hotel website</Link>
            </p>
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
