import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { usePublicAvailableRooms, usePublicCreateReservation, usePublicSettings, usePortalCurrency } from '@/hooks/usePublicApi'
import { usePublicAuthStore } from '@/stores/publicAuthStore'
import { useToast } from '@/components/ui/toast'
import { formatCurrencyWith, formatCheckoutTime } from '@/lib/format'
import { DatePicker } from '@/components/ui/date-picker'
import type { PublicRoom, PublicRoomType } from '@/types'
import { Loader2, Check, Users, Maximize, BedDouble, ArrowLeft, CreditCard, Calendar, ChevronRight } from 'lucide-react'

const HERO_IMAGES: Record<string, string> = {
  rooms: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1600&h=900&fit=crop',
  suites: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1600&h=900&fit=crop',
  villas: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=1600&h=900&fit=crop',
}

function getHeroImage(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('villa')) return HERO_IMAGES.villas
  if (lower.includes('suite')) return HERO_IMAGES.suites
  return HERO_IMAGES.rooms
}

function formatDate(dateString: string): string {
  if (!dateString) return ''
  return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface RoomGroup {
  roomType: PublicRoomType
  count: number
  sampleRoom: PublicRoom
}

function groupImage(group: RoomGroup): string {
  return group.sampleRoom.image_url || getHeroImage(group.roomType.name)
}

const steps = ['Dates', 'Room', 'Confirm']

export default function PublicBookingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, token } = usePublicAuthStore()

  const [step, setStep] = useState(() => {
    if (searchParams.get('check_in') && searchParams.get('check_out') && searchParams.get('room_type')) return 2
    return 1
  })
  const [checkIn, setCheckIn] = useState(searchParams.get('check_in') ?? '')
  const [checkOut, setCheckOut] = useState(searchParams.get('check_out') ?? '')
  const [adults, setAdults] = useState(Number(searchParams.get('adults') ?? 2))
  const [childrenCount, setChildrenCount] = useState(Number(searchParams.get('children') ?? 0))
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null)
  const [specialRequests, setSpecialRequests] = useState('')

  const roomTypeParam = searchParams.get('room_type')

  const dateParams = useMemo(() => {
    if (checkIn && checkOut) return { check_in: checkIn, check_out: checkOut }
    return undefined
  }, [checkIn, checkOut])

  const { data: rooms, isLoading: roomsLoading } = usePublicAvailableRooms(dateParams)

  const filteredRooms = useMemo(() => {
    if (!rooms) return rooms
    if (!roomTypeParam) return rooms
    return rooms.filter((r) => String(r.room_type?.id) === roomTypeParam)
  }, [rooms, roomTypeParam])

  const roomGroups = useMemo<RoomGroup[]>(() => {
    if (!filteredRooms) return []
    const map = new Map<number, RoomGroup>()
    for (const room of filteredRooms) {
      const type = room.room_type
      if (!type) continue
      const existing = map.get(type.id)
      if (existing) {
        existing.count += 1
      } else {
        map.set(type.id, { roomType: type, count: 1, sampleRoom: room })
      }
    }
    return Array.from(map.values())
  }, [filteredRooms])

  const createReservation = usePublicCreateReservation()
  const { data: taxSettings } = usePublicSettings('tax')
  const { data: bookingSettings } = usePublicSettings('booking')
  const currency = usePortalCurrency()
  const fmt = (amount: number) => formatCurrencyWith(amount, currency)
  const taxName = (taxSettings as Record<string, unknown> | undefined)?.tax_name
  const taxLabel = typeof taxName === 'string' && taxName.trim() ? taxName.trim() : 'Tax'
  const cancellationPolicy = (bookingSettings as Record<string, unknown> | undefined)?.cancellation_policy
  const cancellationLabel = typeof cancellationPolicy === 'string' && cancellationPolicy.trim() ? cancellationPolicy.trim() : ''
  const checkoutTimeSetting = (bookingSettings as Record<string, unknown> | undefined)?.check_out_time
  const checkoutTimeLabel = formatCheckoutTime(typeof checkoutTimeSetting === 'string' ? checkoutTimeSetting : '12:00')
  const { addToast } = useToast()

  useEffect(() => {
    if (selectedTypeId !== null) return
    const param = searchParams.get('room_type')
    if (!param) return
    const match = roomGroups.find((g) => String(g.roomType.id) === param)
    if (match) setSelectedTypeId(match.roomType.id)
  }, [roomGroups, selectedTypeId, searchParams])

  const maxDate = useMemo(() => {
    const raw = (bookingSettings as Record<string, string> | undefined)?.max_advance_days
    const days = raw ? Number(raw) : 30
    if (days <= 0) return undefined
    const d = new Date()
    d.setDate(d.getDate() + days)
    return toLocalDateStr(d)
  }, [bookingSettings])

  const taxRate = useMemo(() => {
    if (!taxSettings) return 0.12
    const raw = (taxSettings as Record<string, string>)['tax_rate']
    return raw ? Number(raw) / 100 : 0.12
  }, [taxSettings])

  const selectedGroup = useMemo(
    () => roomGroups.find((g) => g.roomType.id === selectedTypeId) ?? null,
    [roomGroups, selectedTypeId],
  )

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0
    return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
  }, [checkIn, checkOut])

  const datesValid = !!checkIn && !!checkOut && checkOut > checkIn
  const dateError = checkIn && checkOut && !datesValid ? 'Check-out must be after check-in.' : ''

  const minCheckOut = useMemo(() => {
    if (!checkIn) return undefined
    const [y, m, d] = checkIn.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + 1)
    return toLocalDateStr(dt)
  }, [checkIn])

  const total = useMemo(() => {
    if (!selectedGroup || !nights || nights < 1) return 0
    const rate = selectedGroup.roomType.base_price
    const subtotal = rate * nights
    const tax = subtotal * taxRate
    return Math.round((subtotal + tax) * 100) / 100
  }, [selectedGroup, nights, taxRate])

  async function handleConfirm() {
    if (!selectedTypeId || !datesValid) return
    try {
      await createReservation.mutateAsync({
        room_type_id: selectedTypeId,
        check_in: checkIn,
        check_out: checkOut,
        adults,
        children: childrenCount,
        special_requests: specialRequests || undefined,
      })
      navigate('/public/my-reservations')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to confirm booking. Please try again.'
      addToast(message, 'error')
    }
  }

  const totalRooms = roomGroups.reduce((n, g) => n + g.count, 0)
  const heroImage = selectedGroup ? groupImage(selectedGroup) : getHeroImage(roomGroups[0]?.roomType.name ?? 'rooms')

  if (!token) return <Navigate to="/public/login" replace />

  return (
    <div className="min-h-screen bg-dark">

      {/* Step Indicator */}
      <div className="bg-dark/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-center gap-0">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                  step > i + 1 ? 'bg-gold text-dark' : step === i + 1 ? 'bg-gold/20 border border-gold text-gold' : 'bg-white/5 border border-white/10 text-white/25'
                }`}>
                  {step > i + 1 ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={`text-xs font-medium tracking-wide hidden sm:block ${step === i + 1 ? 'text-gold' : 'text-white/30'}`}>
                  {label}
                </span>
              </div>
              {i < 2 && (
                <div className={`w-12 sm:w-20 h-px mx-3 transition-colors ${step > i + 1 ? 'bg-gold' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* ══════════════════════════════════════════════════════════════
            STEP 1 — DATES
           ══════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="animate-fade-in">
            {/* Hero */}
            <section className="relative h-56 sm:h-72 rounded-2xl overflow-hidden mb-10">
              <img src={HERO_IMAGES.rooms} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/60 to-dark/30" />
              <div className="relative z-10 h-full flex flex-col justify-end p-8">
                <p className="text-gold/70 text-xs uppercase tracking-[0.2em] font-medium mb-2">Step 1 of 3</p>
                <h1 className="font-serif text-white text-3xl sm:text-4xl font-light">Select Your Dates</h1>
                <p className="text-white/40 text-sm mt-2 max-w-lg">Choose your stay dates and guest count to see available rooms.</p>
              </div>
            </section>

            {/* Form Card */}
            <div className="max-w-2xl mx-auto">
              <div className="bg-dark/50 border border-white/5 rounded-2xl p-6 sm:p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="booking_check_in" className="text-xs uppercase tracking-[0.15em] text-gold/50 block mb-2">Check In</label>
                    <DatePicker value={checkIn} onChange={(v) => setCheckIn(v)} min={toLocalDateStr(new Date())} max={maxDate} />
                  </div>
                  <div>
                    <label htmlFor="booking_check_out" className="text-xs uppercase tracking-[0.15em] text-gold/50 block mb-2">Check Out</label>
                    <DatePicker value={checkOut} onChange={(v) => setCheckOut(v)} min={minCheckOut} max={maxDate} />
                  </div>
                  <div>
                    <label htmlFor="booking_adults" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Adults</label>
                    <select id="booking_adults" value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="input-public">
                      {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="booking_children" className="text-xs uppercase tracking-[0.15em] text-white/40 block mb-2">Children</label>
                    <select id="booking_children" value={childrenCount} onChange={(e) => setChildrenCount(Number(e.target.value))} className="input-public">
                      {[0, 1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>

                {datesValid && (
                  <div className="mt-6 bg-dark/40 border border-white/5 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                      <Calendar className="h-5 w-5 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/70 text-sm font-medium truncate">
                        {formatDate(checkIn)} — {formatDate(checkOut)}
                      </p>
                      <p className="text-white/25 text-xs mt-0.5">{nights} night{nights > 1 ? 's' : ''} · {adults} adult{adults > 1 ? 's' : ''}{childrenCount > 0 ? `, ${childrenCount} child${childrenCount > 1 ? 'ren' : ''}` : ''}</p>
                    </div>
                  </div>
                )}

                {dateError && (
                  <p className="mt-4 text-sm text-red-400">{dateError}</p>
                )}

                <button
                  onClick={() => setStep(2)}
                  disabled={!datesValid}
                  className="btn-gold w-full mt-6 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Search Available Rooms <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            STEP 2 — ROOM SELECTION
           ══════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="animate-fade-in">
            {/* Hero — shows the currently selected room type image */}
            <section className="relative h-56 sm:h-72 rounded-2xl overflow-hidden mb-10">
              <img
                src={heroImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/60 to-dark/30" />
              <div className="relative z-10 h-full flex flex-col justify-end p-8">
                <button onClick={() => setStep(1)} className="self-start flex items-center gap-1.5 text-white/40 hover:text-gold text-xs uppercase tracking-wider mb-3 transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" /> Change dates
                </button>
                <p className="text-gold/70 text-xs uppercase tracking-[0.2em] font-medium mb-2">Step 2 of 3</p>
                <h1 className="font-serif text-white text-3xl sm:text-4xl font-light">Choose Your Room</h1>
                <p className="text-white/40 text-sm mt-2">
                  {roomsLoading ? 'Checking availability...' : `${totalRooms} room${totalRooms !== 1 ? 's' : ''} available · ${formatDate(checkIn)} — ${formatDate(checkOut)}`}
                </p>
              </div>
            </section>

            {roomsLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
              </div>
            ) : roomGroups.length === 0 ? (
              <div className="bg-dark/50 border border-white/5 rounded-2xl p-8 sm:p-16 text-center max-w-xl mx-auto">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-5">
                  <BedDouble className="h-7 w-7 text-white/20" />
                </div>
                <p className="text-white/40 text-lg mb-2">No rooms available</p>
                <p className="text-white/20 text-sm mb-6">Try different dates or guest count.</p>
                <button onClick={() => setStep(1)} className="text-gold text-sm hover:underline">Change dates</button>
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto">
                {roomGroups.map((group) => {
                  const isSelected = selectedTypeId === group.roomType.id
                  return (
                    <div
                      key={group.roomType.id}
                      onClick={() => setSelectedTypeId(group.roomType.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedTypeId(group.roomType.id) } }}
                      className={`group border rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ${
                        isSelected
                          ? 'border-gold shadow-lg shadow-gold/10 bg-dark/60'
                          : 'border-white/5 hover:border-white/15 bg-dark/40 hover:bg-dark/50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row">
                        <div className="sm:w-56 h-44 sm:h-auto shrink-0 overflow-hidden relative">
                          <img
                            src={groupImage(group)}
                            alt={group.roomType.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute top-3 left-3">
                            <span className="inline-flex items-center rounded-full bg-dark/80 backdrop-blur px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-gold">
                              {group.count} {group.count > 1 ? 'rooms' : 'room'} left
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 p-5 flex flex-col">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <h3 className="font-serif text-xl text-white font-light">
                                {group.roomType.name}
                              </h3>
                              {group.roomType.description && (
                                <p className="text-white/40 text-sm mt-1 line-clamp-2">{group.roomType.description}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-gold font-semibold text-xl">
                                {fmt(group.roomType.base_price)}
                              </p>
                              <p className="text-white/20 text-[10px] uppercase tracking-wider">per night</p>
                              {nights > 0 && (
                                <p className="text-white/30 text-xs mt-1.5">
                                  {fmt(group.roomType.base_price * nights)} total
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-4 text-xs text-white/30">
                            <span className="flex items-center gap-1.5"><BedDouble className="h-3.5 w-3.5 text-white/20" /> {group.roomType.bed_type}</span>
                            <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-white/20" /> {group.roomType.max_adults} adults</span>
                            <span className="flex items-center gap-1.5"><Maximize className="h-3.5 w-3.5 text-white/20" /> {group.roomType.size_sqm} m²</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-center sm:pr-6 pb-5 sm:pb-0">
                          <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                            isSelected ? 'border-gold bg-gold scale-110' : 'border-white/20 group-hover:border-white/40'
                          }`}>
                            {isSelected && <Check className="h-4 w-4 text-dark" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {selectedGroup && (
              <div className="max-w-3xl mx-auto mt-8">
                <button onClick={() => setStep(3)} className="btn-gold w-full flex items-center justify-center gap-2">
                  Continue to Confirmation <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            STEP 3 — CONFIRMATION
           ══════════════════════════════════════════════════════════════ */}
        {step === 3 && selectedGroup && (
          <div className="animate-fade-in">
            {/* Hero — large room image */}
            <section className="relative h-56 sm:h-72 rounded-2xl overflow-hidden mb-10">
              <img
                src={heroImage}
                alt={selectedGroup.roomType.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/60 to-dark/20" />
              <div className="absolute top-4 left-4 z-10">
                <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-white/40 hover:text-gold text-xs uppercase tracking-wider transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" /> Change room
                </button>
              </div>
              <div className="relative z-10 h-full flex flex-col justify-end p-8">
                <p className="text-gold/70 text-xs uppercase tracking-[0.2em] font-medium mb-2">Step 3 of 3</p>
                <h1 className="font-serif text-white text-3xl sm:text-4xl font-light">Confirm Booking</h1>
              </div>
            </section>

            <div className="max-w-3xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* Left — Details */}
              <div className="lg:col-span-3 space-y-5">
                {/* Room Info */}
                <div className="bg-dark/50 border border-white/5 rounded-2xl p-6">
                  <h3 className="text-white font-medium mb-5 flex items-center gap-2">
                    <BedDouble className="h-4 w-4 text-gold" /> Room Details
                  </h3>
                  <div className="space-y-0">
                    {[
                      { label: 'Room Type', value: selectedGroup.roomType.name },
                      { label: 'Room Number', value: 'Assigned at check-in' },
                      { label: 'Bed Type', value: selectedGroup.roomType.bed_type },
                      { label: 'Max Guests', value: `${selectedGroup.roomType.max_adults} adults` },
                      { label: 'Room Size', value: `${selectedGroup.roomType.size_sqm} m²` },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between py-2.5 border-b border-white/5 last:border-0">
                        <span className="text-white/30 text-sm">{row.label}</span>
                        <span className="text-white/70 text-sm">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stay Info */}
                <div className="bg-dark/50 border border-white/5 rounded-2xl p-6">
                  <h3 className="text-white font-medium mb-5 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gold" /> Stay Details
                  </h3>
                  <div className="space-y-0">
                    {[
                      { label: 'Guest', value: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Guest' },
                      { label: 'Check In', value: formatDate(checkIn) },
                      { label: 'Check Out', value: formatDate(checkOut) },
                      { label: 'Check-out Time', value: checkoutTimeLabel },
                      { label: 'Nights', value: String(nights) },
                      { label: 'Guests', value: `${adults} adult${adults > 1 ? 's' : ''}${childrenCount > 0 ? `, ${childrenCount} child${childrenCount > 1 ? 'ren' : ''}` : ''}` },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between py-2.5 border-b border-white/5 last:border-0">
                        <span className="text-white/30 text-sm">{row.label}</span>
                        <span className="text-white/70 text-sm">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Special Requests */}
                <div className="bg-dark/50 border border-white/5 rounded-2xl p-6">
                  <label className="text-white font-medium flex items-center gap-2 mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-gold" /> Special Requests
                  </label>
                  <textarea
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    rows={3}
                    placeholder="Any special requests or requirements..."
                    className="input-public resize-none"
                  />
                </div>
              </div>

              {/* Right — Price Summary */}
              <div className="lg:col-span-2">
                <div className="bg-dark/50 border border-white/5 rounded-2xl p-6 lg:sticky lg:top-28">
                  <h3 className="text-white font-medium mb-5">Price Summary</h3>
                  {(() => {
                    const rate = selectedGroup.roomType.base_price
                    const subtotal = rate * nights
                    const tax = subtotal * taxRate
                    const taxPercent = Math.round(taxRate * 100)
                    return (
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/30">{fmt(rate)} × {nights} night{nights > 1 ? 's' : ''}</span>
                          <span className="text-white/60">{fmt(subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/30">{taxLabel} ({taxPercent}%)</span>
                          <span className="text-white/60">{fmt(tax)}</span>
                        </div>
                        <div className="border-t border-white/10 pt-3 mt-3">
                          <div className="flex justify-between items-center">
                            <span className="text-white font-medium">Total</span>
                            <span className="text-gold font-bold text-xl">{fmt(total)}</span>
                          </div>
                        </div>
                        {cancellationLabel && (
                          <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                            <p className="text-white/40 text-[11px] leading-relaxed">
                              <span className="text-gold/70 font-medium">Cancellation: </span>{cancellationLabel}
                            </p>
                          </div>
                        )}
                        <button
                          onClick={handleConfirm}
                          disabled={createReservation.isPending}
                          className="btn-gold w-full mt-6 flex items-center justify-center gap-2 !py-3.5"
                        >
                          {createReservation.isPending ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                          ) : (
                            <><CreditCard className="h-4 w-4" /> Confirm Booking</>
                          )}
                        </button>
                        <p className="text-center text-white/20 text-[10px]">
                          You will not be charged now. Payment is due at check-in.
                        </p>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
