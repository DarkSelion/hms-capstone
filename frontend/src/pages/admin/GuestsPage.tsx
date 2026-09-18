import { useState } from 'react'
import { useGuests, useGuest, useGuestHistory, useCreateGuest, useUpdateGuest, useDeleteGuest } from '@/hooks/useApi'
import type { Guest, Reservation } from '@/types'
import { formatCurrency, formatDateDisplay } from '@/lib/format'
import { isValidPHPhone, stripPhoneInput } from '@/lib/phone'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { RowActions, RowActionButton } from '@/components/shared/RowActions'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { DatePicker } from '@/components/ui/date-picker'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores/authStore'
import { isAdminRole } from '@/lib/permissions'
import {
  Plus, Search, Eye, Edit, Trash2, Phone, Mail,
  Calendar, Bed, Save,
  AlertCircle, UserX, MapPin, X,
} from 'lucide-react'

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

const NATIONALITIES = [
  'American', 'Argentine', 'Australian', 'Austrian', 'Bangladeshi', 'Belgian', 'Brazilian',
  'British', 'Cambodian', 'Canadian', 'Chilean', 'Chinese', 'Colombian', 'Croatian',
  'Cuban', 'Czech', 'Danish', 'Dominican', 'Dutch', 'Egyptian', 'Emirati', 'Estonian',
  'Filipino', 'Finnish', 'French', 'German', 'Ghanaian', 'Greek', 'Hungarian', 'Icelandic',
  'Indian', 'Indonesian', 'Iranian', 'Iraqi', 'Irish', 'Israeli', 'Italian', 'Jamaican',
  'Japanese', 'Jordanian', 'Kenyan', 'Korean', 'Kuwaiti', 'Latvian', 'Lebanese', 'Lithuanian',
  'Malaysian', 'Mexican', 'Moroccan', 'Myanmar', 'New Zealander', 'Nicaraguan', 'Nigerian',
  'Norwegian', 'Omani', 'Pakistani', 'Palestinian', 'Peruvian', 'Polish', 'Portuguese',
  'Qatari', 'Romanian', 'Russian', 'Saudi', 'Singaporean', 'Slovak', 'Slovenian', 'South African',
  'Spanish', 'Sri Lankan', 'Swedish', 'Swiss', 'Syrian', 'Taiwanese', 'Thai', 'Tunisian',
  'Turkish', 'Ukrainian', 'Uruguayan', 'Venezuelan', 'Vietnamese',
]

interface GuestFormData {
  first_name: string
  last_name: string
  email: string
  phone: string
  nationality: string
  date_of_birth: string
  gender: string
  address: string
  city: string
  country: string
  postal_code: string
  is_blacklisted: boolean
  blacklist_reason: string
  notes: string
}

const defaultFormData: GuestFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  nationality: '',
  date_of_birth: '',
  gender: '',
  address: '',
  city: '',
  country: '',
  postal_code: '',
  is_blacklisted: false,
  blacklist_reason: '',
  notes: '',
}

function getCurrentReservation(reservations: Reservation[]): Reservation | null {
  const active = reservations.filter(
    (r) => r.status === 'checked_in' || r.status === 'confirmed',
  )
  if (active.length > 0) return active[0]
  return null
}

function getTotalSpent(reservations: Reservation[]): number {
  return reservations.reduce((sum, r) => sum + Number(r.total_amount || 0), 0)
}

const INPUT_CLASS = 'h-10 px-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white text-slate-800 transition-all'
const SECTION_LABEL = 'text-[11px] font-semibold text-slate-400 tracking-wider uppercase'

function StatusPill({ guest }: { guest: Guest }) {
  if (guest.is_blacklisted) {
    return (
      <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 border border-rose-200/60">
        Blacklisted
      </span>
    )
  }
  const bookingCount = guest.reservations_count ?? 0
  if (bookingCount >= 5) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200/60">
        VIP
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
      Regular
    </span>
  )
}

