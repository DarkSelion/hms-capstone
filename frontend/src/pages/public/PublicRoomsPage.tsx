import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePublicRoomTypes, usePortalCurrency } from '@/hooks/usePublicApi'
import { formatCurrencyWith } from '@/lib/format'
import { Users, Maximize, ArrowRight, Calendar, BedDouble, Sofa, ChevronDown, Sparkles } from 'lucide-react'

const ROOM_IMAGES: Record<string, string[]> = {
  rooms: [
    'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=900&h=550&fit=crop',
    'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=900&h=550&fit=crop',
    'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&h=550&fit=crop',
  ],
  suites: [
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=900&h=550&fit=crop',
    'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=900&h=550&fit=crop',
    'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=900&h=550&fit=crop',
  ],
  villas: [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&h=550&fit=crop',
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=900&h=550&fit=crop',
    'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=900&h=550&fit=crop',
  ],
}

const TABS = [
  { value: 'all', label: 'All Rooms', heading: 'Our Rooms\n& Suites' },
  { value: 'rooms', label: 'Rooms', heading: 'Cozy\nRooms', icon: BedDouble },
  { value: 'suites', label: 'Suites', heading: 'Spacious\nSuites', icon: Sofa },
]

const FEATURE_CHIPS: Record<string, string[]> = {
  default: ['Free Wi-Fi', 'Air Conditioning', 'Daily Housekeeping'],
}

function getRoomImage(name: string, index: number): string {
  const lower = name.toLowerCase()
  if (lower.includes('villa')) return ROOM_IMAGES.villas[index % ROOM_IMAGES.villas.length]
  if (lower.includes('suite')) return ROOM_IMAGES.suites[index % ROOM_IMAGES.suites.length]
  return ROOM_IMAGES.rooms[index % ROOM_IMAGES.rooms.length]
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

function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="bg-dark/5 h-56 rounded-t-2xl" />
      <div className="bg-white p-6 rounded-b-2xl">
        <div className="bg-dark/5 h-5 rounded w-3/4 mb-3" />
        <div className="bg-dark/5 h-4 rounded w-full mb-2" />
        <div className="bg-dark/5 h-4 rounded w-2/3 mb-4" />
        <div className="flex gap-2 mb-4">
          <div className="bg-dark/5 h-6 rounded-full w-20" />
          <div className="bg-dark/5 h-6 rounded-full w-16" />
        </div>
        <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
          <div className="bg-dark/5 h-8 rounded w-24" />
          <div className="bg-dark/5 h-6 rounded w-20" />
        </div>
      </div>
    </div>
  )
}

