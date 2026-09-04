import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { usePublicRoomTypes, useHotelName, usePublicSettings, useBrandingSettings, usePublicReservations, usePublicConfirmOnlinePayment, usePaymentSettings, usePortalCurrency } from '@/hooks/usePublicApi'
import { usePublicAuthStore } from '@/stores/publicAuthStore'
import { buildHeroImages, buildGalleryPhotos, stringSetting, replaceHotelName } from '@/lib/branding'
import { toLocalDateStr, formatCurrencyWith } from '@/lib/format'
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

function getRoomImage(name: string, index: number): string {
  const lower = name.toLowerCase()
  if (lower.includes('villa')) return ROOM_IMAGES.villas[index % ROOM_IMAGES.villas.length]
  if (lower.includes('suite')) return ROOM_IMAGES.suites[index % ROOM_IMAGES.suites.length]
  return ROOM_IMAGES.rooms[index % ROOM_IMAGES.rooms.length]
}

function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, className: `reveal-hidden ${visible ? 'reveal-visible' : ''}` }
}

function WaveDivider({ fill, flip = false, className = '' }: { fill: string; flip?: boolean; className?: string }) {
  return (
    <div className={`absolute left-0 right-0 z-10 pointer-events-none ${flip ? 'top-0 rotate-180' : 'bottom-0'} ${className}`}>
      <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-[50px] md:h-[80px]" preserveAspectRatio="none">
        <path d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,50 1440,40 L1440,80 L0,80 Z" fill={fill} />
      </svg>
    </div>
  )
}

