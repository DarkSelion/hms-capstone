import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { usePublicRoomType, usePortalCurrency, usePublicSettings, usePublicRoomTypes } from '@/hooks/usePublicApi'
import { usePublicAuthStore } from '@/stores/publicAuthStore'
import { formatCurrencyWith, toLocalDateStr } from '@/lib/format'
import { DatePicker } from '@/components/ui/date-picker'
import { Users, Maximize, BedDouble, Home, Check, ArrowRight, ArrowLeft, Star, Calendar, Shield, CreditCard, Sparkles, ChevronRight, Coffee, Wifi, Wind } from 'lucide-react'
import type { PublicRoomType } from '@/types'

const ROOM_IMAGES: Record<string, string[]> = {
  deluxe: [
    'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&h=600&fit=crop',
    'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&h=500&fit=crop',
  ],
  suite: [
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&h=600&fit=crop',
    'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&h=500&fit=crop',
  ],
  villa: [
    'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=1200&h=600&fit=crop',
    'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=500&fit=crop',
  ],
  default: [
    'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&h=600&fit=crop',
    'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&h=500&fit=crop',
  ],
}

const DEFAULT_AMENITIES = [
  'Complimentary Wi-Fi',
  'Daily housekeeping',
  'In-room safe',
  'Coffee & tea making facilities',
  'Flat-screen TV with cable channels',
  'Hot and cold shower',
  'Complimentary breakfast',
  'Air conditioning',
]

function getRoomImages(name: string, primarySrc?: string): string[] {
  const lower = name.toLowerCase()
  let base: string[]
  if (lower.includes('villa')) base = ROOM_IMAGES.villa
  else if (lower.includes('suite') || lower.includes('presidential')) base = ROOM_IMAGES.suite
  else base = ROOM_IMAGES.default
  if (primarySrc) {
    return [primarySrc, ...base.filter((img) => img !== primarySrc)]
  }
  return base
}

function useScrollReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])
  return { ref, className: `reveal-hidden ${visible ? 'reveal-visible' : ''}` }
}

function todayISO(): string {
  return toLocalDateStr(new Date())
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return toLocalDateStr(date)
}

