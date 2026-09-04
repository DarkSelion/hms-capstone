import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { usePublicRoomType, usePortalCurrency } from '@/hooks/usePublicApi'
import { usePublicAuthStore } from '@/stores/publicAuthStore'
import { formatCurrencyWith } from '@/lib/format'
import { Users, Maximize, BedDouble, Home, Check, ArrowRight } from 'lucide-react'

const ROOM_IMAGES: Record<string, string> = {
  'deluxe': 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&h=600&fit=crop',
  'suite': 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&h=600&fit=crop',
  'villa': 'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=1200&h=600&fit=crop',
  'presidential': 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200&h=600&fit=crop',
}

function getRoomImage(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('villa')) return ROOM_IMAGES.villa
  if (lower.includes('suite') || lower.includes('presidential')) return ROOM_IMAGES.suite
  return ROOM_IMAGES.deluxe
}

const DEFAULT_AMENITIES = [
  'Complimentary Wi-Fi', 'Daily housekeeping', 'In-room safe',
  'Coffee & tea making facilities', 'Flat-screen TV with cable channels',
  'Hot and cold shower', 'Complimentary breakfast', 'Air conditioning',
]

export default function PublicRoomDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { token } = usePublicAuthStore()
  const { data: roomType, isLoading } = usePublicRoomType(slug)
  const currency = usePortalCurrency()
  const fmt = (amount: number) => formatCurrencyWith(amount, currency)

  const checkIn = searchParams.get('check_in') ?? ''
  const checkOut = searchParams.get('check_out') ?? ''
  const adults = searchParams.get('adults') ?? ''
  const children = searchParams.get('children') ?? ''

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent" />
      </div>
    )
  }

  if (!roomType) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <p className="text-white/30 text-lg font-light">Room type not found.</p>
      </div>
    )
  }

  const amenities: string[] = roomType.amenities_json ?? []

  function handleBook() {
    if (!token) {
      const redirectUrl = `/public/rooms/${slug}` + (checkIn || checkOut ? `?${new URLSearchParams({ ...(checkIn && { check_in: checkIn }), ...(checkOut && { check_out: checkOut }) }).toString()}` : '')
      navigate(`/public/login?redirect=${encodeURIComponent(redirectUrl)}`)
      return
    }
    const params = new URLSearchParams()
    if (checkIn) params.set('check_in', checkIn)
    if (checkOut) params.set('check_out', checkOut)
    if (adults) params.set('adults', adults)
    if (children) params.set('children', children)
    params.set('room_type', String(roomType!.id))
    navigate(`/public/book?${params.toString()}`)
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative h-[65vh] min-h-[500px] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={roomType.image_url || getRoomImage(roomType.name)}
            alt={roomType.name}
            className="w-full h-full object-cover animate-ken-burns"
            style={{ animationDuration: '12s' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-dark/60 to-transparent" />
        </div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full border backdrop-blur-md mb-4 ${
            (roomType.rooms_count ?? 0) > 0
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
              : 'bg-red-500/20 text-red-300 border-red-400/30'
          }`}>
            {(roomType.rooms_count ?? 0) > 0 ? `${roomType.rooms_count} rooms available` : 'Sold Out'}
          </span>
          <h1 className="font-serif text-white text-4xl sm:text-5xl lg:text-6xl font-light mb-4">
            {roomType.name}
          </h1>
          <div className="gold-line-left mb-4" />
          <p className="text-white/50 text-base leading-relaxed max-w-2xl">
            {roomType.description}
          </p>
        </div>
      </section>

      {/* Specs Grid */}
      <section className="bg-dark py-14 px-4 border-y border-white/5">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {[
            { icon: Maximize, label: 'Room Size', value: `${roomType.size_sqm} SQM` },
            { icon: Users, label: 'Max Guests', value: `${roomType.max_adults} – ${roomType.max_adults + 1}` },
            { icon: BedDouble, label: 'Bed Type', value: roomType.bed_type },
            { icon: Home, label: 'Category', value: roomType.name.includes('Villa') ? 'Villa' : roomType.name.includes('Suite') ? 'Suite' : 'Room' },
          ].map((spec) => (
            <div key={spec.label} className="text-center p-5 bg-white/[0.03] rounded-xl border border-white/5 hover:border-gold/15 transition-colors duration-300">
              <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-3">
                <spec.icon className="h-5 w-5 text-gold" />
              </div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-white/40 mb-1">{spec.label}</p>
              <p className="text-white font-medium text-sm">{spec.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Booking CTA */}
      <section className="bg-dark py-14 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-r from-gold/5 via-gold/[0.02] to-gold/5 p-8 md:p-10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
              <div>
                <h3 className="font-serif text-2xl text-white font-light mb-2">Ready to Check In?</h3>
                <p className="text-white/40 text-sm">
                  Starting from <span className="text-gold font-semibold">{fmt(roomType.base_price)}</span> per night
                </p>
              </div>
              <button onClick={handleBook} className="btn-gold flex items-center gap-2 shrink-0">
                {(roomType.rooms_count ?? 0) > 0 ? 'Book This Room' : 'Check Availability'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Amenities */}
      {amenities.length > 0 && (
        <section className="py-20 px-4 bg-dark">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <p className="section-subtitle mb-4">Amenities</p>
              <h2 className="section-heading">Room Amenities</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {amenities.map((a: string) => (
                <div key={a} className="flex items-center gap-3 p-4 bg-white/[0.03] rounded-xl border border-white/5 hover:border-gold/15 hover:bg-white/[0.05] transition-all duration-300">
                  <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                    <Check className="h-3.5 w-3.5 text-gold" />
                  </div>
                  <span className="text-sm text-white/60">{a}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Standard Amenities */}
      <section className="py-20 px-4 bg-dark border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="section-subtitle mb-4">Included</p>
            <h2 className="section-heading">Included with Your Stay</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl mx-auto">
            {DEFAULT_AMENITIES.map((item) => (
              <div key={item} className="flex items-center gap-3 p-4 bg-white/[0.03] rounded-xl hover:bg-white/[0.05] transition-colors duration-300">
                <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3 text-gold" />
                </div>
                <span className="text-sm text-white/50">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
