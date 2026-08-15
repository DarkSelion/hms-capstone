import { useState } from 'react'
import { useGuests, useGuest, useGuestHistory, useCreateGuest, useUpdateGuest, useDeleteGuest } from '@/hooks/useApi'
import type { Guest, Reservation } from '@/types'
import { formatCurrency, formatDateDisplay } from '@/lib/format'
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
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores/authStore'
import { isAdminRole } from '@/lib/permissions'
import {
  Plus, Search, Eye, Edit, Trash2, Phone, Mail, Globe,
  Calendar, Bed, Save,
  AlertCircle, UserX, MapPin
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
      key: 'name',
      label: 'Name',
      render: (g) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">
            {g.first_name} {g.last_name}
          </span>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (g) => (
        <div className="flex items-center gap-1.5 text-muted">
          <Mail className="h-3.5 w-3.5" />
          {g.email}
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (g) => (
        <div className="flex items-center gap-1.5 text-muted">
          <Phone className="h-3.5 w-3.5" />
          {g.phone}
        </div>
      ),
    },
    {
      key: 'nationality',
      label: 'Nationality',
      render: (g) => (
        <div className="flex items-center gap-1.5 text-muted">
          <Globe className="h-3.5 w-3.5" />
          {g.nationality || '-'}
        </div>
      ),
    },
    {
      key: 'total_bookings',
      label: 'Bookings',
      render: (g) => (
        <span className="font-medium">{g.reservations_count ?? 0}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (g) => {
        if (g.is_blacklisted) return <StatusBadge status="cancelled" />
        return <Badge variant="default">Regular</Badge>
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (g) => (
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
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div className="relative max-w-xs flex-1">
              <Input
                placeholder="Search by name, email, phone..."
                icon={<Search className="h-4 w-4" />}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
              />
            </div>
            <Button
              variant={blacklistedOnly ? 'danger' : 'outline'}
              size="sm"
              onClick={() => { setBlacklistedOnly(!blacklistedOnly); setCurrentPage(1) }}
            >
              <UserX className="h-4 w-4" />
              Blacklisted
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={guests}
            loading={guestsLoading}
            error={guestsError ? (guestsError as Error).message : null}
            onSearch={undefined}
            onRetry={() => refetchGuests()}
            keyExtractor={(g) => g.id}
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

      <Modal
        isOpen={modalMode !== null}
        onClose={closeModal}
        title={modalMode === 'add' ? 'Add Guest' : 'Edit Guest'}
        size="xl"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={closeModal} disabled={isMutating}>
              Cancel
            </Button>
            <Button variant="gold" onClick={handleSubmit} disabled={isMutating}>
              {isMutating ? 'Saving...' : <><Save className="h-4 w-4" /> Save</>}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              placeholder="John"
              value={formData.first_name}
              onChange={(e) => updateField('first_name', e.target.value)}
              error={formErrors.first_name}
            />
            <Input
              label="Last Name"
              placeholder="Doe"
              value={formData.last_name}
              onChange={(e) => updateField('last_name', e.target.value)}
              error={formErrors.last_name}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="john@example.com"
              icon={<Mail className="h-4 w-4" />}
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              error={formErrors.email}
            />
            <Input
              label="Phone"
              placeholder="+1 234 567 890"
              icon={<Phone className="h-4 w-4" />}
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              error={formErrors.phone}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label="Nationality"
                list="nationality-options"
                placeholder="e.g. Filipino"
                value={formData.nationality}
                onChange={(e) => updateField('nationality', e.target.value)}
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

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Address"
              placeholder="123 Main St"
              icon={<MapPin className="h-4 w-4" />}
              value={formData.address}
              onChange={(e) => updateField('address', e.target.value)}
            />
            <Input
              label="City"
              placeholder="New York"
              value={formData.city}
              onChange={(e) => updateField('city', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Country"
              placeholder="United States"
              value={formData.country}
              onChange={(e) => updateField('country', e.target.value)}
            />
            <Input
              label="Postal Code"
              placeholder="10001"
              value={formData.postal_code}
              onChange={(e) => updateField('postal_code', e.target.value)}
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border text-danger focus:ring-danger/50"
                checked={formData.is_blacklisted}
                onChange={(e) => updateField('is_blacklisted', e.target.checked)}
              />
              <UserX className="h-4 w-4 text-danger" />
              Blacklisted
            </label>
          </div>

          {formData.is_blacklisted && (
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Blacklist Reason</label>
              <textarea
                className="flex min-h-[70px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm ring-offset-card placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50 focus-visible:border-danger"
                placeholder="Why is this guest blacklisted?"
                value={formData.blacklist_reason}
                onChange={(e) => updateField('blacklist_reason', e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Notes</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm ring-offset-card placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
              placeholder="Any additional notes..."
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
            />
          </div>
        </form>
      </Modal>

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
                  {detailGuest.is_blacklisted && <Badge variant="danger">Blacklisted</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {detailGuest.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {detailGuest.phone}
                  </span>
                  {detailGuest.nationality && (
                    <span className="flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5" /> {detailGuest.nationality}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4">
              <div>
                <span className="text-xs font-medium text-muted">Date of Birth</span>
                <p className="text-sm text-foreground">
                  {detailGuest.date_of_birth
                    ? formatDateDisplay(detailGuest.date_of_birth)
                    : '-'}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted">Gender</span>
                <p className="text-sm text-foreground capitalize">{detailGuest.gender || '-'}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted">Address</span>
                <p className="text-sm text-foreground">
                  {[detailGuest.address, detailGuest.city, detailGuest.country]
                    .filter(Boolean)
                    .join(', ') || '-'}
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
                            {r.room?.room_number ?? '-'}
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
