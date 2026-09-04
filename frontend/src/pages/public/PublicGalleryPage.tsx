import { useState, useEffect, useRef, useMemo } from 'react'
import { useHotelName, useBrandingSettings } from '@/hooks/usePublicApi'
import { buildGalleryPhotos, type GalleryPhoto } from '@/lib/branding'
import { X, ChevronLeft, ChevronRight, Camera, LayoutGrid, BedDouble, Waves, Sparkles } from 'lucide-react'

const CATEGORIES = [
  { value: 'All', label: 'All', icon: LayoutGrid },
  { value: 'Rooms & Suites', label: 'Rooms & Suites', icon: BedDouble },
  { value: 'Amenities', label: 'Amenities', icon: Waves },
] as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useScrollReveal(threshold = 0.1) {
  const ref = useRef<any>(null)
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

export default function PublicGalleryPage() {
  const hotelName = useHotelName()
  const branding = useBrandingSettings()
  const PHOTOS: GalleryPhoto[] = buildGalleryPhotos(branding, hotelName)
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set())

  const filteredPhotos = useMemo(
    () => activeCategory === 'All' ? PHOTOS : PHOTOS.filter(p => p.category === activeCategory),
    [PHOTOS, activeCategory]
  )

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: PHOTOS.length }
    PHOTOS.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1 })
    return counts
  }, [PHOTOS])

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null)
      if (e.key === 'ArrowLeft') setLightboxIndex(i => (i! - 1 + filteredPhotos.length) % filteredPhotos.length)
      if (e.key === 'ArrowRight') setLightboxIndex(i => (i! + 1) % filteredPhotos.length)
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [lightboxIndex, filteredPhotos.length])

  function openLightbox(index: number) { setLightboxIndex(index) }
  function closeLightbox() { setLightboxIndex(null) }
  function prevPhoto() { if (lightboxIndex !== null) setLightboxIndex((lightboxIndex - 1 + filteredPhotos.length) % filteredPhotos.length) }
  function nextPhoto() { if (lightboxIndex !== null) setLightboxIndex((lightboxIndex + 1) % filteredPhotos.length) }

  const lightboxPhoto = lightboxIndex !== null ? filteredPhotos[lightboxIndex] : null

  // Preload adjacent images in lightbox
  useEffect(() => {
    if (lightboxIndex === null) return
    const preload = [lightboxIndex - 1, lightboxIndex + 1].map(i => (i + filteredPhotos.length) % filteredPhotos.length)
    preload.forEach(i => { const img = new Image(); img.src = filteredPhotos[i]?.src })
  }, [lightboxIndex, filteredPhotos])

  return (
    <div className="min-h-screen bg-dark">
      {/* ═══════════════════════════════════════════════════════════════
          HERO — Ken Burns + immersive
          ═══════════════════════════════════════════════════════════════ */}
      <section className="relative h-[55vh] min-h-[420px] flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          {PHOTOS.length > 0 && (
            <img
              src={PHOTOS[0].src}
              alt=""
              className="w-full h-full object-cover animate-ken-burns"
              style={{ animationDuration: '14s' }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-dark/70 via-dark/50 to-dark/80" />
          <div className="absolute inset-0 bg-gradient-to-r from-dark/30 via-transparent to-dark/30" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gold/5 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 text-center px-4">
          <p className="section-subtitle mb-4 animate-reveal-up" style={{ animationDelay: '0.2s' }}>{hotelName}</p>
          <h1 className="font-serif text-white text-4xl sm:text-5xl lg:text-6xl font-extralight mb-4 animate-reveal-up" style={{ animationDelay: '0.4s' }}>
            Our Gallery
          </h1>
          <div className="gold-line mx-auto my-6 animate-reveal-up" style={{ animationDelay: '0.6s' }} />
          <p className="text-white/50 text-sm max-w-lg mx-auto mb-8 animate-reveal-up" style={{ animationDelay: '0.7s' }}>
            Explore the cozy comfort and charm that awaits you at {hotelName}.
          </p>
          <div className="flex items-center justify-center gap-6 animate-reveal-up" style={{ animationDelay: '0.9s' }}>
            <span className="flex items-center gap-2 text-white/40 text-xs">
              <Camera className="h-3.5 w-3.5 text-gold/60" /> {PHOTOS.length} Photos
            </span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span className="flex items-center gap-2 text-white/40 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-gold/60" /> {Object.keys(categoryCounts).length - 1} Categories
            </span>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <div className="w-5 h-8 rounded-full border border-white/20 flex justify-center pt-1.5">
            <div className="w-1 h-2 rounded-full bg-gold/50" />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          CATEGORY TABS — animated underline
          ═══════════════════════════════════════════════════════════════ */}
      <div className="sticky top-20 z-30 bg-cream/95 backdrop-blur-xl border-b border-cream-warm/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center gap-1 py-4">
            {CATEGORIES.map((tab) => {
              const Icon = tab.icon
              const isActive = activeCategory === tab.value
              const count = categoryCounts[tab.value] || 0
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveCategory(tab.value)}
                  className={`relative flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-[0.12em] whitespace-nowrap transition-all duration-300 ${
                    isActive
                      ? 'bg-dark text-gold shadow-md shadow-dark/10'
                      : 'text-dark/40 hover:text-dark/70 hover:bg-white/60'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  <span className={`text-[10px] font-bold ml-0.5 ${isActive ? 'text-gold/70' : 'text-dark/25'}`}>
                    ({count})
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          PHOTO GRID — masonry + scroll reveal
          ═══════════════════════════════════════════════════════════════ */}
      <section className="bg-cream pb-24 px-4">
        <div className="max-w-7xl mx-auto pt-10">
          {filteredPhotos.length === 0 ? (
            <div className="text-center py-24">
              <div className="w-20 h-20 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-6">
                <Camera className="h-8 w-8 text-gold/50" />
              </div>
              <h3 className="font-serif text-2xl text-dark font-light mb-3">No photos found</h3>
              <p className="text-dark/40 text-sm max-w-md mx-auto mb-8">
                We couldn't find any photos in this category. Try browsing a different category.
              </p>
              <button
                onClick={() => setActiveCategory('All')}
                className="px-6 py-2.5 bg-gold text-dark text-xs font-semibold uppercase tracking-[0.12em] rounded-full hover:bg-gold-light transition-all duration-300"
              >
                View All Photos
              </button>
            </div>
          ) : (
            /* Desktop: CSS columns masonry (no gaps) */
            <>
              {/* Desktop masonry */}
              <div className="hidden md:block columns-3 gap-3">
                {filteredPhotos.map((photo, idx) => (
                  <div key={photo.id} className="break-inside-avoid mb-3">
                    <GalleryCard
                      photo={photo}
                      index={idx}
                      onClick={() => openLightbox(idx)}
                      onLoad={(id) => setLoadedImages(prev => new Set(prev).add(id))}
                      loaded={loadedImages.has(photo.id)}
                    />
                  </div>
                ))}
              </div>

              {/* Mobile: 2-col grid */}
              <div className="md:hidden grid grid-cols-2 gap-3">
                {filteredPhotos.map((photo, idx) => (
                  <GalleryCard
                    key={photo.id}
                    photo={photo}
                    index={idx}
                    mobile
                    onClick={() => openLightbox(idx)}
                    onLoad={(id) => setLoadedImages(prev => new Set(prev).add(id))}
                    loaded={loadedImages.has(photo.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          LIGHTBOX — professional
          ═══════════════════════════════════════════════════════════════ */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center animate-fade-in"
          onClick={closeLightbox}
        >
          {/* Close */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-200 z-10"
          >
            <X className="h-5 w-5 text-white" />
          </button>

          {/* Counter */}
          <div className="absolute top-5 left-5 z-10">
            <span className="text-white/60 text-sm font-medium">
              {lightboxIndex! + 1} / {filteredPhotos.length}
            </span>
          </div>

          {/* Prev */}
          <button
            onClick={(e) => { e.stopPropagation(); prevPhoto() }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-200 z-10"
          >
            <ChevronLeft className="h-6 w-6 text-white" />
          </button>

          {/* Image */}
          <div className="max-w-6xl max-h-[85vh] mx-16 relative" onClick={(e) => e.stopPropagation()}>
            <img
              key={lightboxPhoto.id}
              src={lightboxPhoto.src}
              alt={lightboxPhoto.title}
              className="max-w-full max-h-[78vh] object-contain rounded-lg animate-fade-in"
            />
            {/* Title overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 rounded-b-lg">
              <span className="text-[10px] uppercase tracking-[0.15em] text-gold font-semibold">{lightboxPhoto.category}</span>
              <p className="text-white text-base font-light mt-1">{lightboxPhoto.title}</p>
            </div>
          </div>

          {/* Next */}
          <button
            onClick={(e) => { e.stopPropagation(); nextPhoto() }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-200 z-10"
          >
            <ChevronRight className="h-6 w-6 text-white" />
          </button>

          {/* Thumbnail strip */}
          <div className="absolute bottom-0 left-0 right-0 z-10">
            <div className="flex items-center justify-center gap-2 py-4 px-6 overflow-x-auto bg-gradient-to-t from-black/80 to-transparent">
              {filteredPhotos.map((photo, i) => (
                <button
                  key={photo.id}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i) }}
                  className={`shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 transition-all duration-200 ${
                    i === lightboxIndex
                      ? 'border-gold scale-110 shadow-lg shadow-gold/20'
                      : 'border-white/10 opacity-50 hover:opacity-80 hover:border-white/30'
                  }`}
                >
                  <img src={photo.src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   GALLERY CARD COMPONENT
   ═══════════════════════════════════════════════════════════════ */
function GalleryCard({
  photo,
  index,
  mobile = false,
  onClick,
  onLoad,
  loaded,
}: {
  photo: GalleryPhoto
  index: number
  mobile?: boolean
  onClick: () => void
  onLoad: (id: number) => void
  loaded: boolean
}) {
  const reveal = useScrollReveal(0.05)

  if (mobile) {
    return (
      <button
        ref={reveal.ref}
        className={`group relative aspect-square rounded-xl overflow-hidden cursor-pointer ${reveal.className}`}
        style={{ transitionDelay: `${(index % 4) * 0.05}s` }}
        onClick={onClick}
      >
        <img
          src={photo.src}
          alt={photo.title}
          className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${loaded ? '' : 'opacity-0'}`}
          loading="lazy"
          onLoad={() => onLoad(photo.id)}
        />
        {!loaded && <div className="absolute inset-0 bg-dark/5 animate-pulse" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <Camera className="h-3 w-3 text-white" />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <span className="text-[9px] uppercase tracking-[0.12em] text-gold font-medium">{photo.category}</span>
          <p className="text-white text-xs font-medium mt-0.5 line-clamp-1">{photo.title}</p>
        </div>
      </button>
    )
  }

  return (
    <button
      ref={reveal.ref}
      className={`group relative w-full rounded-xl overflow-hidden cursor-pointer hover:shadow-[0_0_30px_-5px_rgba(192,160,98,0.3)] hover:border hover:border-gold/20 transition-all duration-500 ${reveal.className}`}
      style={{ transitionDelay: `${(index % 6) * 0.06}s` }}
      onClick={onClick}
    >
      <img
        src={photo.src}
        alt={photo.title}
        className={`w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105 ${loaded ? '' : 'opacity-0'}`}
        loading="lazy"
        onLoad={() => onLoad(photo.id)}
      />
      {!loaded && <div className="absolute inset-0 bg-dark/5 animate-pulse" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent opacity-0 group-hover:opacity-100 backdrop-blur-[2px] transition-all duration-300" />
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/10">
          <Camera className="h-3.5 w-3.5 text-white" />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-gold" />
          <span className="text-[10px] uppercase tracking-[0.12em] text-gold font-semibold">{photo.category}</span>
        </div>
        <p className="text-white text-sm font-medium">{photo.title}</p>
      </div>
    </button>
  )
}
