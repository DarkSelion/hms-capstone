import { useState } from 'react'
import { useHotelName, useBrandingSettings } from '@/hooks/usePublicApi'
import { buildGalleryPhotos, type GalleryPhoto } from '@/lib/branding'
import { X, ChevronLeft, ChevronRight, Camera, LayoutGrid, BedDouble, Waves } from 'lucide-react'

const CATEGORIES = [
  { value: 'All', label: 'All', icon: LayoutGrid },
  { value: 'Rooms & Suites', label: 'Rooms & Suites', icon: BedDouble },
  { value: 'Amenities', label: 'Amenities', icon: Waves },
] as const

export default function PublicGalleryPage() {
  const hotelName = useHotelName()
  const branding = useBrandingSettings()
  const PHOTOS: GalleryPhoto[] = buildGalleryPhotos(branding, hotelName)
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const filteredPhotos = activeCategory === 'All' ? PHOTOS : PHOTOS.filter(p => p.category === activeCategory)

  function openLightbox(index: number) {
    setLightboxIndex(index)
  }

  function closeLightbox() {
    setLightboxIndex(null)
  }

  function prevPhoto() {
    if (lightboxIndex === null) return
    setLightboxIndex((lightboxIndex - 1 + filteredPhotos.length) % filteredPhotos.length)
  }

  function nextPhoto() {
    if (lightboxIndex === null) return
    setLightboxIndex((lightboxIndex + 1) % filteredPhotos.length)
  }

  const lightboxPhoto = lightboxIndex !== null ? filteredPhotos[lightboxIndex] : null

  return (
    <div className="min-h-screen bg-dark">
      {/* Hero */}
      <section className="relative py-20 bg-dark">
        <div className="absolute inset-0 bg-gradient-to-b from-gold/5 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 text-center">
          <p className="section-subtitle mb-4">{hotelName}</p>
          <h1 className="font-serif text-4xl md:text-5xl text-white font-extralight mb-4">
            Our Gallery
          </h1>
          <div className="gold-line mx-auto mb-6" />
          <p className="text-white/40 text-sm max-w-lg mx-auto">
            Explore the cozy comfort and charm that awaits you at {hotelName}.
          </p>
        </div>
      </section>

      {/* Category Tabs */}
      <div className="sticky top-20 z-30 bg-cream/90 backdrop-blur-xl border-b border-cream-warm/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-wrap justify-center gap-3 sm:flex-nowrap sm:overflow-x-auto">
            {CATEGORIES.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveCategory(tab.value)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-[0.15em] transition-all duration-300 ${
                    activeCategory === tab.value
                      ? 'bg-gold text-dark shadow-md shadow-gold/20'
                      : 'bg-white/50 text-dark/50 hover:bg-white hover:text-dark border border-transparent'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Photo Grid */}
      <section className="bg-cream pb-20">
        <div className="max-w-7xl mx-auto px-4 pt-8">
          <p className="text-xs text-dark/40 uppercase tracking-[0.15em] mb-6">
            {filteredPhotos.length} photo{filteredPhotos.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPhotos.map((photo, idx) => (
              <button
                key={photo.id}
                onClick={() => openLightbox(idx)}
                className="group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer"
              >
                <img
                  src={photo.src}
                  alt={photo.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                  <span className="text-xs uppercase tracking-[0.15em] text-gold font-medium">{photo.category}</span>
                  <p className="text-white text-sm font-medium mt-0.5">{photo.title}</p>
                </div>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                    <Camera className="h-3.5 w-3.5 text-white" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-fade-in"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
          >
            <X className="h-5 w-5 text-white" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); prevPhoto() }}
            className="absolute left-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
          >
            <ChevronLeft className="h-6 w-6 text-white" />
          </button>

          <div className="max-w-5xl max-h-[85vh] mx-16" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxPhoto.src}
              alt={lightboxPhoto.title}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <div className="text-center mt-4">
              <span className="text-xs uppercase tracking-[0.15em] text-gold">{lightboxPhoto.category}</span>
              <p className="text-white text-sm mt-1">{lightboxPhoto.title}</p>
              <p className="text-white/30 text-xs mt-2">
                {lightboxIndex! + 1} / {filteredPhotos.length}
              </p>
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); nextPhoto() }}
            className="absolute right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
          >
            <ChevronRight className="h-6 w-6 text-white" />
          </button>
        </div>
      )}
    </div>
  )
}
