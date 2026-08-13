import { useState, useMemo, useEffect, useRef } from 'react'
import { useAvailableRooms, useCreateReservation, useUpdateReservation, useSettings } from '@/hooks/useApi'
import { formatCurrency, formatDateDisplay, toLocalDateStr } from '@/lib/format'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Select } from '@/components/ui/select'
import { BOOKING_SOURCES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Reservation } from '@/types'
import {
  Check, ChevronLeft, ChevronRight, BedDouble, Users as UsersIcon, CreditCard, ClipboardCheck, Loader2,
} from 'lucide-react'

interface ReservationFormModalProps {
  isOpen: boolean
  onClose: () => void
  reservation: Reservation | null
}

interface ReservationFormData {
  guest_first_name: string
  guest_last_name: string
  guest_email: string
  guest_phone: string
  room_id: number | ''
  check_in: string
  check_out: string
  adults: number
  children: number
  price_per_night: number
  discount_percent: number
  special_requests: string
  source: string
  status: 'pending' | 'confirmed'
}

const emptyForm = (): ReservationFormData => ({
  guest_first_name: '',
  guest_last_name: '',
  guest_email: '',
  guest_phone: '',
  room_id: '',
  check_in: toLocalDateStr(new Date()),
  check_out: '',
  adults: 1,
  children: 0,
  price_per_night: 0,
  discount_percent: 0,
  special_requests: '',
  source: '',
  status: 'confirmed',
})

function buildInitialForm(reservation: Reservation | null): ReservationFormData {
  if (!reservation) return emptyForm()

  const checkIn = reservation.check_in?.split(/[\sT]/)[0] ?? ''
  const checkOut = reservation.check_out?.split(/[\sT]/)[0] ?? ''
  const nights = checkIn && checkOut
    ? Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)))
    : 1
  const rate = nights > 0 ? Math.round(reservation.total_amount / nights) : reservation.room?.room_type?.base_price ?? 0

  return {
    guest_first_name: reservation.guest?.first_name ?? '',
    guest_last_name: reservation.guest?.last_name ?? '',
    guest_email: reservation.guest?.email ?? '',
    guest_phone: reservation.guest?.phone ?? '',
    room_id: reservation.room?.id ?? '',
    check_in: checkIn,
    check_out: checkOut,
    adults: reservation.adults,
    children: reservation.children,
    price_per_night: rate,
    discount_percent: 0,
    special_requests: reservation.special_requests ?? '',
    source: reservation.source ?? '',
    status: 'confirmed',
  }
}