export default function PublicRoomsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [filter, setFilter] = useState(searchParams.get('type') || 'all')
  const currency = usePortalCurrency()
  const fmt = (amount: number) => formatCurrencyWith(amount, currency)

  const checkIn = searchParams.get('check_in') || ''
  const checkOut = searchParams.get('check_out') || ''

  const { data: roomTypes, isLoading } = usePublicRoomTypes({
    check_in: checkIn || undefined,
    check_out: checkOut || undefined,
  })

  const filtered = useMemo(() => {
    if (!roomTypes) return []
    if (filter === 'all') return roomTypes
    return roomTypes.filter((rt: any) => {
      const name = (rt.name || '').toLowerCase()
      if (filter === 'rooms') return name.includes('room') || name.includes('deluxe')
      if (filter === 'suites') return name.includes('suite')
      return true
    })
  }, [roomTypes, filter])

  const tabCounts = useMemo(() => {
    if (!roomTypes) return { all: 0, rooms: 0, suites: 0 }
    const all = roomTypes.length
    const rooms = roomTypes.filter((rt: any) => {
      const n = (rt.name || '').toLowerCase()
      return n.includes('room') || n.includes('deluxe')
    }).length
    const suites = all - rooms
    return { all, rooms, suites }
  }, [roomTypes])

  const currentTab = TABS.find((t) => t.value === filter) || TABS[0]

  function goToRoom(slug: string) {
    const q = new URLSearchParams()
    if (checkIn) q.set('check_in', checkIn)
    if (checkOut) q.set('check_out', checkOut)
    navigate(`/public/rooms/${slug}?${q.toString()}`)
  }

  const formatDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div>
      {/* ═══════════════════════════════════════════════════════════════
          HERO — Ken Burns + integrated search
          ═══════════════════════════════════════════════════════════════ */}
      <section className="relative h-[65vh] min-h-[500px] flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1920&h=900&fit=crop"
            alt=""
            className="w-full h-full object-cover animate-ken-burns"
            style={{ animationDuration: '12s' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-dark/60 via-dark/40 to-dark/80" />
          <div className="absolute inset-0 bg-gradient-to-r from-dark/30 via-transparent to-dark/30" />
        </div>

        <div className="relative z-10 text-center px-4 mb-8">
          <p className="section-subtitle mb-4 animate-reveal-up" style={{ animationDelay: '0.2s' }}>Accommodations</p>
          <h1
            className="font-serif text-white text-4xl sm:text-5xl lg:text-6xl font-light mb-4 whitespace-pre-line leading-tight animate-reveal-up"
            style={{ animationDelay: '0.4s' }}
          >
            {currentTab.heading}
          </h1>
          <div className="gold-line mx-auto my-6 animate-reveal-up" style={{ animationDelay: '0.6s' }} />
          <p className="text-white/50 text-sm max-w-lg mx-auto animate-reveal-up" style={{ animationDelay: '0.7s' }}>
            Find your cozy escape in Pampanga. Comfort and warmth await you.
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <ChevronDown className="h-5 w-5 text-white/30" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          STICKY TABS + DATE BANNER
          ═══════════════════════════════════════════════════════════════ */}
      <div className="sticky top-20 z-30 bg-cream/95 backdrop-blur-xl border-b border-cream-warm/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          {/* Date banner */}
          {checkIn && checkOut && (
            <div className="py-3 border-b border-cream-warm/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
                    <Calendar className="h-3.5 w-3.5 text-gold" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-dark/40 font-medium">Showing availability for</p>
                    <p className="text-sm font-medium text-dark">
                      {formatDate(checkIn)} — {formatDate(checkOut)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/public')}
                  className="text-[11px] text-gold uppercase tracking-[0.1em] hover:text-gold-dark font-semibold transition-colors"
                >
                  Modify Dates
                </button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center justify-center gap-1 py-3">
            {TABS.map((tab) => {
              const count = tabCounts[tab.value as keyof typeof tabCounts]
              return (
                <button
                  key={tab.value}
                  onClick={() => setFilter(tab.value)}
                  className={`relative flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-[0.12em] whitespace-nowrap transition-all duration-300 ${
                    filter === tab.value
                      ? 'bg-dark text-gold shadow-md shadow-dark/10'
                      : 'text-dark/40 hover:text-dark/70 hover:bg-white/60'
                  }`}
                >
                  {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
                  {tab.label}
                  <span className={`text-[10px] font-bold ml-0.5 ${filter === tab.value ? 'text-gold/70' : 'text-dark/25'}`}>
                    ({count})
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          ROOM GRID
          ═══════════════════════════════════════════════════════════════ */}
      <section className="relative bg-cream pb-24 px-4">
        <div className="max-w-7xl mx-auto pt-12">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24">
              <div className="w-20 h-20 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-6">
                <BedDouble className="h-8 w-8 text-gold/50" />
              </div>
              <h3 className="font-serif text-2xl text-dark font-light mb-3">No rooms available</h3>
              <p className="text-dark/40 text-sm max-w-md mx-auto mb-8">
                We couldn't find any rooms matching your criteria. Try adjusting your dates or browse all our rooms.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => navigate('/public')}
                  className="px-6 py-2.5 border border-gold/30 text-gold text-xs font-semibold uppercase tracking-[0.12em] rounded-full hover:bg-gold hover:text-dark transition-all duration-300"
                >
                  Change Dates
                </button>
                <button
                  onClick={() => setFilter('all')}
                  className="px-6 py-2.5 bg-gold text-dark text-xs font-semibold uppercase tracking-[0.12em] rounded-full hover:bg-gold-light transition-all duration-300"
                >
                  View All Rooms
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Featured first card — full width on mobile, 2-col on desktop */}
              {filtered.length > 0 && (() => {
                const featured: any = filtered[0]
                const featPrice = featured.price_override
                  ? Number(featured.price_override)
                  : Number(featured.base_price ?? featured.price ?? 0)
                const features = (featured.amenities_json as string[] | undefined)?.slice(0, 3) || FEATURE_CHIPS.default
                return (
                  <div className="mb-8">
                    <RoomCard
                      room={featured}
                      index={0}
                      featured
                      price={featPrice}
                      fmt={fmt}
                      features={features}
                      onClick={() => goToRoom(featured.slug)}
                    />
                  </div>
                )
              })()}

              {/* Remaining cards — grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filtered.slice(1).map((rt: any, idx: number) => {
                  const price = rt.price_override
                    ? Number(rt.price_override)
                    : Number(rt.base_price ?? rt.price ?? 0)
                  const features = (rt.amenities_json as string[] | undefined)?.slice(0, 3) || FEATURE_CHIPS.default
                  return (
                    <RoomCard
                      key={rt.id}
                      room={rt}
                      index={idx + 1}
                      price={price}
                      fmt={fmt}
                      features={features}
                      onClick={() => goToRoom(rt.slug)}
                    />
                  )
                })}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ROOM CARD COMPONENT
   ═══════════════════════════════════════════════════════════════ */
function RoomCard({
  room,
  index,
  featured = false,
  price,
  fmt,
  features,
  onClick,
}: {
  room: any
  index: number
  featured?: boolean
  price: number
  fmt: (n: number) => string
  features: string[]
  onClick: () => void
}) {
  const reveal = useScrollReveal(0.05)
  const hasRooms = (room.rooms_count ?? 0) > 0

  if (featured) {
    return (
      <div
        ref={reveal.ref}
        className={`group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] border border-white/90 hover:border-gold/30 transition-all duration-500 ${reveal.className}`}
        onClick={onClick}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Image */}
          <div className="relative overflow-hidden aspect-[16/10] lg:aspect-auto lg:min-h-[400px]">
            <img
              src={room.image_url || getRoomImage(room.name, 0)}
              alt={room.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-dark/50 via-transparent to-transparent lg:bg-gradient-to-r" />
            <div className="absolute top-0 left-0 right-0 h-1 bg-gold" />
            <div className="absolute top-4 left-4 flex gap-2">
              <span className="bg-gold/90 text-dark text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg">
                Featured
              </span>
            </div>
            <div className="absolute top-4 right-4">
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full border backdrop-blur-md ${
                hasRooms
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                  : 'bg-red-500/20 text-red-300 border-red-400/30'
              }`}>
                {hasRooms ? `${room.rooms_count} Available` : 'Sold Out'}
              </span>
            </div>
            {/* Price overlay on mobile */}
            <div className="absolute bottom-0 left-0 right-0 p-6 lg:hidden">
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-gold text-3xl font-light">{fmt(price)}</span>
                  <span className="text-white/40 text-sm ml-1">/ night</span>
                </div>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="p-8 flex flex-col justify-center">
            <div className="mb-1">
              <span className="text-[10px] uppercase tracking-[0.15em] text-gold/60 font-semibold">Room Type</span>
            </div>
            <h3 className="font-serif text-2xl lg:text-3xl text-dark font-light mb-3 group-hover:text-gold transition-colors">
              {room.name}
            </h3>
            <p className="text-dark/50 text-sm leading-relaxed mb-6 line-clamp-3">
              {room.description}
            </p>

            {/* Meta */}
            <div className="flex items-center gap-2 text-xs text-dark/40 mb-5">
              <span className="flex items-center gap-1.5 bg-bg px-3 py-1.5 rounded-full">
                <Users className="h-3 w-3 text-gold/60" /> {room.max_adults} guests
              </span>
              {room.size_sqm && (
                <span className="flex items-center gap-1.5 bg-bg px-3 py-1.5 rounded-full">
                  <Maximize className="h-3 w-3 text-gold/60" /> {room.size_sqm} m²
                </span>
              )}
            </div>

            {/* Feature chips */}
            <div className="flex flex-wrap gap-2 mb-6">
              {features.map((f) => (
                <span key={f} className="flex items-center gap-1 text-[11px] text-dark/50 bg-gold/5 border border-gold/10 px-2.5 py-1 rounded-full">
                  <Sparkles className="h-2.5 w-2.5 text-gold/40" /> {f}
                </span>
              ))}
            </div>

            {/* Price + CTA */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-5">
              <div className="hidden lg:block">
                <span className="text-3xl font-light text-gold">{fmt(price)}</span>
                <span className="text-dark/30 text-sm ml-1">/ night</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onClick() }}
                className="px-6 py-2.5 bg-gold text-dark text-xs font-semibold uppercase tracking-[0.12em] rounded-full hover:bg-gold-light hover:shadow-lg hover:shadow-gold/20 transition-all duration-300 flex items-center gap-1.5"
              >
                View Details <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={reveal.ref}
      className={`group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] border border-white/90 hover:border-gold/30 transition-all duration-500 flex flex-col ${reveal.className}`}
      style={{ transitionDelay: `${(index - 1) * 0.1}s` }}
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative overflow-hidden aspect-[16/10]">
        <img
          src={room.image_url || getRoomImage(room.name, index)}
          alt={room.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark/50 via-dark/5 to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-1 bg-gold" />
        <div className="absolute top-3 right-3">
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full border backdrop-blur-md ${
            hasRooms
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
              : 'bg-red-500/20 text-red-300 border-red-400/30'
          }`}>
            {hasRooms ? `${room.rooms_count} Available` : 'Sold Out'}
          </span>
        </div>
        {/* Price overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-end justify-between">
            <span className="text-gold text-2xl font-light">{fmt(price)}</span>
            <span className="text-white/30 text-xs">/ night</span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-serif text-lg text-dark font-light mb-2 group-hover:text-gold transition-colors">
          {room.name}
        </h3>
        <p className="text-dark/50 text-sm mb-3 line-clamp-2 leading-relaxed">
          {room.description}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-2 text-xs text-dark/40 mb-3">
          <span className="flex items-center gap-1.5 bg-bg px-2.5 py-1 rounded-full">
            <Users className="h-3 w-3 text-gold/60" /> {room.max_adults} guests
          </span>
          {room.size_sqm && (
            <span className="flex items-center gap-1.5 bg-bg px-2.5 py-1 rounded-full">
              <Maximize className="h-3 w-3 text-gold/60" /> {room.size_sqm} m²
            </span>
          )}
        </div>

        {/* Features */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {features.slice(0, 2).map((f) => (
            <span key={f} className="text-[10px] text-dark/40 bg-gold/5 px-2 py-0.5 rounded-full">
              {f}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="border-t border-gray-100 pt-3 mt-auto">
          <button
            onClick={(e) => { e.stopPropagation(); onClick() }}
            className="w-full py-2.5 bg-gold/10 text-gold text-xs font-semibold uppercase tracking-[0.12em] rounded-full hover:bg-gold hover:text-dark transition-all duration-300 flex items-center justify-center gap-1.5"
          >
            View Details <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
