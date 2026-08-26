import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { usePublicRoomTypes, useHotelName, usePublicSettings, useBrandingSettings, usePublicReservations, usePublicConfirmOnlinePayment, usePaymentSettings } from '@/hooks/usePublicApi'
import { usePublicAuthStore } from '@/stores/publicAuthStore'
import { buildHeroImages, buildGalleryPhotos, stringSetting, replaceHotelName } from '@/lib/branding'
import { toLocalDateStr } from '@/lib/format'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { GuestsPicker } from '@/components/ui/guests-picker'
import { ArrowRight, Users, Maximize, Search, Waves, UtensilsCrossed, Camera, Wifi, Car, Star, Building2, CheckCircle, AlertTriangle, Clock, X } from 'lucide-react'

const ROOM_IMAGES: Record<string, string[]> = {
  rooms: [
    'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=900&h=550&fit=crop',
    'https://images.unsplash.com/photo-1590490360182-c33d7e6db52e?w=900&h=550&fit=crop',
    'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&h=550&fit=crop',
  ],
  suites: [
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=900&h=550&fit=crop',
    'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=900&h=550&fit=crop',
    'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=900&h=550&fit=crop',
  ],
  villas: [
    'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=900&h=550&fit=crop',
    'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=900&h=550&fit=crop',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&h=550&fit=crop',
  ],
}

const TAB_DATA = [
  {
    key: 'rooms',
    label: 'Rooms',
    heading: 'Simple & Cozy',
    featured: 'Standard Room',
    description: 'Comfortable and thoughtfully designed for a relaxing stay. Each room comes with everything you need.',
    filterFn: (name: string) => name.includes('room') || name.includes('deluxe'),
  },
  {
    key: 'suites',
    label: 'Family Rooms',
    heading: 'Perfect for Families',
    featured: 'Family Room',
    description: 'Plenty of space for the whole family. Easy to unwind after a day out exploring Pampanga.',
    filterFn: (name: string) => name.includes('suite') || name.includes('family'),
  },
]

function getRoomImage(name: string, index: number): string {
  const lower = name.toLowerCase()
  if (lower.includes('villa')) return ROOM_IMAGES.villas[index % ROOM_IMAGES.villas.length]
  if (lower.includes('suite')) return ROOM_IMAGES.suites[index % ROOM_IMAGES.suites.length]
  return ROOM_IMAGES.rooms[index % ROOM_IMAGES.rooms.length]
}

