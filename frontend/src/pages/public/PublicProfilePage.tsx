import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  usePublicMe, usePublicUpdateProfile, usePublicDeleteAccount, usePublicReservations,
} from '@/hooks/usePublicApi'
import { usePublicAuthStore } from '@/stores/publicAuthStore'
import { publicApi } from '@/lib/publicApi'
import { formatDateDisplay, toLocalDateStr } from '@/lib/format'
import { DatePicker } from '@/components/ui/date-picker'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useToast } from '@/components/ui/toast'
import {
  User, Mail, Phone, MapPin, Cake, Globe2, Trash2, LogOut,
  CheckCircle, AlertCircle, Loader2, CalendarDays, ChevronRight, HelpCircle, Lock,
} from 'lucide-react'

type FormState = {
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string
  city: string
  country: string
  postal_code: string
  nationality: string
  date_of_birth: string
  gender: string
}

const EMPTY_FORM: FormState = {
  first_name: '', last_name: '', email: '', phone: '',
  address: '', city: '', country: '', postal_code: '',
  nationality: '', date_of_birth: '', gender: '',
}

function initialsOf(first: string, last: string): string {
  const a = (first || '').trim().charAt(0).toUpperCase()
  const b = (last || '').trim().charAt(0).toUpperCase()
  return (a + b) || 'G'
}

function arraysEqual(a: string, b: string): boolean {
  return (a || '') === (b || '')
}

function isFormEqual(a: FormState, b: FormState): boolean {
  return (
    arraysEqual(a.first_name, b.first_name) &&
    arraysEqual(a.last_name, b.last_name) &&
    arraysEqual(a.email, b.email) &&
    arraysEqual(a.phone, b.phone) &&
    arraysEqual(a.address, b.address) &&
    arraysEqual(a.city, b.city) &&
    arraysEqual(a.country, b.country) &&
    arraysEqual(a.postal_code, b.postal_code) &&
    arraysEqual(a.nationality, b.nationality) &&
    arraysEqual(a.date_of_birth, b.date_of_birth) &&
    arraysEqual(a.gender, b.gender)
  )
}