function WhyChooseSection({ title }: { title: string }) {
  const sectionReveal = useScrollReveal(0.1)
  const [activeFeature, setActiveFeature] = useState(0)
  const [imageOffset, setImageOffset] = useState(0)
  const imgRef = useRef<HTMLDivElement>(null)
  const WHY_FEATURES = [
    { icon: Waves, title: 'Swimming Pool', desc: 'Cool off and relax by our refreshing pool — the perfect escape from the tropical heat.', img: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=1000&fit=crop' },
    { icon: UtensilsCrossed, title: 'Restaurant', desc: 'Savor delicious Filipino and international cuisine at our on-site restaurant.', img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=1000&fit=crop' },
    { icon: Wifi, title: 'Free Wi-Fi', desc: 'Stay connected with complimentary high-speed internet throughout the property.', img: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&h=1000&fit=crop' },
    { icon: Car, title: 'Free Parking', desc: 'Enjoy convenient and secure parking at no extra cost for all our guests.', img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=1000&fit=crop' },
  ]

  useEffect(() => {
    const handleScroll = () => {
      if (!imgRef.current) return
      const rect = imgRef.current.getBoundingClientRect()
      const viewH = window.innerHeight
      if (rect.top < viewH && rect.bottom > 0) {
        const progress = (viewH - rect.top) / (viewH + rect.height)
        setImageOffset((progress - 0.5) * 40)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <section ref={sectionReveal.ref} className={`relative bg-dark py-24 md:py-32 px-4 overflow-hidden ${sectionReveal.className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-dark/80 via-dark to-dark" />
      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <p className="section-subtitle mb-4">Why Choose Us</p>
          <h2 className="section-heading">{title}</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div ref={imgRef} className="relative rounded-2xl overflow-hidden aspect-[4/5] lg:aspect-[3/4] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
            {WHY_FEATURES.map((feat, i) => (
              <img
                key={feat.title}
                src={feat.img}
                alt={feat.title}
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
                  i === activeFeature ? 'opacity-100 scale-105' : 'opacity-0 scale-100'
                }`}
                style={i === activeFeature ? { transform: `scale(1.05) translateY(${imageOffset}px)` } : undefined}
              />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-dark/50 via-transparent to-dark/10" />
            <div className="absolute inset-0 border border-gold/10 rounded-2xl" />
            <div className="absolute top-5 left-5 font-serif text-6xl font-light text-gold/20">
              0{activeFeature + 1}
            </div>
          </div>
          <div className="space-y-4">
            {WHY_FEATURES.map((feat, i) => {
              const isActive = i === activeFeature
              return (
                <div
                  key={feat.title}
                  className={`group flex items-start gap-5 p-6 rounded-2xl cursor-pointer transition-all duration-500 ${
                    isActive
                      ? 'bg-white/[0.06] border border-gold/20 shadow-[0_0_30px_-10px_rgba(192,160,98,0.15)]'
                      : 'border border-transparent hover:bg-white/[0.03]'
                  }`}
                  onMouseEnter={() => setActiveFeature(i)}
                >
                  <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 ${
                    isActive
                      ? 'bg-gold/15 border border-gold/30'
                      : 'bg-white/5 border border-white/5 group-hover:bg-gold/10 group-hover:border-gold/15'
                  }`}>
                    <feat.icon className={`h-5 w-5 transition-colors duration-500 ${isActive ? 'text-gold' : 'text-white/40 group-hover:text-gold/70'}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold tracking-wider transition-colors duration-500 ${isActive ? 'text-gold' : 'text-white/20 group-hover:text-gold/40'}`}>
                        0{i + 1}
                      </span>
                      <h3 className={`font-serif text-lg font-light transition-colors duration-500 ${isActive ? 'text-white' : 'text-white/60 group-hover:text-white/80'}`}>
                        {feat.title}
                      </h3>
                    </div>
                    <p className={`text-sm leading-relaxed mt-1 transition-colors duration-500 ${isActive ? 'text-white/50' : 'text-white/30'}`}>
                      {feat.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="w-16 h-px bg-gold/40 mx-auto mt-24 relative z-10" />
    </section>
  )
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
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [guests, setGuests] = useState({ rooms: 1, adults: 1, children: 0 })
  const [heroSlide, setHeroSlide] = useState(0)
  const [searchParams, setSearchParams] = useSearchParams()
  const [paymentNoticeDismissed, setPaymentNoticeDismissed] = useState(false)
  const [settleAttempted, setSettleAttempted] = useState(false)
  const [settleState, setSettleState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle')
  const currency = usePortalCurrency()
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
              className={`w-full h-full object-cover ${i === heroSlide ? 'animate-ken-burns' : 'scale-100'}`}
              style={i === heroSlide ? { animationDuration: '8s' } : undefined}
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
      <WaveDivider fill="var(--color-cream)" />

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: ACCOMMODATIONS — staggered card grid + scroll reveal
          ═══════════════════════════════════════════════════════════════ */}
      {(() => {
        const sectionReveal = useScrollReveal(0.1)
        const displayRooms = (roomTypes || []).slice(0, 5)
        return (
          <>
          <section ref={sectionReveal.ref} className={`relative z-10 bg-cream py-28 md:py-36 ${sectionReveal.className}`}>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cream-warm/40 via-cream to-cream pointer-events-none" />
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <p className="section-subtitle mb-4">Accommodations</p>
                <h2 className="font-serif text-dark text-4xl sm:text-5xl lg:text-6xl font-light leading-tight">
                  {sectionDiscoverTitle}
                </h2>
                <div className="w-12 h-px bg-gold mx-auto mt-6" />
                {displayRooms.length > 0 && (
                  <p className="text-dark/40 text-sm mt-4">Starting from {formatCurrencyWith(
                    Math.min(...displayRooms.map((r: any) => r.price_override ? Number(r.price_override) : Number(r.base_price ?? r.price ?? 0)).filter((p: number) => p > 0)),
                    currency
                  )} / night</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {displayRooms.length > 0 && (() => {
                  const heroRoom: any = displayRooms[0]
                  const heroPrice = heroRoom.price_override
                    ? Number(heroRoom.price_override)
                    : Number(heroRoom.base_price ?? heroRoom.price ?? 0)
                  return (
                    <Link
                      to={`/public/rooms?room_type=${heroRoom.slug || heroRoom.id}`}
                      className="group block rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] transition-all duration-500 md:row-span-2 animate-shimmer"
                      style={{ transitionDelay: '0.1s' }}
                    >
                      <div className="relative overflow-hidden aspect-[4/5] sm:aspect-[3/4]">
                        <img
                          src={heroRoom.image_url || getRoomImage(heroRoom.name, 0)}
                          alt={heroRoom.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-dark/60 via-dark/10 to-transparent" />
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gold" />
                        <div className="absolute top-4 left-4">
                          <span className="bg-gold/90 text-dark text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">Featured</span>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-8">
                          <p className="font-serif text-white text-3xl sm:text-4xl font-light mb-3">{heroRoom.name}</p>
                          {heroRoom.description && (
                            <p className="text-white/60 text-sm leading-relaxed mb-4 line-clamp-2">{heroRoom.description}</p>
                          )}
                          <div className="flex items-center gap-6 mb-5">
                            {heroRoom.max_adults && (
                              <span className="flex items-center gap-2 text-white/70 text-sm">
                                <Users className="h-4 w-4 text-gold" /> Up to {heroRoom.max_adults} guests
                              </span>
                            )}
                            {heroRoom.size_sqm && (
                              <span className="flex items-center gap-2 text-white/70 text-sm">
                                <Maximize className="h-4 w-4 text-gold" /> {heroRoom.size_sqm} m²
                              </span>
                            )}
                          </div>
                          <div className="flex items-end justify-between">
                            <div>
                              <span className="text-gold text-2xl font-light">{formatCurrencyWith(heroPrice, currency)}</span>
                              <span className="text-white/40 text-sm ml-1">/ night</span>
                            </div>
                            <span className="flex items-center gap-1.5 bg-gold/90 text-dark text-xs font-semibold px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                              View Details <ArrowRight className="h-3 w-3" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })()}
                {displayRooms.slice(1).map((rt: any, idx: number) => {
                  const price = rt.price_override
                    ? Number(rt.price_override)
                    : Number(rt.base_price ?? rt.price ?? 0)
                  return (
                    <Link
                      key={rt.id}
                      to={`/public/rooms?room_type=${rt.slug || rt.id}`}
                      className="group block rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] transition-all duration-500"
                      style={{ transitionDelay: `${(idx + 1) * 0.1}s` }}
                    >
                      <div className="relative overflow-hidden aspect-[4/3]">
                        <img
                          src={rt.image_url || getRoomImage(rt.name, 0)}
                          alt={rt.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-dark/60 via-dark/10 to-transparent" />
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gold" />
                        <div className="absolute bottom-0 left-0 right-0 p-6">
                          <p className="font-serif text-white text-xl sm:text-2xl font-light mb-2">{rt.name}</p>
                          <div className="flex items-center gap-4 mb-3">
                            {rt.max_adults && (
                              <span className="flex items-center gap-1.5 text-white/60 text-xs">
                                <Users className="h-3 w-3 text-gold" /> {rt.max_adults} guests
                              </span>
                            )}
                            {rt.size_sqm && (
                              <span className="flex items-center gap-1.5 text-white/60 text-xs">
                                <Maximize className="h-3 w-3 text-gold" /> {rt.size_sqm} m²
                              </span>
                            )}
                          </div>
                          <div className="flex items-end justify-between">
                            <span className="text-gold text-lg font-light">{formatCurrencyWith(price, currency)}</span>
                            <span className="flex items-center gap-1 text-gold text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              View <ArrowRight className="h-3 w-3" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>

              <div className="text-center mt-14">
                <button
                  onClick={() => navigate('/public/rooms')}
                  className="btn-gold-outline inline-flex items-center gap-2"
                >
                  View All Rooms <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
          <WaveDivider fill="var(--color-dark)" />
          </>
        )
      })()}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3: WHY CHOOSE US — split layout with parallax + numbered features
          ═══════════════════════════════════════════════════════════════ */}
      <WhyChooseSection title={sectionWhyTitle} />

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 4: GALLERY PREVIEW — masonry + category chips + scroll reveal
          ═══════════════════════════════════════════════════════════════ */}
      {(() => {
        const galleryReveal = useScrollReveal(0.1)
        const photos = galleryPhotos.slice(0, 5)
        return (
          <section ref={galleryReveal.ref} className={`bg-dark pb-24 md:pb-32 px-4 ${galleryReveal.className}`}>
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-14">
                <div>
                  <p className="section-subtitle mb-4">Gallery</p>
                  <h2 className="section-heading">{sectionGalleryTitle}</h2>
                </div>
                <div className="flex items-center gap-4 mt-6 md:mt-0">
                  <span className="text-white/30 text-sm">{galleryPhotos.length} Photos</span>
                  <button
                    onClick={() => navigate('/public/gallery')}
                    className="btn-gold-outline inline-flex items-center gap-2 shrink-0"
                  >
                    View Full Gallery <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="hidden md:grid grid-cols-3 grid-rows-2 gap-4" style={{ height: '520px' }}>
                {photos.map((photo, i) => (
                  <div
                    key={photo.id}
                    className={`group relative rounded-2xl overflow-hidden bg-white/5 cursor-pointer transition-all duration-500 hover:shadow-[0_0_30px_-5px_rgba(192,160,98,0.3)] hover:border hover:border-gold/20 ${
                      i === 0 ? 'col-span-2 row-span-2' : ''
                    }`}
                    onClick={() => navigate('/public/gallery')}
                  >
                    <img
                      src={photo.src}
                      alt={photo.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-115"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 backdrop-blur-[2px] transition-all duration-300" />
                    {i === 0 && photos.length > 0 && (
                      <div className="absolute top-3 right-3 z-10">
                        <span className="bg-dark/60 backdrop-blur-sm text-white/80 text-[10px] font-medium px-2.5 py-1 rounded-full border border-white/10">
                          1 / {galleryPhotos.length}
                        </span>
                      </div>
                    )}
                    {photo.category && (
                      <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span className="bg-dark/60 backdrop-blur-sm text-white/80 text-[10px] font-medium px-2.5 py-1 rounded-full border border-white/10">
                          {photo.category}
                        </span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-5 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                      <div className="flex items-center gap-2.5">
                        <Camera className="h-4 w-4 text-gold" />
                        <span className="text-white text-sm font-medium">{photo.title}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="md:hidden grid grid-cols-2 gap-3">
                {galleryPhotos.slice(0, 4).map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative rounded-2xl overflow-hidden aspect-square bg-white/5 cursor-pointer transition-all duration-500 hover:shadow-[0_0_20px_-5px_rgba(192,160,98,0.25)]"
                    onClick={() => navigate('/public/gallery')}
                  >
                    <img
                      src={photo.src}
                      alt={photo.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-115"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 backdrop-blur-[2px] transition-all duration-300" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                      <span className="text-white text-xs font-medium">{photo.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      })()}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 5: AMENITIES — image cards + descriptions + lift/glow
          ═══════════════════════════════════════════════════════════════ */}
      {(() => {
        const amenitiesReveal = useScrollReveal(0.1)
        const AMENITIES = [
          { icon: Waves, label: 'Swimming Pool', desc: 'Cool off in our refreshing pool', img: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=500&h=400&fit=crop' },
          { icon: UtensilsCrossed, label: 'Restaurant', desc: 'Filipino & international cuisine', img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=500&h=400&fit=crop' },
          { icon: Wifi, label: 'Free Wi-Fi', desc: 'High-speed throughout the property', img: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=500&h=400&fit=crop' },
          { icon: Car, label: 'Free Parking', desc: 'Secure parking for all guests', img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&h=400&fit=crop' },
          { icon: Building2, label: 'Event Hall', desc: 'Perfect for celebrations', img: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=500&h=400&fit=crop' },
          { icon: Star, label: 'Cozy Lounge', desc: 'Relax & unwind in style', img: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=500&h=400&fit=crop' },
        ]
        return (
          <section ref={amenitiesReveal.ref} className={`relative bg-dark py-24 md:py-32 px-4 overflow-hidden ${amenitiesReveal.className}`}>
            <div className="absolute inset-0 dot-pattern opacity-60 pointer-events-none" />
            <div className="relative z-10 max-w-7xl mx-auto">
              <div className="text-center mb-16">
                <p className="section-subtitle mb-4">Amenities</p>
                <h2 className="section-heading">{sectionAmenitiesTitle}</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                {AMENITIES.map((item, i) => (
                  <div
                    key={item.label}
                    className="group relative rounded-2xl overflow-hidden aspect-[4/3] cursor-default transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_0_40px_8px_rgba(192,160,98,0.2)]"
                    style={{ transitionDelay: `${i * 0.08}s` }}
                  >
                    <img src={item.img} alt={item.label} className="absolute inset-0 w-full h-full object-cover opacity-15 group-hover:opacity-40 transition-opacity duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-dark/90 via-dark/60 to-dark/30" />
                    <div className="absolute inset-0 border border-white/5 group-hover:border-gold/30 rounded-2xl transition-colors duration-500" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                      <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mb-4 group-hover:bg-gold/20 group-hover:border-gold/50 group-hover:shadow-[0_0_30px_-5px_rgba(192,160,98,0.4)] group-hover:scale-110 transition-all duration-500">
                        <item.icon className="h-7 w-7 text-gold" />
                      </div>
                      <h3 className="text-white text-sm font-medium mb-1">{item.label}</h3>
                      <p className="text-white/30 text-xs group-hover:text-white/50 transition-colors duration-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-16 h-px bg-gold/40 mx-auto mt-24 relative z-10" />
          </section>
        )
      })()}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 6: BOOK YOUR STAY CTA
          ═══════════════════════════════════════════════════════════════ */}
      {(() => {
        const ctaReveal = useScrollReveal(0.15)
        return (
          <section ref={ctaReveal.ref} className={`relative py-28 md:py-36 px-4 overflow-hidden ${ctaReveal.className}`}>
            <img
              src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1600&h=900&fit=crop"
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-dark/85 via-dark/70 to-dark/85" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gold/5 via-transparent to-transparent" />
            <div className="relative z-10 max-w-3xl mx-auto text-center">
              <p className="section-subtitle mb-4">Book Your Stay</p>
              <h2 className="font-serif text-white text-4xl sm:text-5xl lg:text-6xl font-light leading-tight mb-6">
                Ready to Experience<br />{hotelName}?
              </h2>
              <div className="gold-line mx-auto mb-8" />
              <p className="text-white/50 text-lg mb-10 max-w-xl mx-auto">
                Your perfect getaway is just a click away. Check availability and book your stay today.
              </p>
              <button
                onClick={() => navigate('/public/rooms')}
                className="btn-gold inline-flex items-center gap-2 text-base px-10 py-4"
              >
                Book Now <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </section>
        )
      })()}
    </div>
  )
}