export default function PublicHomePage() {
  const navigate = useNavigate()
  const hotelName = useHotelName()
  const branding = useBrandingSettings()
  const heroImages = useMemo(() => buildHeroImages(branding), [branding])
  const galleryPhotos = useMemo(() => buildGalleryPhotos(branding, hotelName), [branding, hotelName])
  const heroBadge = replaceHotelName(stringSetting(branding, 'hero_badge', `Welcome to ${hotelName}`), hotelName)
  const heroTitle = stringSetting(branding, 'hero_title', 'Comfortable Stays, Warm Smiles')
  const heroSubtitle = stringSetting(
    branding,
    'hero_subtitle',
    'Experience warm Filipino hospitality right here in Pampanga. Every stay feels like coming home.'
  )
  const heroCtaLabel = stringSetting(branding, 'hero_cta_label', 'Explore Stays')
  const sectionDiscoverTitle = stringSetting(branding, 'section_discover_title', 'Discover Our World')
  const sectionWhyTitle = stringSetting(branding, 'section_why_title', 'Why Stay With Us')
  const sectionAmenitiesTitle = stringSetting(branding, 'section_amenities_title', 'Comforts of Home')
  const sectionGalleryTitle = replaceHotelName(
    stringSetting(branding, 'section_gallery_title', `A Glimpse of ${hotelName}`),
    hotelName
  )
  const [activeTab, setActiveTab] = useState(0)
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [guests, setGuests] = useState({ rooms: 1, adults: 1, children: 0 })
  const [heroSlide, setHeroSlide] = useState(0)
  const [searchParams, setSearchParams] = useSearchParams()
  const [paymentNoticeDismissed, setPaymentNoticeDismissed] = useState(false)
  const [settleAttempted, setSettleAttempted] = useState(false)
  const [settleState, setSettleState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle')
  const bookingRef = searchParams.get('booking_ref')
  const payStatus = searchParams.get('status')
  const showPaymentNotice = !!bookingRef && !!payStatus && !paymentNoticeDismissed
  const { token } = usePublicAuthStore()
  const { data: reservationData } = usePublicReservations()
  const confirmOnline = usePublicConfirmOnlinePayment()
  const paymentSettings = usePaymentSettings()
  const selfSettleEnabled = paymentSettings['online_gateway_self_settle'] === '1' || paymentSettings['online_gateway_self_settle'] === true
  const myReservations = useMemo(() => reservationData?.data ?? [], [reservationData])
  const { data: roomTypes } = usePublicRoomTypes()
  const { data: bookingSettings } = usePublicSettings('booking')

  const maxAdvanceDays = useMemo(() => {
    const raw = (bookingSettings as Record<string, string> | undefined)?.max_advance_days
    return raw ? Number(raw) : 30
  }, [bookingSettings])

  const maxDate = useMemo(() => {
    if (maxAdvanceDays <= 0) return undefined
    const d = new Date()
    d.setDate(d.getDate() + maxAdvanceDays)
    return toLocalDateStr(d)
  }, [maxAdvanceDays])

  const currentTab = TAB_DATA[activeTab]
  const filteredRooms = (roomTypes || []).filter((rt: any) =>
    currentTab.filterFn(rt.name || '')
  )
  const featuredRoom = filteredRooms[0] || null

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroSlide((prev) => (prev + 1) % heroImages.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [heroImages.length])

  useEffect(() => {
    if (!showPaymentNotice || payStatus !== 'success' || !bookingRef || !token || settleAttempted) return
    if (settleState === 'pending') return
    if (!selfSettleEnabled) return

    const reservation = myReservations.find((r) => r.reservation_number === bookingRef)
    if (!reservation) return
    if (reservation.payment_status === 'paid' || reservation.due_amount <= 0) {
      setSettleAttempted(true)
      setSettleState('done')
      return
    }

    setSettleAttempted(true)
    setSettleState('pending')
    confirmOnline.mutate(reservation.id, {
      onSuccess: () => {
        setSettleState('done')
      },
      onError: () => {
        setSettleState('error')
      },
    })
  }, [showPaymentNotice, payStatus, bookingRef, token, settleAttempted, settleState, selfSettleEnabled, myReservations, confirmOnline])

  return (
    <div>
      {/* Payment redirect-back notice (from online payment partner) */}
      {showPaymentNotice && (
        <div className="fixed top-0 inset-x-0 z-[60] px-4 py-3 flex items-center gap-3 bg-black/95 border-b border-white/10">
          {payStatus === 'success' && settleState === 'done' ? (
            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
          ) : payStatus === 'success' && settleState === 'pending' ? (
            <Clock className="h-5 w-5 text-sky-400 shrink-0 animate-pulse" />
          ) : payStatus === 'failed' || payStatus === 'cancelled' ? (
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          ) : (
            <Clock className="h-5 w-5 text-sky-400 shrink-0" />
          )}
          <p className="text-sm text-white/80 flex-1">
            {payStatus === 'success' && settleState === 'done'
              ? `Payment confirmed for ${bookingRef}. Thank you!`
              : payStatus === 'success' && settleState === 'pending'
                ? `Payment received for ${bookingRef}. Confirming your booking...`
                : payStatus === 'success' && settleState === 'error'
                  ? `Payment received for ${bookingRef}. It will be confirmed shortly.`
                  : payStatus === 'failed' || payStatus === 'cancelled'
                    ? `Payment for ${bookingRef} was not completed.`
                    : `Payment received for ${bookingRef}. Thank you!`}
          </p>
          {(payStatus === 'success' && settleState !== 'pending') && (
            <Link
              to="/public/my-reservations"
              className="shrink-0 text-xs font-semibold uppercase tracking-wider text-gold hover:text-gold/80 transition-colors"
            >
              View booking
            </Link>
          )}
          <button
            onClick={() => {
              setPaymentNoticeDismissed(true)
              const next = new URLSearchParams(searchParams)
              next.delete('booking_ref')
              next.delete('status')
              setSearchParams(next, { replace: true })
            }}
            className="shrink-0 rounded-lg p-1 text-white/30 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Dismiss notice"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: HERO
          ═══════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen md:h-screen w-full overflow-hidden">
        {/* Slideshow background */}
        {heroImages.map((src, i) => (
          <div
            key={i}
            className="absolute inset-0 z-0 transition-opacity duration-1000"
            style={{ opacity: i === heroSlide ? 1 : 0 }}
          >
            <img
              src={src}
              alt={`${hotelName} ${i + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-dark/70 via-dark/40 to-dark/80" />

        <div className="relative z-10 flex flex-col items-center justify-start h-full pt-32 md:pt-40">
          <div className="w-full max-w-4xl mx-auto px-4 text-center">
            <p className="section-subtitle mb-5 animate-reveal-up" style={{ animationDelay: '0.2s' }}>
              {heroBadge}
            </p>
            <h1
              className="font-serif text-white text-5xl sm:text-6xl lg:text-7xl font-light leading-[1.15] mb-6 animate-reveal-up"
              style={{ animationDelay: '0.4s' }}
            >
              {heroTitle}
            </h1>
            <div className="gold-line mx-auto mb-8 animate-reveal-up" style={{ animationDelay: '0.6s' }} />
            <p
              className="text-white/40 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-10 animate-reveal-up"
              style={{ animationDelay: '0.7s' }}
            >
              {heroSubtitle}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-reveal-up" style={{ animationDelay: '0.9s' }}>
              <button
                onClick={() => navigate('/public/rooms')}
                className="btn-gold inline-flex items-center gap-2"
              >
                {heroCtaLabel} <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* Slide dots */}
            <div className="flex items-center justify-center gap-2 mt-10 animate-reveal-up" style={{ animationDelay: '1.1s' }}>
              {heroImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroSlide(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    i === heroSlide ? 'bg-gold w-6' : 'bg-white/30 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Booking Widget */}
        <div className="relative mt-10 md:mt-0 md:absolute md:inset-x-0 md:bottom-[15%] md:z-30">
          <div className="max-w-4xl mx-auto px-4">
            <div className="bg-dark/80 backdrop-blur-xl border border-gold/20 rounded-2xl p-5 flex flex-col md:flex-row gap-3 items-end shadow-2xl shadow-black/40">
              <div className="flex-[2] w-full">
                <label className="text-xs text-gold/50 uppercase tracking-[0.15em] block mb-1.5 font-medium">Date</label>
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  max={maxDate}
                  placeholder="Select Date Range"
                />
              </div>
              <div className="flex-[2] w-full">
                <label className="text-xs text-gold/50 uppercase tracking-[0.15em] block mb-1.5 font-medium">Guests</label>
                <GuestsPicker
                  value={guests}
                  onChange={setGuests}
                />
              </div>
               <button
                 onClick={() => {
                   const params = new URLSearchParams()
                   if (dateRange.from) params.set('check_in', dateRange.from)
                   if (dateRange.to) params.set('check_out', dateRange.to)
                   params.set('rooms', String(guests.rooms))
                   params.set('adults', String(guests.adults))
                   params.set('children', String(guests.children))
                   window.location.href = `/public/rooms?${params.toString()}`
                 }}
                 className="btn-gold w-full md:w-auto flex items-center justify-center gap-2 shrink-0 h-10"
                 type="button"
               >
                 <Search className="h-4 w-4" />
                 Check Availability
               </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: ROOM TABS
          ═══════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 bg-cream py-28 md:py-36">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cream-warm/40 via-cream to-cream pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="section-subtitle mb-4">Accommodations</p>
            <h2 className="font-serif text-dark text-4xl sm:text-5xl lg:text-6xl font-light leading-tight">
              {sectionDiscoverTitle}
            </h2>
            <div className="w-12 h-px bg-gold mx-auto mt-6" />
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap justify-center gap-3 sm:gap-6 mb-16">
            {TAB_DATA.map((tab, idx) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(idx)}
                className={`px-6 py-2.5 text-xs font-medium uppercase tracking-[0.22em] rounded-full transition-all duration-300 ${
                  activeTab === idx
                    ? 'bg-dark text-cream shadow-lg'
                    : 'text-dark/40 hover:text-dark/70 hover:bg-dark/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Featured Room Image */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-dark/10">
              <img
                src={featuredRoom
                  ? (featuredRoom.image_url || getRoomImage(featuredRoom.name, 0))
                  : ROOM_IMAGES[activeTab === 0 ? 'rooms' : 'suites'][0]
                }
                alt={currentTab.featured}
                className="w-full h-[480px] lg:h-[600px] object-cover transition-transform duration-700 hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark/40 via-transparent to-transparent" />
              {featuredRoom && (
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <div className="inline-block bg-dark/60 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/10">
                    <p className="font-serif text-white text-lg font-light tracking-wide">{featuredRoom.name}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Featured Room Info */}
            <div className="max-w-lg">
              <h3 className="font-serif text-dark text-3xl sm:text-4xl font-light leading-[1.2] mb-6">
                {currentTab.heading}
              </h3>
              <p className="text-dark/55 text-base leading-relaxed mb-8">
                {featuredRoom?.description || currentTab.description}
              </p>
              <div className="w-10 h-px bg-gold/60 mb-8" />
              {featuredRoom && (
                <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mb-10">
                  <span className="flex items-center gap-2.5 text-sm text-dark/50">
                    <span className="w-8 h-8 rounded-full bg-dark/5 flex items-center justify-center"><Users className="h-3.5 w-3.5 text-gold-dark" /></span>
                    Up to {featuredRoom.max_adults} guests
                  </span>
                  <span className="flex items-center gap-2.5 text-sm text-dark/50">
                    <span className="w-8 h-8 rounded-full bg-dark/5 flex items-center justify-center"><Maximize className="h-3.5 w-3.5 text-gold-dark" /></span>
                    {featuredRoom.size_sqm} m²
                  </span>
                  <span className="flex items-center gap-2.5 text-sm text-dark/50">
                    <span className="w-8 h-8 rounded-full bg-dark/5 flex items-center justify-center"><Star className="h-3.5 w-3.5 text-gold-dark" /></span>
                    Premium class
                  </span>
                </div>
              )}
              <button
                onClick={() => navigate('/public/rooms')}
                className="btn-gold-outline inline-flex items-center gap-2"
              >
                View All {currentTab.label} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3: WHY CHOOSE US
          ═══════════════════════════════════════════════════════════════ */}
      <section className="relative bg-dark py-24 md:py-32 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-dark/80 via-dark to-dark" />

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="section-subtitle mb-4">Why Choose Us</p>
            <h2 className="section-heading">{sectionWhyTitle}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Waves, title: 'Swimming Pool', desc: 'Cool off and relax by our refreshing pool.', img: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&h=700&fit=crop' },
              { icon: UtensilsCrossed, title: 'Restaurant', desc: 'Enjoy delicious meals at our on-site restaurant.', img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=700&fit=crop' },
              { icon: Wifi, title: 'Free Wi-Fi', desc: 'Stay connected with complimentary high-speed internet.', img: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&h=700&fit=crop' },
              { icon: Car, title: 'Free Parking', desc: 'Convenient parking for all our guests.', img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=700&fit=crop' },
            ].map((item) => (
              <div key={item.title} className="group relative rounded-2xl overflow-hidden h-[420px]">
                <img src={item.img} alt={item.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-dark/90 via-dark/30 to-dark/20 group-hover:from-dark/80 transition-all duration-500" />
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center mb-4">
                    <item.icon className="h-5 w-5 text-gold" />
                  </div>
                  <h3 className="font-serif text-white text-xl font-light mb-2">{item.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-16 h-px bg-gold/40 mx-auto mt-24 relative z-10" />
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 4: GALLERY PREVIEW
          ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-dark pb-24 md:pb-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-14">
            <div>
              <p className="section-subtitle mb-4">Gallery</p>
              <h2 className="section-heading">{sectionGalleryTitle}</h2>
            </div>
            <button
              onClick={() => navigate('/public/gallery')}
              className="btn-gold-outline mt-6 md:mt-0 inline-flex items-center gap-2 shrink-0"
            >
              View Full Gallery <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {galleryPhotos.slice(0, 6).map((photo) => (
              <div key={photo.id} className="group relative rounded-2xl overflow-hidden aspect-[4/3] bg-white/5 cursor-pointer" onClick={() => navigate('/public/gallery')}>
                <img
                  src={photo.src}
                  alt={photo.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-5 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                  <div className="flex items-center gap-2.5">
                    <Camera className="h-4 w-4 text-gold" />
                    <span className="text-white text-sm font-medium">{photo.title}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 5: AMENITIES
          ═══════════════════════════════════════════════════════════════ */}
      <section className="relative bg-dark py-24 md:py-32 px-4 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="section-subtitle mb-4">Amenities</p>
            <h2 className="section-heading">{sectionAmenitiesTitle}</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            {[
              { icon: Waves, label: 'Swimming Pool', desc: 'Relax and unwind' },
              { icon: UtensilsCrossed, label: 'Restaurant', desc: 'On-site dining' },
              { icon: Wifi, label: 'Free Wi-Fi', desc: 'Stay connected' },
              { icon: Car, label: 'Free Parking', desc: 'For all guests' },
              { icon: Building2, label: 'Event Hall', desc: 'For gatherings' },
              { icon: Star, label: 'Cozy Lounge', desc: 'Perfect place to unwind' },
            ].map((item) => (
              <div key={item.label} className="group text-center p-8 rounded-2xl border border-white/5 hover:border-gold/20 hover:bg-white/[0.02] transition-all duration-500">
                <div className="w-14 h-14 rounded-full bg-gold/5 border border-gold/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-gold/15 group-hover:border-gold/30 transition-all duration-500">
                  <item.icon className="h-6 w-6 text-gold" />
                </div>
                <h3 className="text-white text-sm font-medium mb-2">{item.label}</h3>
                <p className="text-white/50 text-xs">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="w-16 h-px bg-gold/40 mx-auto mt-24 relative z-10" />
      </section>
    </div>
  )
}