export default function GuestsPage() {
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [blacklistedOnly, setBlacklistedOnly] = useState(false)

  const role = useAuthStore((s) => s.user?.role ?? '')
  const isAdmin = isAdminRole(role)

  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)
  const [formData, setFormData] = useState<GuestFormData>(defaultFormData)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof GuestFormData, string>>>({})

  const [detailGuestId, setDetailGuestId] = useState<number | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  const params: Record<string, string | number | undefined> = {
    page: currentPage,
    per_page: 10,
    search: search || undefined,
    blacklisted: blacklistedOnly ? '1' : undefined,
  }

  const { data: guestsData, isLoading: guestsLoading, error: guestsError, refetch: refetchGuests } = useGuests(params)
  const { data: guestDetail, isLoading: detailLoading } = useGuest(detailGuestId ?? 0)
  const { data: guestHistory, isLoading: historyLoading } = useGuestHistory(detailGuestId ?? 0)
  const createGuest = useCreateGuest()
  const updateGuest = useUpdateGuest()
  const deleteGuest = useDeleteGuest()
  const { addToast } = useToast()

  const guests = guestsData?.data ?? []
  const paginationInfo = guestsData
    ? { currentPage: guestsData.current_page, lastPage: guestsData.last_page, total: guestsData.total, per_page: guestsData.per_page }
    : null

  const totalGuests = guestsData?.total ?? 0
  const vipCount = guests.filter((g) => !g.is_blacklisted && (g.reservations_count ?? 0) >= 5).length
  const blacklistedCount = guests.filter((g) => g.is_blacklisted).length

  function openAddModal() {
    setSelectedGuest(null)
    setFormData(defaultFormData)
    setFormErrors({})
    setModalMode('add')
  }

  function openEditModal(guest: Guest) {
    setSelectedGuest(guest)
    setFormData({
      first_name: guest.first_name,
      last_name: guest.last_name,
      email: guest.email,
      phone: guest.phone,
      nationality: guest.nationality ?? '',
      date_of_birth: guest.date_of_birth ?? '',
      gender: guest.gender ?? '',
      address: guest.address ?? '',
      city: guest.city ?? '',
      country: guest.country ?? '',
      postal_code: guest.postal_code ?? '',
      is_blacklisted: guest.is_blacklisted ?? false,
      blacklist_reason: guest.blacklist_reason ?? '',
      notes: guest.notes ?? '',
    })
    setFormErrors({})
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setSelectedGuest(null)
  }

  function validateForm(): boolean {
    const errors: Partial<Record<keyof GuestFormData, string>> = {}
    if (!formData.first_name.trim()) errors.first_name = 'First name is required'
    if (!formData.last_name.trim()) errors.last_name = 'Last name is required'
    if (formData.email.trim() && !/^\S+@\S+\.\S+$/.test(formData.email.trim())) errors.email = 'Enter a valid email'
    if (!formData.phone.trim()) errors.phone = 'Phone is required'
    else if (!isValidPHPhone(formData.phone)) errors.phone = 'Enter a valid PH phone (e.g. 09171234567)'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateForm()) return

    const payload = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      phone: formData.phone,
      nationality: formData.nationality || undefined,
      date_of_birth: formData.date_of_birth || undefined,
      gender: formData.gender || undefined,
      address: formData.address || undefined,
      city: formData.city || undefined,
      country: formData.country || undefined,
      postal_code: formData.postal_code || undefined,
      is_blacklisted: formData.is_blacklisted,
      blacklist_reason: formData.is_blacklisted && formData.blacklist_reason.trim() ? formData.blacklist_reason.trim() : null,
      notes: formData.notes || undefined,
    }

    if (modalMode === 'add') {
      createGuest.mutate(payload, {
        onSuccess: () => closeModal(),
      })
    } else if (selectedGuest) {
      updateGuest.mutate({ id: selectedGuest.id, data: payload }, {
        onSuccess: () => closeModal(),
      })
    }
  }

  function handleDelete() {
    if (!deleteConfirmId) return
    deleteGuest.mutate(deleteConfirmId, {
      onSuccess: () => setDeleteConfirmId(null),
      onError: (err) => {
        const message = err instanceof Error ? err.message : 'Failed to delete guest.'
        addToast(message, 'error')
        setDeleteConfirmId(null)
      },
    })
  }

  function updateField<K extends keyof GuestFormData>(key: K, value: GuestFormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }))
    if (formErrors[key]) {
      setFormErrors((prev) => {
        const copy = { ...prev }
        delete copy[key]
        return copy
      })
    }
  }

  const columns: Column<Guest>[] = [
    {
      key: 'guest',
      label: 'Guest',
      className: 'w-[28%]',
      render: (g) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
            {g.first_name[0]}{g.last_name[0]}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-slate-900 truncate">{g.first_name} {g.last_name}</div>
            <div className="text-xs text-slate-500 truncate">{g.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      className: 'w-[18%]',
      render: (g) => (
        <span className="text-sm text-slate-600">{g.phone}</span>
      ),
    },
    {
      key: 'nationality',
      label: 'Nationality',
      className: 'w-[14%]',
      render: (g) => (
        <span className="text-sm text-slate-600">{g.nationality || '—'}</span>
      ),
    },
    {
      key: 'total_bookings',
      label: 'Bookings',
      className: 'w-[12%] text-center',
      render: (g) => (
        <span className="inline-flex items-center justify-center h-6 min-w-[24px] rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-700">
          {g.reservations_count ?? 0}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      className: 'w-[14%]',
      render: (g) => <StatusPill guest={g} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-[14%] text-right',
      render: (g) => (
        <div className="flex justify-end">
          <RowActions>
            <RowActionButton
              tone="neutral"
              title="View"
              icon={<Eye className="h-4 w-4" />}
              onClick={() => setDetailGuestId(g.id)}
            />
            <RowActionButton
              tone="neutral"
              title="Edit"
              icon={<Edit className="h-4 w-4" />}
              onClick={() => openEditModal(g)}
            />
            {isAdmin && (
              <RowActionButton
                tone="danger"
                title="Delete"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setDeleteConfirmId(g.id)}
              />
            )}
          </RowActions>
        </div>
      ),
    },
  ]

  const detailGuest = guestDetail

  const guestHistoryList = guestHistory?.reservations?.data ?? []

  const isMutating = createGuest.isPending || updateGuest.isPending

  return (
    <div>
      <PageHeader
        title="Guests"
        description="Manage hotel guests and their information."
        actions={
          <Button variant="gold" onClick={openAddModal}>
            <Plus className="h-4 w-4" />
            Add Guest
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          {/* ── Row 1: Search + Summary Pills ── */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, email, phone..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                className="w-full h-11 pl-10 pr-4 rounded-lg border border-slate-200 bg-white text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
              />
            </div>

            {/* Summary pills */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                Total: {totalGuests}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-200/60">
                VIP: {vipCount}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 border border-rose-200/60">
                Blacklisted: {blacklistedCount}
              </span>
            </div>

            <button
              onClick={() => { setBlacklistedOnly(!blacklistedOnly); setCurrentPage(1) }}
              className={`flex items-center gap-1.5 h-11 rounded-lg border px-3.5 text-xs font-medium transition-colors ${
                blacklistedOnly
                  ? 'border-rose-300 bg-rose-50 text-rose-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-rose-300 hover:text-rose-600'
              }`}
            >
              <UserX className="h-3.5 w-3.5" />
              Blacklisted
            </button>
          </div>

          <DataTable
            columns={columns}
            data={guests}
            loading={guestsLoading}
            error={guestsError ? (guestsError as Error).message : null}
            onSearch={undefined}
            onRetry={() => refetchGuests()}
            keyExtractor={(g) => g.id}
            tableClassName="table-fixed border-collapse"
            pagination={paginationInfo ? {
              currentPage: paginationInfo.currentPage,
              lastPage: paginationInfo.lastPage,
              total: paginationInfo.total,
              from: paginationInfo.total ? (paginationInfo.currentPage - 1) * paginationInfo.per_page + 1 : 0,
              to: paginationInfo.total ? Math.min(paginationInfo.currentPage * paginationInfo.per_page, paginationInfo.total) : 0,
              onPageChange: setCurrentPage,
            } : undefined}
          />
        </CardContent>
      </Card>

      {/* ── Add / Edit Modal ── */}
      <Modal
        isOpen={modalMode !== null}
        onClose={closeModal}
        title={modalMode === 'add' ? 'Add Guest' : 'Edit Guest'}
        size="xl"
        footer={
          <div className="border-t border-slate-100 pt-4 mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              disabled={isMutating}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="guest-form"
              disabled={isMutating}
              className="px-5 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isMutating ? 'Saving...' : <><Save className="h-4 w-4" /> Save</>}
            </button>
          </div>
        }
      >
        <form id="guest-form" onSubmit={handleSubmit} className="space-y-6">
          {/* ── Section 1: Personal Information ── */}
          <div>
            <p className={`${SECTION_LABEL} mb-3`}>Personal Information</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">First Name</label>
                <input
                  type="text"
                  placeholder="John"
                  value={formData.first_name}
                  onChange={(e) => updateField('first_name', e.target.value)}
                  className={`${INPUT_CLASS} ${formErrors.first_name ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500' : ''}`}
                />
                {formErrors.first_name && <p className="mt-1 text-xs text-rose-600">{formErrors.first_name}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Last Name</label>
                <input
                  type="text"
                  placeholder="Doe"
                  value={formData.last_name}
                  onChange={(e) => updateField('last_name', e.target.value)}
                  className={`${INPUT_CLASS} ${formErrors.last_name ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500' : ''}`}
                />
                {formErrors.last_name && <p className="mt-1 text-xs text-rose-600">{formErrors.last_name}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nationality</label>
                <input
                  type="text"
                  list="nationality-options"
                  placeholder="e.g. Filipino"
                  value={formData.nationality}
                  onChange={(e) => updateField('nationality', e.target.value)}
                  className={INPUT_CLASS}
                />
                <datalist id="nationality-options">
                  {NATIONALITIES.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
              <DatePicker
                label="Date of Birth"
                value={formData.date_of_birth}
                onChange={(v) => updateField('date_of_birth', v)}
              />
            </div>
            <div className="mt-4 w-1/2">
              <Select
                label="Gender"
                placeholder="Select gender"
                value={formData.gender}
                onChange={(e) => updateField('gender', e.target.value)}
              >
                {GENDERS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* ── Section 2: Contact & Address ── */}
          <div>
            <p className={`${SECTION_LABEL} mb-3`}>Contact & Address</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    className={`${INPUT_CLASS} pl-10 ${formErrors.email ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500' : ''}`}
                  />
                </div>
                {formErrors.email && <p className="mt-1 text-xs text-rose-600">{formErrors.email}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="0917 123 4567"
                    value={formData.phone}
                    onChange={(e) => updateField('phone', stripPhoneInput(e.target.value))}
                    maxLength={15}
                    className={`${INPUT_CLASS} pl-10 ${formErrors.phone ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500' : ''}`}
                  />
                </div>
                {formErrors.phone && <p className="mt-1 text-xs text-rose-600">{formErrors.phone}</p>}
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="123 Main St"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  className={`${INPUT_CLASS} pl-10`}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">City</label>
                <input
                  type="text"
                  placeholder="New York"
                  value={formData.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Country</label>
                <input
                  type="text"
                  placeholder="United States"
                  value={formData.country}
                  onChange={(e) => updateField('country', e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Postal Code</label>
                <input
                  type="text"
                  placeholder="10001"
                  value={formData.postal_code}
                  onChange={(e) => updateField('postal_code', e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          {/* ── Section 3: Status & Notes ── */}
          <div>
            <p className={`${SECTION_LABEL} mb-3`}>Status & Notes</p>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-rose-200/60 bg-rose-50/50 cursor-pointer transition-colors hover:bg-rose-50">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={formData.is_blacklisted}
                onChange={(e) => updateField('is_blacklisted', e.target.checked)}
              />
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                formData.is_blacklisted
                  ? 'border-rose-500 bg-rose-500'
                  : 'border-slate-300 bg-white'
              }`}>
                {formData.is_blacklisted && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div>
                <span className="text-sm font-medium text-rose-800">Mark as Blacklisted Guest</span>
                <p className="text-xs text-rose-600/70">Blacklisted guests cannot make new reservations</p>
              </div>
            </label>

            {formData.is_blacklisted && (
              <div className="mt-3">
                <label className="mb-1 block text-sm font-medium text-slate-700">Blacklist Reason</label>
                <textarea
                  className="flex min-h-[70px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                  placeholder="Why is this guest blacklisted?"
                  value={formData.blacklist_reason}
                  onChange={(e) => updateField('blacklist_reason', e.target.value)}
                />
              </div>
            )}

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-y"
                placeholder="Add internal guest notes or preferences..."
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Guest Detail Modal ── */}
      <Modal
        isOpen={detailGuestId !== null}
        onClose={() => setDetailGuestId(null)}
        title="Guest Details"
        size="xl"
      >
        {detailLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 w-full animate-pulse rounded bg-bg" />
            ))}
          </div>
        ) : detailGuest ? (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/20 text-xl font-bold text-gold-dark">
                {detailGuest.first_name[0]}{detailGuest.last_name[0]}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-foreground">
                    {detailGuest.first_name} {detailGuest.last_name}
                  </h3>
                  {detailGuest.is_blacklisted && (
                    <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 border border-rose-200/60">
                      Blacklisted
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {detailGuest.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {detailGuest.phone}
                  </span>
                  {detailGuest.nationality && (
                    <span className="text-slate-500">{detailGuest.nationality}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4">
              <div>
                <span className="text-xs font-medium text-muted">Date of Birth</span>
                <p className="text-sm text-foreground">
                  {detailGuest.date_of_birth ? formatDateDisplay(detailGuest.date_of_birth) : '—'}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted">Gender</span>
                <p className="text-sm text-foreground capitalize">{detailGuest.gender || '—'}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted">Address</span>
                <p className="text-sm text-foreground">
                  {[detailGuest.address, detailGuest.city, detailGuest.country].filter(Boolean).join(', ') || '—'}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted">Total Bookings</span>
                <p className="text-sm text-foreground">
                  {(detailGuest.reservations ?? []).filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status)).length}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted">Total Spent</span>
                <p className="text-sm font-semibold text-foreground">
                  {formatCurrency(getTotalSpent((detailGuest.reservations ?? []).filter(r => ['pending', 'confirmed', 'checked_in', 'checked_out'].includes(r.status))))}
                </p>
              </div>
            </div>

            {detailGuest.is_blacklisted && detailGuest.blacklist_reason && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-foreground">Blacklist Reason</h4>
                <p className="text-sm text-muted">{detailGuest.blacklist_reason}</p>
              </div>
            )}

            {detailGuest.notes && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-foreground">Notes</h4>
                <p className="text-sm text-muted">{detailGuest.notes}</p>
              </div>
            )}

            {(() => {
              const current = getCurrentReservation(detailGuest.reservations || [])
              return current ? (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-foreground">Current Reservation</h4>
                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bed className="h-4 w-4 text-muted" />
                        <span className="font-medium text-foreground">
                          Room {current.room?.room_number}
                        </span>
                        <StatusBadge status={current.status} />
                      </div>
                      <span className="text-sm text-muted">
                        {formatDateDisplay(current.check_in)} -{' '}
                        {formatDateDisplay(current.check_out)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm text-muted">
                      <span>Adults: {current.adults}</span>
                      <span>Children: {current.children}</span>
                      <span>Total: {formatCurrency(Number(current.total_amount))}</span>
                    </div>
                  </div>
                </div>
              ) : null
            })()}

            <div>
              <h4 className="mb-2 text-sm font-semibold text-foreground">Visit History</h4>
              {historyLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-12 w-full animate-pulse rounded bg-bg" />
                  ))}
                </div>
              ) : guestHistoryList.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <Calendar className="mb-2 h-8 w-8 text-muted/50" />
                  <p className="text-sm text-muted">No visit history found.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-bg">
                        <th className="px-4 py-2 text-left font-medium text-muted">Reservation</th>
                        <th className="px-4 py-2 text-left font-medium text-muted">Room</th>
                        <th className="px-4 py-2 text-left font-medium text-muted">Dates</th>
                        <th className="px-4 py-2 text-left font-medium text-muted">Status</th>
                        <th className="px-4 py-2 text-right font-medium text-muted">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guestHistoryList.map((r) => (
                        <tr key={r.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-2 font-medium text-foreground">
                            #{r.reservation_number}
                          </td>
                          <td className="px-4 py-2 text-muted">
                            {r.room?.room_number ?? '—'}
                          </td>
                          <td className="px-4 py-2 text-muted">
                            {formatDateDisplay(r.check_in)} -{' '}
                            {formatDateDisplay(r.check_out)}
                          </td>
                          <td className="px-4 py-2">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-foreground">
                            {formatCurrency(Number(r.total_amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 text-center">
            <AlertCircle className="mb-2 h-8 w-8 text-muted" />
            <p className="text-sm text-muted">Could not load guest details.</p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete Guest"
        message="Are you sure you want to delete this guest? This action cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteGuest.isPending}
      />
    </div>
  )
}
