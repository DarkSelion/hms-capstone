import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useVerifyEmail, useHotelName } from '@/hooks/usePublicApi'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

export default function PublicVerifyEmailPage() {
  const hotelName = useHotelName()
  const [searchParams] = useSearchParams()
  const verifyEmail = useVerifyEmail()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    const email = searchParams.get('email')

    if (!token || !email) {
      setStatus('error')
      setMessage('Invalid verification link. Please request a new one.')
      return
    }

    verifyEmail.mutate(
      { token, email },
      {
        onSuccess: (res) => {
          setStatus('success')
          setMessage(res.message || 'Email verified successfully!')
        },
        onError: (err) => {
          setStatus('error')
          setMessage(err.message || 'Invalid or expired verification link.')
        },
      }
    )
  }, [searchParams])

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
          <div className="gold-line-left mt-6" />
        </div>
      </div>

      {/* Right Panel — Status */}
      <div className="flex-1 flex flex-col bg-dark min-h-screen">
        <div className="flex-1 flex items-center justify-center px-12 py-12">
          <div className="w-full max-w-md animate-fade-in px-8 text-center">
            {/* Mobile logo */}
            <div className="text-center mb-10 lg:hidden">
              <Link to="/public" className="font-serif text-gold text-2xl font-light tracking-wider">{hotelName}</Link>
            </div>

            {status === 'loading' && (
              <>
                <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-6">
                  <Loader2 className="h-8 w-8 text-gold animate-spin" />
                </div>
                <h1 className="font-serif text-white text-3xl font-light mb-3">Verifying your email</h1>
                <p className="text-white/50 text-sm">Please wait while we verify your email address...</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-8 w-8 text-emerald-400" />
                </div>
                <h1 className="font-serif text-white text-3xl font-light mb-3">Email Verified!</h1>
                <p className="text-white/50 text-sm mb-8">{message}</p>
                <Link to="/public/rooms" className="btn-gold inline-block">
                  Start Booking
                </Link>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-6">
                  <XCircle className="h-8 w-8 text-danger" />
                </div>
                <h1 className="font-serif text-white text-3xl font-light mb-3">Verification Failed</h1>
                <p className="text-white/50 text-sm mb-8">{message}</p>
                <Link to="/public/login" className="btn-gold inline-block">
                  Sign In
                </Link>
              </>
            )}

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