export function ReservationFormModal({ isOpen, onClose, reservation }: ReservationFormModalProps) {
  const [form, setForm] = useState<ReservationFormData>(() => buildInitialForm(reservation))
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ReservationFormData, string>>>({})
  const [wizardStep, setWizardStep] = useState(1)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const editingReservation = reservation
  const prevOpen = useRef(isOpen)

  useEffect(() => {
    if (isOpen && !prevOpen.current) {
      setForm(buildInitialForm(reservation))
      setFormErrors({})
      setWizardStep(1)
      setSubmitError(null)
    }
    prevOpen.current = isOpen
  }, [isOpen, reservation])

  const formHasDates = !!(form.check_in && form.check_out)
  const { data: availableRoomsData } = useAvailableRooms(
    formHasDates ? { check_in: form.check_in, check_out: form.check_out } : undefined,
  )
  const availableRooms = availableRoomsData ?? []

  const createReservation = useCreateReservation()
  const updateReservation = useUpdateReservation()
  const { data: settingsData } = useSettings()
  const settings = (settingsData ?? {}) as Record<string, string>
  const taxRatePercent = Number(settings['tax_rate'] ?? 10)
  const taxRate = taxRatePercent / 100
  const taxLabel = `${taxRatePercent}%`

  function validateStep(step: number): boolean {
    const errors: Partial<Record<keyof ReservationFormData, string>> = {}
    if (step === 1) {
      if (!form.guest_first_name.trim()) errors.guest_first_name = 'First name is required'
      if (!form.guest_last_name.trim()) errors.guest_last_name = 'Last name is required'
      if (!form.guest_phone.trim()) errors.guest_phone = 'Phone is required'
      if (!form.check_in) errors.check_in = 'Check-in date is required'
      if (!form.check_out) errors.check_out = 'Check-out date is required'
      if (form.check_in && form.check_out && new Date(form.check_out) <= new Date(form.check_in)) {
        errors.check_out = 'Check-out must be after check-in'
      }
      if (form.adults < 1) errors.adults = 'At least 1 adult required'
      if (form.children < 0) errors.children = 'Invalid number'
    } else if (step === 2) {
      if (!form.room_id) errors.room_id = 'Please select a room'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  function nextStep() {
    if (!validateStep(wizardStep)) return
    setSubmitError(null)
    setWizardStep(prev => Math.min(prev + 1, 4))
  }

  function prevStep() {
    setWizardStep(prev => Math.max(prev - 1, 1))
  }

  function handleFormChange(field: keyof ReservationFormData, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const nights = useMemo(() => {
    if (!form.check_in || !form.check_out) return 0
    return Math.max(1, Math.round((new Date(form.check_out).getTime() - new Date(form.check_in).getTime()) / (1000 * 60 * 60 * 24)))
  }, [form.check_in, form.check_out])

  const totalPreview = useMemo(() => {
    if (!nights || !form.price_per_night) return 0
    const subtotal = nights * form.price_per_night
    const discountAmount = subtotal * (form.discount_percent / 100)
    const tax = (subtotal - discountAmount) * taxRate
    return Math.round((subtotal - discountAmount + tax) * 100) / 100
  }, [nights, form.price_per_night, form.discount_percent, taxRate])

  const isFormSubmitting = createReservation.isPending || updateReservation.isPending

  async function handleFormSubmit() {
    const payload: Record<string, string | number | boolean | undefined> = {
      guest_first_name: form.guest_first_name.trim(),
      guest_last_name: form.guest_last_name.trim(),
      guest_email: form.guest_email.trim() || undefined,
      guest_phone: form.guest_phone.trim(),
      room_id: Number(form.room_id),
      check_in: form.check_in,
      check_out: form.check_out,
      adults: form.adults,
      children: form.children,
      price_per_night: form.price_per_night,
      discount_percent: form.discount_percent,
      total_amount: totalPreview,
      special_requests: form.special_requests,
      source: form.source || undefined,
    }

    if (!editingReservation) {
      payload.status = form.status
    }

    try {
      if (editingReservation) {
        await updateReservation.mutateAsync({ id: editingReservation.id, data: payload })
      } else {
        await createReservation.mutateAsync(payload)
      }
      onClose()
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to save reservation')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingReservation ? 'Edit Reservation' : 'New Reservation'}
      size="lg"
    >
      {/* Step Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {[
            { step: 1, label: 'Guest & Dates', icon: UsersIcon },
            { step: 2, label: 'Room', icon: BedDouble },
            { step: 3, label: 'Pricing', icon: CreditCard },
            { step: 4, label: 'Review', icon: ClipboardCheck },
          ].map(({ step, label, icon: Icon }, idx) => (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                    wizardStep === step && 'bg-primary text-white',
                    wizardStep > step && 'bg-success text-white',
                    wizardStep < step && 'bg-border text-muted',
                  )}
                >
                  {wizardStep > step ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span
                  className={cn(
                    'mt-1.5 text-[11px] font-medium whitespace-nowrap',
                    wizardStep === step ? 'text-primary' : 'text-muted',
                  )}
                >
                  {label}
                </span>
              </div>
              {idx < 3 && (
                <div
                  className={cn(
                    'mx-2 mb-5 h-px flex-1',
                    wizardStep > step ? 'bg-success' : 'bg-border',
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Guest & Dates */}
      {wizardStep === 1 && (
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Guest Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">First Name *</label>
                <Input
                  value={form.guest_first_name}
                  onChange={(e) => handleFormChange('guest_first_name', e.target.value)}
                  error={formErrors.guest_first_name}
                  placeholder="Juan"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Last Name *</label>
                <Input
                  value={form.guest_last_name}
                  onChange={(e) => handleFormChange('guest_last_name', e.target.value)}
                  error={formErrors.guest_last_name}
                  placeholder="Dela Cruz"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Phone *</label>
                <Input
                  value={form.guest_phone}
                  onChange={(e) => handleFormChange('guest_phone', e.target.value)}
                  error={formErrors.guest_phone}
                  placeholder="09171234567"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input
                  type="email"
                  value={form.guest_email}
                  onChange={(e) => handleFormChange('guest_email', e.target.value)}
                  placeholder="juan@email.com"
                />
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Stay Details</h4>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Booking Source</label>
                <Select
                  value={form.source}
                  onChange={(e) => handleFormChange('source', e.target.value)}
                >
                  <option value="" disabled>Select source</option>
                  {BOOKING_SOURCES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Check-in *</label>
                  <DatePicker
                    value={form.check_in}
                    onChange={(v) => handleFormChange('check_in', v)}
                    min={editingReservation ? undefined : toLocalDateStr(new Date())}
                    error={formErrors.check_in}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Check-out *</label>
                  <DatePicker
                    value={form.check_out}
                    onChange={(v) => handleFormChange('check_out', v)}
                    min={form.check_in || (!editingReservation ? toLocalDateStr(new Date()) : undefined)}
                    error={formErrors.check_out}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Adults *</label>
                  <Input
                    type="number"
                    min={1}
                    value={form.adults}
                    onChange={(e) => handleFormChange('adults', Number(e.target.value))}
                    error={formErrors.adults}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Children</label>
                  <Input
                    type="number"
                    min={0}
                    value={form.children}
                    onChange={(e) => handleFormChange('children', Number(e.target.value))}
                    error={formErrors.children}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Room Selection */}
      {wizardStep === 2 && (
        <div className="space-y-4">
          {!formHasDates ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BedDouble className="mb-3 h-10 w-10 text-muted/50" />
              <p className="text-sm font-medium text-foreground">Set dates first</p>
              <p className="text-sm text-muted">Go back and select check-in / check-out dates.</p>
            </div>
          ) : availableRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BedDouble className="mb-3 h-10 w-10 text-muted/50" />
              <p className="text-sm font-medium text-foreground">No rooms available</p>
              <p className="text-sm text-muted">No rooms are available for the selected dates. Try different dates.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted">
                {availableRooms.length} room{availableRooms.length !== 1 ? 's' : ''} available for {formatDateDisplay(form.check_in)} → {formatDateDisplay(form.check_out)}
              </p>
              {formErrors.room_id && (
                <p className="text-sm text-danger">{formErrors.room_id}</p>
              )}
              <div className="grid max-h-[320px] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                {availableRooms.map(room => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => {
                      handleFormChange('room_id', room.id)
                      setForm(prev => ({ ...prev, price_per_night: room.price_override ?? room.room_type.base_price }))
                    }}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-4 text-left transition-all hover:shadow-sm',
                      form.room_id === room.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border bg-card hover:border-border',
                    )}
                  >
                    <div className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                      form.room_id === room.id ? 'bg-primary text-white' : 'bg-border/50 text-muted',
                    )}>
                      {room.room_number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{room.room_type?.name}</p>
                      <p className="text-xs text-muted">
                        Floor {room.floor ?? '-'} · ₱{(room.price_override ?? room.room_type?.base_price)?.toLocaleString()}/night
                      </p>
                    </div>
                    {form.room_id === room.id && (
                      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3: Pricing & Extras */}
      {wizardStep === 3 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-bg px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Rate per Night (from room type)</span>
              <span className="font-semibold text-foreground">{formatCurrency(form.price_per_night)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              The nightly rate is set automatically based on the selected room type.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Discount (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.discount_percent}
                onChange={(e) => handleFormChange('discount_percent', Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Special Requests</label>
            <textarea
              className="flex h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm ring-offset-card placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50"
              value={form.special_requests}
              onChange={(e) => handleFormChange('special_requests', e.target.value)}
              placeholder="Any special requests..."
            />
          </div>
          <div className="rounded-lg border border-border bg-bg p-4">
            <h4 className="mb-2 text-sm font-semibold text-foreground">Price Summary</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Nights</span>
                <span>{nights}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Rate per Night</span>
                <span>{formatCurrency(form.price_per_night)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Subtotal ({nights} × {formatCurrency(form.price_per_night)})</span>
                <span>{formatCurrency(nights * form.price_per_night)}</span>
              </div>
              {form.discount_percent > 0 && (
                <div className="flex justify-between text-danger">
                  <span>Discount ({form.discount_percent}%)</span>
                  <span>-{formatCurrency((nights * form.price_per_night) * (form.discount_percent / 100))}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted">Tax ({taxLabel})</span>
                <span>{formatCurrency(((nights * form.price_per_night) - ((nights * form.price_per_night) * (form.discount_percent / 100))) * taxRate)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-semibold text-foreground">
                <span>Total</span>
                <span>{formatCurrency(totalPreview)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Review & Confirm */}
      {wizardStep === 4 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-bg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-muted mb-1">Guest</p>
                <p className="text-sm font-semibold text-foreground">
                  {form.guest_first_name} {form.guest_last_name}
                </p>
                {form.guest_email && <p className="text-xs text-muted">{form.guest_email}</p>}
                {form.guest_phone && <p className="text-xs text-muted">{form.guest_phone}</p>}
              </div>
              <div>
                <p className="text-xs font-medium text-muted mb-1">Room</p>
                <p className="text-sm font-semibold text-foreground">
                  {availableRooms.find(r => r.id === Number(form.room_id))?.room_number ?? '-'}
                </p>
                <p className="text-xs text-muted">{availableRooms.find(r => r.id === Number(form.room_id))?.room_type?.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted mb-1">Check-in → Check-out</p>
                <p className="text-sm font-semibold text-foreground">
                  {formatDateDisplay(form.check_in)} → {formatDateDisplay(form.check_out)}
                </p>
                <p className="text-xs text-muted">{nights} night{nights !== 1 ? 's' : ''}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted mb-1">Guests</p>
                <p className="text-sm font-semibold text-foreground">
                  {form.adults} Adult{form.adults !== 1 ? 's' : ''}
                  {form.children > 0 ? `, ${form.children} Child${form.children !== 1 ? 'ren' : ''}` : ''}
                </p>
              </div>
              {form.source && (
                <div>
                  <p className="text-xs font-medium text-muted mb-1">Source</p>
                  <p className="text-sm font-semibold text-foreground">
                    {BOOKING_SOURCES.find(s => s.value === form.source)?.label ?? form.source}
                  </p>
                </div>
              )}
              {form.special_requests && (
                <div className="col-span-2">
                  <p className="text-xs font-medium text-muted mb-1">Special Requests</p>
                  <p className="text-sm text-foreground">{form.special_requests}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-bg p-4">
            <h4 className="mb-2 text-sm font-semibold text-foreground">Price Breakdown</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">{nights} nights × {formatCurrency(form.price_per_night)}</span>
                <span>{formatCurrency(nights * form.price_per_night)}</span>
              </div>
              {form.discount_percent > 0 && (
                <div className="flex justify-between text-danger">
                  <span>Discount ({form.discount_percent}%)</span>
                  <span>-{formatCurrency((nights * form.price_per_night) * (form.discount_percent / 100))}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted">Tax ({taxLabel})</span>
                <span>{formatCurrency(((nights * form.price_per_night) - ((nights * form.price_per_night) * (form.discount_percent / 100))) * taxRate)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold text-foreground">
                <span>Total</span>
                <span>{formatCurrency(totalPreview)}</span>
              </div>
            </div>
          </div>

          {!editingReservation ? (
            <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <label className="text-xs font-medium text-foreground">Reservation Status</label>
              <Select
                value={form.status}
                onChange={(e) => handleFormChange('status', e.target.value as 'pending' | 'confirmed')}
              >
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending Payment</option>
              </Select>
              <p className="text-xs text-muted">
                Choose <span className="font-semibold">Pending Payment</span> when awaiting a downpayment or GCash proof. The reservation
                becomes <span className="font-semibold">Confirmed</span> automatically once a completed payment is recorded.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-4 py-2.5">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <p className="text-xs font-medium text-primary">Status is managed from the reservation details.</p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      {submitError && (
        <div className="mt-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3">
          <p className="text-sm text-danger">{submitError}</p>
        </div>
      )}
      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <div>
          {wizardStep > 1 ? (
            <Button variant="ghost" onClick={prevStep}>
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          )}
        </div>
        <div>
          {wizardStep < 4 ? (
            <Button variant="primary" onClick={nextStep}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="primary" onClick={handleFormSubmit} disabled={isFormSubmitting}>
              {isFormSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingReservation ? 'Update Reservation' : 'Create Reservation'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
