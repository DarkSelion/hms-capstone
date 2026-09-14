import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, Eye, EyeOff, Hotel, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLogin } from '@/hooks/useApi'
import { useAuthStore } from '@/stores/authStore'
import { useHotelName } from '@/hooks/usePublicApi'

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  remember: z.boolean().optional(),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const setPendingOtp = useAuthStore((s) => s.setPendingOtp)
  const loginMutation = useLogin()
  const [showPassword, setShowPassword] = useState(false)
  const [deviceHash, setDeviceHash] = useState('')
  const hotelName = useHotelName()

  useEffect(() => {
    const ua = navigator.userAgent
    const lang = navigator.language
    const screenRes = `${screen.width}x${screen.height}`
    const data = `${ua}|${lang}|${screenRes}`
    const encoder = new TextEncoder()
    crypto.subtle.digest('SHA-256', encoder.encode(data)).then((buf) => {
      setDeviceHash(Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''))
    })
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(
      { email: data.email, password: data.password, device_hash: deviceHash || undefined },
      {
        onSuccess: (response: any) => {
          // Feature 1: Check if OTP verification is required
          if (response.requires_otp) {
            setPendingOtp(response.temp_token)
            navigate('/admin/verify-otp')
            return
          }

          const { token, user } = response
          const rawRole = (user as { role?: unknown }).role
          const roleSlug = typeof rawRole === 'object' && rawRole
            ? (rawRole as { slug?: string }).slug ?? ''
            : typeof rawRole === 'string' ? rawRole : ''
          setAuth(token, { ...user, role: roleSlug } as any)
          navigate('/admin/dashboard')
        },
      },
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding */}
      <div className="relative hidden flex-1 items-center justify-center bg-gradient-to-br from-primary via-primary-dark to-primary p-12 lg:flex">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full border border-white/10" />
          <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full border border-white/5" />
          <div className="absolute left-1/2 top-1/3 h-px w-64 -translate-x-1/2 bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
        </div>
        <div className="relative text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/20 ring-1 ring-gold/30">
            <Hotel className="h-8 w-8 text-gold" />
          </div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight text-white">
            {hotelName}
          </h1>
          <p className="text-lg text-white/80">
            Admin Dashboard
          </p>
          <div className="mt-8 flex items-center justify-center gap-2 text-gold/60">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm">Hotel Management System</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex flex-1 items-center justify-center bg-bg p-4">
        <div className="w-full max-w-md animate-[fadeIn_0.6s_ease-out]">
          {/* Mobile header */}
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Hotel className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-primary">
              {hotelName}
            </h1>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
            <div className="mb-6 animate-[fadeIn_0.5s_ease-out_0.05s_forwards] opacity-0">
              <h2 className="text-xl font-semibold text-foreground">
                Welcome back
              </h2>
              <p className="mt-1 text-sm text-muted">
                Sign in to your account
              </p>
            </div>

            {loginMutation.error && (
              <div className="mb-4 animate-[fadeIn_0.3s_ease-out] rounded-lg bg-danger/10 p-3 text-sm text-danger">
                {loginMutation.error.message || 'Invalid credentials. Please try again.'}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="animate-[fadeIn_0.5s_ease-out_0.1s_forwards] opacity-0">
                <Input
                  label="Email"
                  type="email"
                  placeholder="Enter your email"
                  icon={<Mail className="h-4 w-4" />}
                  error={errors.email?.message}
                  {...register('email')}
                />
              </div>

              <div className="animate-[fadeIn_0.5s_ease-out_0.2s_forwards] opacity-0">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">
                    Password
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      className={`flex h-10 w-full rounded-lg border bg-card px-3 py-2 pl-10 pr-10 text-sm ring-offset-card placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:border-primary ${
                        errors.password
                          ? 'border-danger focus-visible:ring-danger/50'
                          : 'border-border focus-visible:ring-primary/50'
                      }`}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.password?.message && (
                    <p className="text-xs text-danger">
                      {errors.password.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="animate-[fadeIn_0.5s_ease-out_0.3s_forwards] opacity-0">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/50"
                    {...register('remember')}
                  />
                  <span className="text-sm text-muted">Remember me</span>
                </label>
              </div>

              <div className="animate-[fadeIn_0.5s_ease-out_0.4s_forwards] opacity-0">
                <Button
                  type="submit"
                  disabled={loginMutation.isPending}
                  size="lg"
                  className="w-full bg-gradient-to-r from-gold to-gold-light text-white hover:from-gold-dark hover:to-gold"
                >
                  {loginMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Signing in...
                    </span>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-6 flex flex-col items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-muted">
              <span>Are you a guest?</span>
              <a href="/public" className="text-gold font-medium hover:underline">Visit Guest Portal &rarr;</a>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
