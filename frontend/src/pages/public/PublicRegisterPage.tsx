import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePublicRegister, useHotelName } from '@/hooks/usePublicApi'
import { Loader2 } from 'lucide-react'
import { isValidPHPhone, stripPhoneInput } from '@/lib/phone'

export default function PublicRegisterPage() {
  const navigate = useNavigate()
  const hotelName = useHotelName()
  const register = usePublicRegister()
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    gender: '', password: '', password_confirmation: '',
  })
  const [error, setError] = useState('')

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
    try {
      await register.mutateAsync(form as any)
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
        <div className="absolute inset-0 bg-gradient-to-r from-dark/90 via-dark/15 to-dark" />
        <div className="relative z-10 px-10 max-w-lg">
          <Link to="/public" className="font-serif text-gold text-3xl font-light tracking-wider">{hotelName}</Link>
          <h2 className="font-serif text-white text-4xl font-light mt-6 leading-tight">
            Your Comfortable Stay Starts <span className="text-gold">Here</span>
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
              <h1 className="font-serif text-white text-3xl font-light mb-2">Create Account</h1>
              <p className="text-white/50 text-sm">Join us to start booking your comfortable stay</p>
              <div className="gold-line-left mt-4" />
            </div>

            <form onSubmit={handleSubmit} className="mt-10 space-y-5">
              {error && (
                <div role="alert" className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg">{error}</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg_first_name" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">First Name</label>
                  <input id="reg_first_name" type="text" value={form.first_name} onChange={(e) => update('first_name', e.target.value)} required className="input-public" />
                </div>
                <div>
                  <label htmlFor="reg_last_name" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Last Name</label>
                  <input id="reg_last_name" type="text" value={form.last_name} onChange={(e) => update('last_name', e.target.value)} required className="input-public" />
                </div>
              </div>
              <div>
                <label htmlFor="reg_email" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Email</label>
                <input id="reg_email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required className="input-public" placeholder="you@email.com" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg_phone" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Phone</label>
                  <input id="reg_phone" type="tel" value={form.phone} onChange={(e) => update('phone', stripPhoneInput(e.target.value))} required className="input-public" placeholder="09171234567" maxLength={15} pattern="(\+63\s?|0)\d{8,13}" />
                </div>
                <div>
                  <label htmlFor="reg_gender" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Gender <span className="text-white/15">(optional)</span></label>
                  <select id="reg_gender" value={form.gender} onChange={(e) => update('gender', e.target.value)} className="select-public">
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="reg_password" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Password</label>
                <input id="reg_password" type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required minLength={8} className="input-public" />
              </div>
              <div>
                <label htmlFor="reg_password_confirm" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Confirm Password</label>
                <input id="reg_password_confirm" type="password" value={form.password_confirmation} onChange={(e) => update('password_confirmation', e.target.value)} required className="input-public" />
              </div>
              <button
                type="submit"
                disabled={register.isPending}
                className="btn-gold w-full flex items-center justify-center gap-2 mt-6"
              >
                {register.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Account
              </button>
            </form>

            <div className="mt-8 text-center text-sm text-white/30">
              Already have an account?{' '}
              <Link to="/public/login" className="text-gold font-medium hover:underline">Sign in</Link>
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