export default function PublicProfilePage() {
  const navigate = useNavigate()
  const { token, logout } = usePublicAuthStore()
  const { addToast } = useToast()
  const { data: user, isLoading } = usePublicMe()
  const { data: reservationsData } = usePublicReservations()
  const updateProfile = usePublicUpdateProfile()
  const deleteAccount = usePublicDeleteAccount()

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [savedSnapshot, setSavedSnapshot] = useState<FormState>(EMPTY_FORM)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const initialised = useRef(false)

  useEffect(() => {
    if (user && !initialised.current) {
      const next: FormState = {
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        city: user.city || '',
        country: user.country || '',
        postal_code: user.postal_code || '',
        nationality: user.nationality || '',
        date_of_birth: user.date_of_birth || '',
        gender: user.gender || '',
      }
      setForm(next)
      setSavedSnapshot(next)
      initialised.current = true
    }
  }, [user])

  const isDirty = useMemo(() => !isFormEqual(form, savedSnapshot), [form, savedSnapshot])

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  useEffect(() => {
    if (updateProfile.isError) {
      const err: any = updateProfile.error
      const msg = err?.response?.data?.message || err?.message || 'Failed to update profile.'
      setErrorMessage(msg)
    }
  }, [updateProfile.isError, updateProfile.error])

  const reservations = reservationsData?.data ?? []
  const upcomingCount = useMemo(() => {
    const today = toLocalDateStr(new Date())
    return reservations.filter(
      (r) => r.status !== 'cancelled' && r.status !== 'checked_out' && r.status !== 'no_show' && r.check_out >= today,
    ).length
  }, [reservations])

  if (!token) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/30 mb-6 text-lg font-light">Please sign in to view your profile.</p>
          <Link to="/public/login" className="btn-gold inline-block">Sign In</Link>
        </div>
      </div>
    )
  }

  function update(field: keyof FormState, value: string) {
    setErrorMessage(null)
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleReset() {
    setForm(savedSnapshot)
    setErrorMessage(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)
    try {
      await updateProfile.mutateAsync(form)
      setSavedSnapshot(form)
      setLastSavedAt(new Date())
      addToast('Profile updated successfully', 'success')
    } catch {
      // error rendered inline via useEffect
    }
  }

  async function handleDelete() {
    try {
      await deleteAccount.mutateAsync()
      setShowDeleteModal(false)
      addToast('Account deleted', 'success')
      navigate('/public')
    } catch {
      // handled by react-query
    }
  }

  function handleLogout() {
    publicApi.post('/public/logout').catch(() => {})
    logout()
    navigate('/public')
  }

  const fullName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Guest'
  const initials = initialsOf(user?.first_name ?? '', user?.last_name ?? '')
  const memberSince = user?.created_at ? formatDateDisplay(user.created_at) : '—'

  return (
    <div className="min-h-screen bg-dark">
      {/* Hero */}
      <section className="relative bg-dark overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gold/5 to-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 py-12 sm:py-16">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-gradient-to-br from-gold to-gold-light text-dark flex items-center justify-center font-serif text-2xl sm:text-3xl font-light shadow-lg shadow-gold/20 shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-gold/60 font-medium">My Account</p>
                <h1 className="font-serif text-white text-2xl sm:text-3xl font-light mt-1 truncate">{fullName}</h1>
                <p className="text-white/40 text-sm mt-1 truncate">{user?.email}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-gold/80 bg-gold/10 border border-gold/20 rounded-full px-2.5 py-1">
                    <User className="h-3 w-3" />
                    Guest
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-white/40 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">
                    <CalendarDays className="h-3 w-3" />
                    Member since {memberSince}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="self-start sm:self-center inline-flex items-center gap-2 px-5 py-2.5 border border-gold/30 text-gold text-xs font-semibold uppercase tracking-wider rounded hover:bg-gold hover:text-dark transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
          <div className="gold-line-left mt-8" />
        </div>
      </section>

      {/* Body */}
      <section className="bg-cream py-12 px-4">
        <div className="max-w-5xl mx-auto space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Quick stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Link
                  to="/public/my-reservations"
                  className="group bg-white border border-white/90 rounded-2xl p-5 shadow-sm hover:border-gold/30 hover:shadow-xl transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.15em] text-dark/40 font-medium">My Bookings</p>
                      <p className="font-serif text-dark text-3xl font-light mt-1">{reservations.length}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-gold/10 flex items-center justify-center text-gold">
                      <CalendarDays className="h-4.5 w-4.5" />
                    </div>
                  </div>
                  <p className="text-xs text-dark/40 mt-3 flex items-center gap-1 group-hover:text-gold transition-colors">
                    {upcomingCount} upcoming
                    <ChevronRight className="h-3 w-3" />
                  </p>
                </Link>
                <Link
                  to="/public/rooms"
                  className="group bg-white border border-white/90 rounded-2xl p-5 shadow-sm hover:border-gold/30 hover:shadow-xl transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.15em] text-dark/40 font-medium">Browse</p>
                      <p className="font-serif text-dark text-base font-light mt-1">Our Rooms</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-gold/10 flex items-center justify-center text-gold">
                      <Globe2 className="h-4.5 w-4.5" />
                    </div>
                  </div>
                  <p className="text-xs text-dark/40 mt-3 flex items-center gap-1 group-hover:text-gold transition-colors">
                    Plan your next stay
                    <ChevronRight className="h-3 w-3" />
                  </p>
                </Link>
                <a
                  href="mailto:info@pampangahomesuites.com"
                  className="group bg-white border border-white/90 rounded-2xl p-5 shadow-sm hover:border-gold/30 hover:shadow-xl transition-all col-span-2 sm:col-span-1"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.15em] text-dark/40 font-medium">Need Help?</p>
                      <p className="font-serif text-dark text-base font-light mt-1">Contact Us</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-gold/10 flex items-center justify-center text-gold">
                      <HelpCircle className="h-4.5 w-4.5" />
                    </div>
                  </div>
                  <p className="text-xs text-dark/40 mt-3 flex items-center gap-1 group-hover:text-gold transition-colors">
                    We typically respond in 24h
                    <ChevronRight className="h-3 w-3" />
                  </p>
                </a>
              </div>

              {/* Inline error */}
              {errorMessage && (
                <div className="flex items-center gap-2 bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-xl">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Account Information */}
                <Card
                  icon={User}
                  title="Account Information"
                  description="Your name and primary email on file."
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field
                      id="profile_first_name"
                      label="First Name"
                      value={form.first_name}
                      onChange={(v) => update('first_name', v)}
                    />
                    <Field
                      id="profile_last_name"
                      label="Last Name"
                      value={form.last_name}
                      onChange={(v) => update('last_name', v)}
                    />
                  </div>
                  <Field
                    id="profile_email"
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={(v) => update('email', v)}
                    icon={Mail}
                  />
                </Card>

                {/* Contact */}
                <Card
                  icon={Phone}
                  title="Contact"
                  description="How our front desk can reach you."
                >
                  <Field
                    id="profile_phone"
                    label="Phone"
                    type="tel"
                    value={form.phone}
                    onChange={(v) => update('phone', v)}
                    icon={Phone}
                  />
                </Card>

                {/* Address */}
                <Card
                  icon={MapPin}
                  title="Address"
                  description="Where you live (used for billing and records)."
                >
                  <Field
                    id="profile_address"
                    label="Street Address"
                    value={form.address}
                    onChange={(v) => update('address', v)}
                    icon={MapPin}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Field
                      id="profile_city"
                      label="City"
                      value={form.city}
                      onChange={(v) => update('city', v)}
                    />
                    <Field
                      id="profile_country"
                      label="Country"
                      value={form.country}
                      onChange={(v) => update('country', v)}
                    />
                    <Field
                      id="profile_postal"
                      label="Postal Code"
                      value={form.postal_code}
                      onChange={(v) => update('postal_code', v)}
                    />
                  </div>
                </Card>

                {/* Personal */}
                <Card
                  icon={Cake}
                  title="Personal Details"
                  description="Optional information that helps us personalise your stay."
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="profile_dob" className="text-xs text-dark/40 uppercase tracking-[0.15em] block mb-1.5 font-medium">Date of Birth</label>
                      <DatePicker
                        value={form.date_of_birth}
                        onChange={(v) => update('date_of_birth', v)}
                        max={toLocalDateStr(new Date())}
                        portal
                      />
                    </div>
                    <SelectField
                      id="profile_gender"
                      label="Gender"
                      value={form.gender}
                      onChange={(v) => update('gender', v)}
                      options={[
                        { value: 'male', label: 'Male' },
                        { value: 'female', label: 'Female' },
                        { value: 'other', label: 'Other' },
                      ]}
                      placeholder="Select"
                    />
                    <Field
                      id="profile_nationality"
                      label="Nationality"
                      value={form.nationality}
                      onChange={(v) => update('nationality', v)}
                      icon={Globe2}
                    />
                  </div>
                </Card>

                {/* Sticky action bar */}
                <div className={`sticky bottom-4 z-10 bg-white border ${isDirty ? 'border-gold/30 shadow-xl shadow-gold/10' : 'border-white/90 shadow-sm'} rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-all`}>
                  <div className="flex items-center gap-2.5 min-h-[28px]">
                    {isDirty ? (
                      <>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-gold" />
                        </span>
                        <p className="text-sm text-dark">You have unsaved changes</p>
                      </>
                    ) : lastSavedAt ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                        <p className="text-sm text-dark/50">Saved · just now</p>
                      </>
                    ) : (
                      <p className="text-sm text-dark/30">No changes yet</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={!isDirty || updateProfile.isPending}
                      className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-dark/50 hover:text-dark border border-dark/10 rounded hover:border-dark/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Reset
                    </button>
                    <button
                      type="submit"
                      disabled={!isDirty || updateProfile.isPending}
                      className="btn-gold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gold"
                    >
                      {updateProfile.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* Danger zone */}
              <div className="mt-10">
                <div className="bg-white border border-danger/20 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="h-11 w-11 rounded-full bg-danger/10 text-danger flex items-center justify-center shrink-0">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif text-lg text-dark font-light">Delete Account</h3>
                      <p className="text-sm text-dark/50 mt-1 leading-relaxed">
                        Permanently delete your account and all associated data. Active reservations will block this action. This cannot be undone.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowDeleteModal(true)}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-danger border border-danger/30 rounded hover:bg-danger hover:text-white transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Account
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <ConfirmDialog
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Account"
        message="Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed."
        confirmLabel={deleteAccount.isPending ? 'Deleting...' : 'Delete Account'}
        confirmVariant="danger"
        isLoading={deleteAccount.isPending}
      />
    </div>
  )
}

/* ----- Internal helper components ----- */

function Card({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-white/90 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4 mb-5">
        <div className="h-10 w-10 rounded-full bg-gold/10 text-gold flex items-center justify-center shrink-0">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-lg text-dark font-light">{title}</h2>
          <p className="text-xs text-dark/40 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  icon: Icon,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-dark/40 uppercase tracking-[0.15em] block mb-1.5 font-medium">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark/30 pointer-events-none" />
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`input-light ${Icon ? 'pl-10' : ''}`}
        />
      </div>
    </div>
  )
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-dark/40 uppercase tracking-[0.15em] block mb-1.5 font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="select-light"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}
