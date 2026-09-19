import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePublicRegister, useHotelName } from '@/hooks/usePublicApi'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { isValidPHPhone, stripPhoneInput } from '@/lib/phone'

const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
  'aol.com', 'protonmail.com', 'zoho.com', 'mail.com', 'live.com',
  'msn.com', 'ymail.com', 'rocketmail.com', 'gmail.com.ph',
]

function isValidEmailDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  return ALLOWED_EMAIL_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))
}

export default function PublicRegisterPage() {
  const navigate = useNavigate()
  const hotelName = useHotelName()
  const register = usePublicRegister()
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    gender: '', password: '', password_confirmation: '',
  })
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.password_confirmation) {
      setError('Passwords do not match')
      return
    }
    if (!isValidPHPhone(form.phone)) {
      setError('Enter a valid Philippine phone number (e.g. 09171234567 or +63 9171234567)')
      return
    }
    if (!isValidEmailDomain(form.email)) {
      setError('Please use a valid email address (Gmail, Yahoo, Outlook, etc.)')
      return
    }
    try {
      const phone = form.phone.startsWith('+63') || form.phone.startsWith('0')
        ? form.phone.replace(/\s/g, '')
        : '+63' + form.phone.replace(/\s/g, '')
      await register.mutateAsync({ ...form, phone } as any)
      navigate('/public', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Hotel Image */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&h=900&fit=crop"
          alt={hotelName}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-canvas/60 to-canvas" />
        <div className="relative z-10 px-10 max-w-lg">
          <Link to="/public" className="text-xl font-bold text-gold tracking-wider">{hotelName}</Link>
          <h2 className="text-3xl font-bold text-white mt-6 leading-tight">
            Your Comfortable Stay Starts <span className="text-gold">Here</span>
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

            <div className="bg-surface/80 backdrop-blur-md border border-slate-700/60 rounded-3xl p-6 shadow-2xl border-t-2 border-t-gold/50">
              <h1 className="text-2xl font-bold text-white text-center mb-2">Create Account</h1>
              <p className="text-slate-400 text-sm text-center mb-4">Join us to start booking your comfortable stay</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div role="alert" className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg_first_name" className="text-xs font-semibold uppercase tracking-wider text-gold-highlight block mb-2">First Name</label>
                    <input id="reg_first_name" type="text" value={form.first_name} onChange={(e) => update('first_name', e.target.value)} required className="bg-canvas/90 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none transition-colors w-full" />
                  </div>
                  <div>
                    <label htmlFor="reg_last_name" className="text-xs font-semibold uppercase tracking-wider text-gold-highlight block mb-2">Last Name</label>
                    <input id="reg_last_name" type="text" value={form.last_name} onChange={(e) => update('last_name', e.target.value)} required className="bg-canvas/90 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none transition-colors w-full" />
                  </div>
                </div>
                <div>
                  <label htmlFor="reg_email" className="text-xs font-semibold uppercase tracking-wider text-gold-highlight block mb-2">Email</label>
                  <input id="reg_email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required className="bg-canvas/90 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none transition-colors w-full" placeholder="you@email.com" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg_phone" className="text-xs font-semibold uppercase tracking-wider text-gold-highlight block mb-2">Phone Number</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-500 text-sm border-r border-slate-700 pr-2.5">
                        <span className="text-xs">🇵🇭</span> +63
                      </span>
                      <input
                        id="reg_phone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => update('phone', stripPhoneInput(e.target.value))}
                        required
                        className="bg-canvas/90 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 pl-[4.2rem] text-sm focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none transition-colors w-full"
                        placeholder="09171234567"
                        maxLength={11}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500/50 mt-1.5">Format: 09XXXXXXXXX (11 digits)</p>
                  </div>
                  <div>
                    <label htmlFor="reg_gender" className="text-xs font-semibold uppercase tracking-wider text-gold-highlight block mb-2">Gender <span className="text-slate-500/50">(optional)</span></label>
                    <select id="reg_gender" value={form.gender} onChange={(e) => update('gender', e.target.value)} className="bg-canvas/90 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none transition-colors w-full appearance-none cursor-pointer">
                      <option value="">Prefer not to say</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="reg_password" className="text-xs font-semibold uppercase tracking-wider text-gold-highlight block mb-2">Password</label>
                  <div className="relative">
                    <input id="reg_password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => update('password', e.target.value)} required minLength={8} className="bg-canvas/90 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 pr-10 text-sm focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none transition-colors w-full" placeholder="Enter your password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    {[
                      { label: 'Uppercase', ok: /[A-Z]/.test(form.password) },
                      { label: 'Lowercase', ok: /[a-z]/.test(form.password) },
                      { label: 'Number', ok: /\d/.test(form.password) },
                      { label: '8+ chars', ok: form.password.length >= 8 },
                    ].map((r) => (
                      <span key={r.label} className={`text-[10px] tracking-wide transition-colors ${r.ok ? 'text-gold' : 'text-slate-500/40'}`}>
                        {r.ok ? '✓' : '○'} {r.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="reg_password_confirm" className="text-xs font-semibold uppercase tracking-wider text-gold-highlight block mb-2">Confirm Password</label>
                  <div className="relative">
                    <input id="reg_password_confirm" type={showConfirmPassword ? 'text' : 'password'} value={form.password_confirmation} onChange={(e) => update('password_confirmation', e.target.value)} required className="bg-canvas/90 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 pr-10 text-sm focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none transition-colors w-full" placeholder="Re-enter your password" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={register.isPending}
                  className="bg-gold hover:bg-gold-dark text-slate-950 font-bold py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-lg shadow-gold/10 w-full flex items-center justify-center gap-2 mt-4 transition-all"
                >
                  {register.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Account
                </button>
              </form>

              <div className="mt-4 text-center text-sm text-slate-400">
                Already have an account?{' '}
                <Link to="/public/login" className="text-gold font-medium hover:underline">Sign in</Link>
              </div>

              <p className="text-center text-xs text-slate-500/50 mt-4">
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