export default function PublicRoomDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { token } = usePublicAuthStore()
  const { data: roomType, isLoading } = usePublicRoomType(slug)
  const { data: allRoomTypes } = usePublicRoomTypes()
  const { data: bookingSettings } = usePublicSettings('booking')
  const { data: taxSettings } = usePublicSettings('tax')
  const currency = usePortalCurrency()
  const fmt = (amount: number) => formatCurrencyWith(amount, currency)

  const taxRate = useMemo(() => {
    const v = (taxSettings as Record<string, unknown> | undefined)?.tax_rate
    return typeof v === 'number' ? v : typeof v === 'string' ? Number(v) || 0 : 0
  }, [taxSettings])
  const taxName = useMemo(() => {
    const v = (taxSettings as Record<string, unknown> | undefined)?.tax_name
    return typeof v === 'string' && v.trim() ? v : 'Tax'
  }, [taxSettings])
  const cancellationPolicy = useMemo(() => {
    const v = (bookingSettings as Record<string, unknown> | undefined)?.cancellation_policy
    return typeof v === 'string' ? v : ''
  }, [bookingSettings])
  const checkOutTime = useMemo(() => {
    const v = (bookingSettings as Record<string, unknown> | undefined)?.check_out_time
    return typeof v === 'string' && v.trim() ? v : '12:00 PM'
  }, [bookingSettings])

  const today = todayISO()
  const initialCheckIn = searchParams.get('check_in') || ''
  const initialCheckOut = searchParams.get('check_out') || ''
  const initialAdults = searchParams.get('adults') || '2'
  const initialChildren = searchParams.get('children') || '0'

  const [checkIn, setCheckIn] = useState(initialCheckIn)
  const [checkOut, setCheckOut] = useState(initialCheckOut)
  const [adults, setAdults] = useState(initialAdults)
  const [children, setChildren] = useState(initialChildren)

  useEffect(() => {
    if (!checkIn && !checkOut) {
      const ci = addDays(today, 7)
      const co = addDays(today, 9)
      setCheckIn(ci)
      setCheckOut(co)
    }
  }, [today, checkIn, checkOut])

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0
    const [cy, cm, cd] = checkIn.split('-').map(Number)
    const [oy, om, od] = checkOut.split('-').map(Number)
    const ci = new Date(cy, cm - 1, cd).getTime()
    const co = new Date(oy, om - 1, od).getTime()
    return Math.max(0, Math.round((co - ci) / 86400000))
  }, [checkIn, checkOut])

  const pricePerNight = useMemo(() => {
    if (!roomType) return 0
    return Number(roomType.base_price ?? 0)
  }, [roomType])

  const subtotal = pricePerNight * nights
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount

  const similarRooms = useMemo(() => {
    if (!allRoomTypes || !roomType) return [] as PublicRoomType[]
    return allRoomTypes
      .filter((r: PublicRoomType) => r.id !== roomType.id && r.is_active)
      .slice(0, 3)
  }, [allRoomTypes, roomType])

  if (isLoading) return <RoomDetailSkeleton />
  if (!roomType) {
    return (
      <div className="min-h-[70vh] bg-dark flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-6">
            <Home className="h-8 w-8 text-gold/50" />
          </div>
          <h2 className="font-serif text-3xl text-white font-light mb-3">Room Not Found</h2>
          <p className="text-white/40 text-sm mb-8">
            The room you're looking for is no longer available or has been removed.
          </p>
          <button
            onClick={() => navigate('/public/rooms')}
            className="px-8 py-3 bg-gold text-dark text-xs font-semibold uppercase tracking-[0.12em] rounded-full hover:bg-gold-light transition-all duration-300"
          >
            Browse All Rooms
          </button>
        </div>
      </div>
    )
  }

  const hasRooms = (roomType.rooms_count ?? 0) > 0
  const category = roomType.name.toLowerCase().includes('villa')
    ? 'Villa'
    : roomType.name.toLowerCase().includes('suite') || roomType.name.toLowerCase().includes('presidential')
      ? 'Suite'
      : 'Room'
  const allAmenities = (roomType.amenities_json && roomType.amenities_json.length > 0)
    ? roomType.amenities_json
    : DEFAULT_AMENITIES
  const galleryImages = getRoomImages(roomType.name, roomType.image_url)
  const heroImage = galleryImages[0]
  const thumbnailImages = galleryImages.slice(1, 4)
  const bedTypeDisplay = roomType.bed_type || 'Standard Bed'
  const totalGuests = Number(adults) + Number(children)
  const isValidBooking = hasRooms && nights > 0 && !!checkIn && !!checkOut && totalGuests >= 1

  function handleBook() {
    if (!token) {
      const redirectUrl = `/public/rooms/${slug}` + (checkIn || checkOut
        ? `?${new URLSearchParams({ ...(checkIn && { check_in: checkIn }), ...(checkOut && { check_out: checkOut }) }).toString()}`
        : '')
      navigate(`/public/login?redirect=${encodeURIComponent(redirectUrl)}`)
      return
    }
    if (!isValidBooking) return
    const params = new URLSearchParams()
    params.set('check_in', checkIn)
    params.set('check_out', checkOut)
    params.set('adults', String(adults))
    params.set('children', String(children))
    params.set('room_type', String(roomType!.id))
    navigate(`/public/book?${params.toString()}`)
  }

  return (
    <div className="bg-dark min-h-screen">
      {/* ═══════════════════════════════════════════════════════════════
          BREADCRUMB
          ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-dark border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center gap-2 text-xs">
            <Link to="/public" className="text-gold/70 hover:text-gold transition-colors flex items-center gap-1.5">
              <Home className="h-3 w-3" /> Home
            </Link>
            <ChevronRight className="h-3 w-3 text-white/15" />
            <Link to="/public/rooms" className="text-gold/70 hover:text-gold transition-colors">
              Rooms
            </Link>
            <ChevronRight className="h-3 w-3 text-white/15" />
            <span className="text-white/40 truncate">{roomType.name}</span>
          </nav>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          HERO + GALLERY
          ═══════════════════════════════════════════════════════════════ */}
      <section className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <div className="relative rounded-2xl overflow-hidden h-[40vh] min-h-[300px] max-h-[480px]">
            <img
              src={heroImage}
              alt={roomType.name}
              className="w-full h-full object-cover animate-ken-burns"
              style={{ animationDuration: '12s' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-dark/80 via-dark/20 to-transparent" />
            <div className="absolute top-5 left-5">
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full border backdrop-blur-md ${
                hasRooms
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                  : 'bg-red-500/20 text-red-300 border-red-400/30'
              }`}>
                {hasRooms ? `${roomType.rooms_count} Rooms Available` : 'Sold Out'}
              </span>
            </div>
            <div className="absolute top-5 right-5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full bg-dark/60 backdrop-blur-md text-white/80 border border-white/10">
                <Sparkles className="h-3 w-3 text-gold" /> {category}
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <h1 className="font-serif text-white text-3xl sm:text-4xl lg:text-5xl font-light leading-tight">
                {roomType.name}
              </h1>
            </div>
          </div>

          {/* Thumbnail Gallery */}
          {thumbnailImages.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-3">
              {thumbnailImages.map((img, i) => (
                <div
                  key={i}
                  className="relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer group bg-white/5"
                >
                  <img
                    src={img}
                    alt={`${roomType.name} view ${i + 2}`}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          MAIN CONTENT — Two Columns
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-12 md:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-10 gap-8 lg:gap-10">
          {/* LEFT: Content */}
          <div className="lg:col-span-6 space-y-16">
            {/* About */}
            <AboutSection
              description={roomType.description || ''}
              sizeSqm={roomType.size_sqm}
              maxAdults={roomType.max_adults}
              bedType={bedTypeDisplay}
              category={category}
            />

            {/* Amenities */}
            <AmenitiesSection amenities={allAmenities} />

            {/* Policies */}
            <PoliciesSection
              checkOutTime={checkOutTime}
              cancellationPolicy={cancellationPolicy}
            />

            {/* Similar Rooms */}
            {similarRooms.length > 0 && (
              <SimilarRoomsSection
                rooms={similarRooms}
                currency={currency}
              />
            )}
          </div>

          {/* RIGHT: Sticky Booking Widget */}
          <div className="lg:col-span-4">
            <BookingWidget
              hasRooms={hasRooms}
              pricePerNight={pricePerNight}
              fmt={fmt}
              checkIn={checkIn}
              checkOut={checkOut}
              setCheckIn={setCheckIn}
              setCheckOut={setCheckOut}
              adults={adults}
              setAdults={setAdults}
              children={children}
              setChildren={setChildren}
              maxAdults={roomType.max_adults}
              maxChildren={roomType.max_children}
              nights={nights}
              subtotal={subtotal}
              taxAmount={taxAmount}
              taxRate={taxRate}
              taxName={taxName}
              total={total}
              isValidBooking={isValidBooking}
              handleBook={handleBook}
              today={today}
              cancellationPolicy={cancellationPolicy}
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          MOBILE FIXED BOTTOM BAR
          ═══════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-gray-200 shadow-2xl">
        <div className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">From</p>
            <p className="text-xl font-semibold text-gold-dark leading-none">{fmt(pricePerNight)}</p>
            <p className="text-[10px] text-gray-400">per night</p>
          </div>
          <button
            onClick={handleBook}
            disabled={!isValidBooking}
            className="px-6 py-3 bg-gold text-dark text-xs font-bold uppercase tracking-[0.12em] rounded-full hover:bg-gold-light transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-lg shadow-gold/20"
          >
            {hasRooms ? 'Book Now' : 'Check'} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {/* Spacer for mobile bottom bar */}
      <div className="lg:hidden h-20" />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ABOUT SECTION
   ═══════════════════════════════════════════════════════════════ */
function AboutSection({
  description, sizeSqm, maxAdults, bedType, category,
}: {
  description: string
  sizeSqm?: number
  maxAdults: number
  bedType: string
  category: string
}) {
  const reveal = useScrollReveal(0.1)
  const specs = [
    { icon: Maximize, label: 'Room Size', value: sizeSqm ? `${sizeSqm} m²` : '—' },
    { icon: Users, label: 'Max Guests', value: `${maxAdults} Adults` },
    { icon: BedDouble, label: 'Bed Type', value: bedType },
    { icon: Home, label: 'Category', value: category },
  ].filter((s) => s.value !== '—' || s.label === 'Room Size')

  return (
    <div ref={reveal.ref} className={reveal.className}>
      <p className="section-subtitle mb-3">Room Overview</p>
      <h2 className="font-serif text-3xl md:text-4xl text-white font-light mb-6">About This {category}</h2>
      {description ? (
        <p className="text-white/60 leading-relaxed text-base mb-8 max-w-2xl">{description}</p>
      ) : (
        <p className="text-white/30 italic text-base mb-8">A comfortable {category.toLowerCase()} thoughtfully designed for a restful stay at our hotel.</p>
      )}

      {/* Specs row */}
      <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
        <div className={`grid grid-cols-2 md:grid-cols-${specs.length} gap-6`}>
          {specs.map((spec) => (
            <div key={spec.label} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                <spec.icon className="h-4.5 w-4.5 text-gold" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/40 font-semibold">{spec.label}</p>
                <p className="text-white text-sm font-medium truncate">{spec.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   AMENITIES SECTION
   ═══════════════════════════════════════════════════════════════ */
function AmenitiesSection({ amenities }: { amenities: string[] }) {
  const reveal = useScrollReveal(0.1)
  return (
    <div ref={reveal.ref} className={reveal.className}>
      <p className="section-subtitle mb-3">Features</p>
      <h2 className="font-serif text-3xl md:text-4xl text-white font-light mb-8">Amenities & Services</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
        {amenities.map((a) => {
          const Icon = pickAmenityIcon(a)
          return (
            <div
              key={a}
              className="flex items-center gap-3 p-4 bg-white/[0.03] border border-white/5 rounded-xl hover:border-gold/20 hover:bg-white/[0.05] transition-all duration-300 group"
            >
              <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 group-hover:bg-gold/15 transition-colors">
                <Icon className="h-4 w-4 text-gold" />
              </div>
              <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">{a}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function pickAmenityIcon(text: string) {
  const lower = text.toLowerCase()
  if (lower.includes('wi-fi') || lower.includes('wifi') || lower.includes('internet')) return Wifi
  if (lower.includes('breakfast') || lower.includes('coffee') || lower.includes('tea')) return Coffee
  if (lower.includes('air') || lower.includes('conditioning')) return Wind
  if (lower.includes('tv') || lower.includes('television')) return Star
  return Check
}

/* ═══════════════════════════════════════════════════════════════
   POLICIES SECTION
   ═══════════════════════════════════════════════════════════════ */
function PoliciesSection({ checkOutTime, cancellationPolicy }: { checkOutTime: string; cancellationPolicy: string }) {
  const reveal = useScrollReveal(0.1)
  const policies = [
    {
      icon: Calendar,
      title: 'Check-in / Check-out',
      description: `24/7 reception. Check-out until ${checkOutTime}.`,
    },
    {
      icon: CreditCard,
      title: 'Payment',
      description: 'Pay at the hotel. No prepayment needed.',
    },
    {
      icon: Shield,
      title: 'Cancellation',
      description: cancellationPolicy || 'Flexible cancellation. Contact us for details.',
    },
  ]
  return (
    <div ref={reveal.ref} className={reveal.className}>
      <p className="section-subtitle mb-3">Good to Know</p>
      <h2 className="font-serif text-3xl md:text-4xl text-white font-light mb-8">House Policies</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {policies.map((p) => (
          <div key={p.title} className="p-5 bg-white/[0.03] border border-white/5 rounded-2xl hover:border-gold/15 transition-colors duration-300">
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-4">
              <p.icon className="h-4.5 w-4.5 text-gold" />
            </div>
            <h3 className="text-white font-medium text-sm mb-2">{p.title}</h3>
            <p className="text-white/50 text-xs leading-relaxed">{p.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   SIMILAR ROOMS SECTION
   ═══════════════════════════════════════════════════════════════ */
function SimilarRoomsSection({ rooms, currency }: { rooms: PublicRoomType[]; currency: string }) {
  const reveal = useScrollReveal(0.1)
  return (
    <div ref={reveal.ref} className={reveal.className}>
      <p className="section-subtitle mb-3">Explore More</p>
      <h2 className="font-serif text-3xl md:text-4xl text-white font-light mb-8">Similar Rooms</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {rooms.map((r) => (
          <Link
            key={r.id}
            to={`/public/rooms/${r.slug}`}
            className="group block bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden hover:border-gold/20 hover:bg-white/[0.05] transition-all duration-300"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-white/5">
              <img
                src={r.image_url || getRoomImages(r.name)[0]}
                alt={r.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute top-3 right-3">
                <span className="bg-dark/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2.5 py-1 rounded-full border border-white/10">
                  {r.rooms_count ?? 0} Available
                </span>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-serif text-base text-white font-light mb-1 group-hover:text-gold transition-colors line-clamp-1">
                {r.name}
              </h3>
              <div className="flex items-center justify-between mt-2">
                <div>
                  <span className="text-gold text-sm font-medium">{formatCurrencyWith(Number(r.base_price ?? 0), currency)}</span>
                  <span className="text-white/30 text-[10px] ml-0.5">/ night</span>
                </div>
                <span className="text-gold/60 group-hover:text-gold group-hover:translate-x-0.5 transition-all duration-300">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   BOOKING WIDGET
   ═══════════════════════════════════════════════════════════════ */
function BookingWidget({
  hasRooms, pricePerNight, fmt,
  checkIn, checkOut, setCheckIn, setCheckOut,
  adults, setAdults, children, setChildren,
  maxAdults, maxChildren,
  nights, subtotal, taxAmount, taxRate, taxName, total,
  isValidBooking, handleBook, today, cancellationPolicy,
}: {
  hasRooms: boolean
  pricePerNight: number
  fmt: (n: number) => string
  checkIn: string
  checkOut: string
  setCheckIn: (v: string) => void
  setCheckOut: (v: string) => void
  adults: string
  setAdults: (v: string) => void
  children: string
  setChildren: (v: string) => void
  maxAdults: number
  maxChildren: number
  nights: number
  subtotal: number
  taxAmount: number
  taxRate: number
  taxName: string
  total: number
  isValidBooking: boolean
  handleBook: () => void
  today: string
  cancellationPolicy: string
}) {
  const checkOutMin = useMemo(() => (checkIn ? addDays(checkIn, 1) : addDays(today, 1)), [checkIn, today])

  return (
    <div className="lg:sticky lg:top-24">
      <div className="bg-white rounded-2xl shadow-2xl shadow-black/40 border border-gray-100 overflow-hidden">
        {/* Price Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-4xl text-gold-dark font-light leading-none">{fmt(pricePerNight)}</span>
            <span className="text-sm text-gray-500">/ night</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">Best rate guaranteed. No hidden fees.</p>
        </div>

        {/* Date & Guest Selection */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-[0.12em] font-semibold block mb-1.5">Check-in</label>
              <DatePicker
                value={checkIn}
                onChange={setCheckIn}
                min={today}
                max={addDays(today, 30)}
                placeholder="Select date"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-[0.12em] font-semibold block mb-1.5">Check-out</label>
              <DatePicker
                value={checkOut}
                onChange={setCheckOut}
                min={checkOutMin}
                max={addDays(today, 30)}
                placeholder="Select date"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-[0.12em] font-semibold block mb-1.5">Adults</label>
              <select
                value={adults}
                onChange={(e) => setAdults(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-dark text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20 transition-colors appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%239CA3AF'%3e%3cpath fill-rule='evenodd' d='M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z'/%3e%3c/svg%3e")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '14px',
                  paddingRight: '36px',
                }}
              >
                {Array.from({ length: maxAdults }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n} {n === 1 ? 'Adult' : 'Adults'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-[0.12em] font-semibold block mb-1.5">Children</label>
              <select
                value={children}
                onChange={(e) => setChildren(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-dark text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20 transition-colors appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%239CA3AF'%3e%3cpath fill-rule='evenodd' d='M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z'/%3e%3c/svg%3e")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '14px',
                  paddingRight: '36px',
                }}
              >
                {Array.from({ length: maxChildren + 1 }, (_, i) => i).map((n) => (
                  <option key={n} value={n}>{n} {n === 1 ? 'Child' : 'Children'}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Price Breakdown */}
          {nights > 0 && (
            <div className="pt-4 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{fmt(pricePerNight)} × {nights} {nights === 1 ? 'night' : 'nights'}</span>
                <span className="text-dark font-medium">{fmt(subtotal)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{taxName} ({taxRate}%)</span>
                  <span className="text-dark font-medium">{fmt(taxAmount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-sm font-semibold text-dark">Total</span>
                <span className="text-xl font-serif text-gold-dark font-semibold">{fmt(total)}</span>
              </div>
            </div>
          )}

          {/* CTA Button */}
          <button
            onClick={handleBook}
            disabled={!isValidBooking}
            className="w-full py-3.5 bg-gold text-dark text-sm font-bold uppercase tracking-[0.12em] rounded-full hover:bg-gold-light hover:shadow-lg hover:shadow-gold/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
          >
            {hasRooms ? (nights > 0 ? 'Reserve Now' : 'Select Dates') : 'Check Availability'}
            <ArrowRight className="h-4 w-4" />
          </button>

          {/* Trust signals */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Shield className="h-3.5 w-3.5 text-gold-dark" />
              <span>Secure booking — no charge until check-in</span>
            </div>
            {cancellationPolicy && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Calendar className="h-3.5 w-3.5 text-gold-dark" />
                <span className="line-clamp-1">{cancellationPolicy}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Back to rooms link */}
      <Link
        to="/public/rooms"
        className="hidden lg:flex items-center justify-center gap-1.5 mt-4 text-xs text-white/40 hover:text-gold transition-colors"
      >
        <ArrowLeft className="h-3 w-3" /> Back to all rooms
      </Link>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   SKELETON
   ═══════════════════════════════════════════════════════════════ */
function RoomDetailSkeleton() {
  return (
    <div className="bg-dark min-h-screen animate-pulse">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white/5 h-96 rounded-2xl" />
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="bg-white/5 h-32 rounded-xl" />
          <div className="bg-white/5 h-32 rounded-xl" />
          <div className="bg-white/5 h-32 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 mt-16">
          <div className="lg:col-span-6 space-y-8">
            <div className="bg-white/5 h-32 rounded-xl" />
            <div className="bg-white/5 h-64 rounded-xl" />
          </div>
          <div className="lg:col-span-4">
            <div className="bg-white/10 h-96 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
