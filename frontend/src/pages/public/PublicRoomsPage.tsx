import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePublicRoomTypes, usePortalCurrency } from '@/hooks/usePublicApi'
import { formatCurrencyWith } from '@/lib/format'
import { Users, Maximize, ArrowRight, Calendar, BedDouble, Sofa } from 'lucide-react'

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
  { value: 'all', label: 'All', heading: 'Our Rooms\n& Suites' },
  { value: 'rooms', label: 'Rooms', heading: 'Cozy\nRooms', icon: BedDouble },
  { value: 'suites', label: 'Suites', heading: 'Spacious\nSuites', icon: Sofa },
]

function getRoomImage(name: string, index: number): string {
  const lower = name.toLowerCase()
  if (lower.includes('villa')) return ROOM_IMAGES.villas[index % ROOM_IMAGES.villas.length]
  if (lower.includes('suite')) return ROOM_IMAGES.suites[index % ROOM_IMAGES.suites.length]
  return ROOM_IMAGES.rooms[index % ROOM_IMAGES.rooms.length]
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

  const currentTab = TABS.find((t) => t.value === filter) || TABS[0]

  function goToRoom(slug: string) {
    const q = new URLSearchParams()
    if (checkIn) q.set('check_in', checkIn)
    if (checkOut) q.set('check_out', checkOut)
    navigate(`/public/rooms/${slug}?${q.toString()}`)
  }

  return (
    <div>
      {/* ═══════════════════════════════════════════════════════════════
          HERO
          ═══════════════════════════════════════════════════════════════ */}
      <section className="relative h-[50vh] min-h-[400px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1920&h=800&fit=crop"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-dark/70" />
        </div>
        <div className="relative z-10 text-center px-4">
          <p className="section-subtitle mb-4">Accommodations</p>
          <h1 className="font-serif text-white text-4xl sm:text-5xl lg:text-6xl font-light mb-4 whitespace-pre-line">
            {currentTab.heading}
          </h1>
          <div className="gold-line mx-auto my-6" />
          <p className="text-white/50 text-sm max-w-lg mx-auto">
            Find your cozy escape in Pampanga. Comfort and warmth await you.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          STICKY PILL TABS
          ═══════════════════════════════════════════════════════════════ */}
      <div className="sticky top-20 z-30 bg-cream/90 backdrop-blur-xl border-b border-cream-warm/50">
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-4">
          <div className="grid grid-cols-2 gap-2 md:flex md:justify-center md:gap-3">
            {TABS.map((tab) => {
              return (
                <button
                  key={tab.value}
                  onClick={() => setFilter(tab.value)}
                  className={`flex items-center justify-center gap-2 px-4 md:px-5 py-3 md:py-2.5 rounded-full text-xs font-semibold uppercase tracking-[0.15em] whitespace-nowrap w-full md:w-auto transition-all duration-300 ${
                    filter === tab.value
                      ? 'bg-gold text-dark shadow-md shadow-gold/20'
                      : 'bg-white/50 text-dark/50 hover:bg-white hover:text-dark border border-transparent'
                  }`}
                >
                  {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MAIN CONTENT
          ═══════════════════════════════════════════════════════════════ */}
      <section className="relative bg-cream pb-20 px-4 -mt-px">
        <div className="max-w-7xl mx-auto pt-10">
          {/* Date indicator banner */}
          {checkIn && checkOut && (
            <div className="bg-white/70 backdrop-blur-sm border border-gold/20 rounded-xl px-6 py-4 mb-10 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gold/10 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-gold" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-dark/40">Availability for</p>
                  <p className="text-sm font-medium text-dark">
                    {new Date(checkIn + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {new Date(checkOut + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/public')}
                className="text-xs text-gold uppercase tracking-[0.1em] hover:underline font-medium"
              >
                Change Dates
              </button>
            </div>
          )}

          {/* Room Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-dark/5 h-64 rounded-xl mb-5" />
                  <div className="bg-dark/5 h-5 rounded w-3/4 mb-3" />
                  <div className="bg-dark/5 h-4 rounded w-full mb-2" />
                  <div className="bg-dark/5 h-4 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-dark/40 text-lg font-light">No rooms found matching your criteria.</p>
              <button onClick={() => setFilter('all')} className="text-gold text-sm mt-4 hover:underline">View all rooms</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filtered.map((rt: any, index: number) => {
                const isFeatured = index === 0
                return (
                  <div
                    key={rt.id}
                    onClick={() => goToRoom(rt.slug)}
                    className="group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl border border-white/90 hover:border-gold/30 transition-all duration-500 flex flex-col"
                  >
                    {/* Room Image */}
                    <div className="relative overflow-hidden aspect-[16/9]">
                      <img
                        src={rt.image_url || getRoomImage(rt.name, index)}
                        alt={rt.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-dark/50 via-transparent to-transparent" />
                      {isFeatured && (
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-gold/5 to-transparent pointer-events-none" />
                      )}
                      <div className="absolute top-4 right-4 bg-dark/70 backdrop-blur-md text-white text-[10px] font-semibold px-3 py-1.5 rounded-full uppercase tracking-wider border border-white/10">
                        {rt.rooms_count > 0 ? `${rt.rooms_count} Available` : 'Sold Out'}
                      </div>
                      {isFeatured && (
                        <div className="absolute top-4 left-4 bg-gold text-dark text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-lg">
                          Featured
                        </div>
                      )}
                    </div>

                    {/* Room Info */}
                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="font-serif text-xl text-dark font-light mb-2 group-hover:text-gold transition-colors">
                        {rt.name}
                      </h3>
                      <p className="text-dark/60 text-sm mb-4 line-clamp-2 leading-relaxed">
                        {rt.description}
                      </p>

                      {/* Room Meta */}
                      <div className="flex items-center gap-2 text-xs text-dark/40 mb-4">
                        <span className="flex items-center gap-1.5 bg-dark/5 px-2.5 py-1 rounded-full">
                          <Users className="h-3 w-3 text-gold/60" /> {rt.max_adults} guests
                        </span>
                        <span className="flex items-center gap-1.5 bg-dark/5 px-2.5 py-1 rounded-full">
                          <Maximize className="h-3 w-3 text-gold/60" /> {rt.size_sqm} m²
                        </span>
                      </div>

                      {/* Price + CTA */}
                      <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-auto">
                        <button
                          onClick={(e) => { e.stopPropagation(); goToRoom(rt.slug) }}
                          className="btn-gold-sm flex items-center gap-1.5"
                        >
                          View Details <ArrowRight className="h-3 w-3" />
                        </button>
                        <div className="flex items-center gap-1 py-1">
                          <span className="text-2xl font-semibold text-gold leading-none">{fmt(rt.base_price)}</span>
                          <span className="text-dark/30 text-xs leading-none">/ night</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
