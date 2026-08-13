import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePublicMe, usePublicUpdateProfile, usePublicDeleteAccount } from '@/hooks/usePublicApi'
import { usePublicAuthStore } from '@/stores/publicAuthStore'
import { publicApi } from '@/lib/publicApi'
import { toLocalDateStr } from '@/lib/format'
import { DatePicker } from '@/components/ui/date-picker'
import { Loader2, User, Trash2, CheckCircle, X } from 'lucide-react'

export default function PublicProfilePage() {
  const navigate = useNavigate()
  const { token, logout } = usePublicAuthStore()
  const { data: user, isLoading } = usePublicMe()
  const updateProfile = usePublicUpdateProfile()
  const deleteAccount = usePublicDeleteAccount()

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    address: '', city: '', country: '', nationality: '',
    date_of_birth: '', gender: '', postal_code: '',
  })

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        city: user.city || '',
        country: user.country || '',
        nationality: user.nationality || '',
        date_of_birth: user.date_of_birth || '',
        gender: user.gender || '',
        postal_code: user.postal_code || '',
      })
    }
  }, [user])

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

  async function handleDelete() {
    try {
      await deleteAccount.mutateAsync()
      navigate('/public')
    } catch {
      // handled by react-query
    }
  }

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSuccess('')
    try {
      await updateProfile.mutateAsync(form)
      setSuccess('Profile updated successfully.')
      setTimeout(() => setSuccess(''), 3000)
    } catch {
      // handled by react-query
    }
  }

  function handleLogout() {
    publicApi.post('/public/logout').catch(() => {})
    logout()
    navigate('/public')
  }

  return (
    <div className="min-h-screen bg-dark">
      {/* Header */}
      <section className="bg-dark border-b border-white/5 py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-dark border-2 border-gold/30 flex items-center justify-center mx-auto mb-4">
            <User className="h-7 w-7 text-gold" />
          </div>
          <p className="section-subtitle mb-1">My Account</p>
          <h1 className="font-serif text-white text-3xl font-light">
            {user?.first_name} {user?.last_name}
          </h1>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 py-12">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
          </div>
        ) : (
          <div className="bg-neutral-600 border border-gold/10 rounded-2xl p-8">
            {success && (
              <div className="mb-6 flex items-center gap-2 bg-success/10 border border-success/20 text-success text-sm px-4 py-3 rounded-lg">
                <CheckCircle className="h-4 w-4" />
                {success}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="profile_first_name" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">First Name</label>
                  <input id="profile_first_name" type="text" value={form.first_name} onChange={(e) => update('first_name', e.target.value)} className="input-public" />
                </div>
                <div>
                  <label htmlFor="profile_last_name" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Last Name</label>
                  <input id="profile_last_name" type="text" value={form.last_name} onChange={(e) => update('last_name', e.target.value)} className="input-public" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="profile_email" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Email</label>
                  <input id="profile_email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className="input-public" />
                </div>
                <div>
                  <label htmlFor="profile_phone" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Phone</label>
                  <input id="profile_phone" type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} className="input-public" />
                </div>
              </div>
              <div>
                <label htmlFor="profile_address" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Address</label>
                <input id="profile_address" type="text" value={form.address} onChange={(e) => update('address', e.target.value)} className="input-public" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="profile_city" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">City</label>
                  <input id="profile_city" type="text" value={form.city} onChange={(e) => update('city', e.target.value)} className="input-public" />
                </div>
                <div>
                  <label htmlFor="profile_country" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Country</label>
                  <input id="profile_country" type="text" value={form.country} onChange={(e) => update('country', e.target.value)} className="input-public" />
                </div>
                <div>
                  <label htmlFor="profile_nationality" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Nationality</label>
                  <input id="profile_nationality" type="text" value={form.nationality} onChange={(e) => update('nationality', e.target.value)} className="input-public" />
                </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                <p className="text-xs uppercase tracking-[0.15em] text-white/20 block mb-4">Personal Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="profile_dob" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Date of Birth</label>
                    <DatePicker
                      value={form.date_of_birth}
                      onChange={(v) => update('date_of_birth', v)}
                      max={toLocalDateStr(new Date())}
                      portal
                    />
                  </div>
                  <div>
                    <label htmlFor="profile_gender" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Gender</label>
                    <select id="profile_gender" value={form.gender} onChange={(e) => update('gender', e.target.value)} className="input-public">
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="profile_postal" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Postal Code</label>
                    <input id="profile_postal" type="text" value={form.postal_code} onChange={(e) => update('postal_code', e.target.value)} className="input-public" />
                  </div>
                </div>
              </div>



              <div className="flex justify-between items-center pt-4 border-t border-white/5">
                <button type="button" onClick={handleLogout}
                  className="px-8 py-3 border border-danger/20 text-danger/70 rounded text-sm font-semibold uppercase tracking-wider hover:bg-danger/5 hover:border-danger/40 hover:text-danger transition-all">
                  Sign Out
                </button>
                <button type="submit" disabled={updateProfile.isPending}
                  className="btn-gold flex items-center gap-2">
                  {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Delete Account */}
        <div className="mt-8 bg-danger/5 border border-danger/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-1">Delete Account</h3>
          <p className="text-white/40 text-sm mb-4">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <button type="button" onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 text-sm text-danger/70 hover:text-danger transition-colors">
            <Trash2 className="h-4 w-4" />
            Delete Account
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowDeleteModal(false)}
          />
          <div className="relative z-50 w-full max-w-sm bg-dark border border-zinc-800 rounded-2xl shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <h3 className="text-white font-semibold">Delete Account</h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="rounded-lg p-1 text-white/30 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-white/70 text-sm leading-relaxed">
                Are you sure you want to delete your account? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-white/5 px-6 py-4">
              <button type="button" onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={deleteAccount.isPending}
                className="px-4 py-2 text-sm bg-danger text-white rounded-lg hover:bg-danger/80 transition-colors flex items-center gap-2 disabled:opacity-50">
                {deleteAccount.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
