export interface GalleryPhoto {
  id: number
  src: string
  title: string
  category: string
}

export const DEFAULT_HERO_IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1920&h=1080&fit=crop',
]

export const DEFAULT_BRANDING_TEXT: Record<string, string> = {
  theme_preset: 'navy',
  hero_badge: 'Welcome to Pampanga Home Suites',
  hero_title: 'Comfortable Stays, Warm Smiles',
  hero_subtitle: 'Experience warm Filipino hospitality right here in Pampanga. Every stay feels like coming home.',
  hero_cta_label: 'Explore Stays',
  section_discover_title: 'Discover Our World',
  section_why_title: 'Why Stay With Us',
  section_amenities_title: 'Comforts of Home',
  section_gallery_title: 'A Glimpse of {hotel_name}',
  footer_tagline: 'Cozy stays, warm smiles — right here in Pampanga.',
}

export const DEFAULT_GALLERY_PHOTOS: GalleryPhoto[] = [
  { id: 1, src: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80', title: 'Deluxe King Room', category: 'Rooms & Suites' },
  { id: 2, src: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80', title: 'Ocean View Suite', category: 'Rooms & Suites' },
  { id: 3, src: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800&q=80', title: 'Premier Suite', category: 'Rooms & Suites' },
  { id: 4, src: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80', title: 'Premium Twin Room', category: 'Rooms & Suites' },
  { id: 5, src: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&q=80', title: 'Garden Suite', category: 'Rooms & Suites' },
  { id: 6, src: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80', title: 'Family Room', category: 'Rooms & Suites' },
  { id: 7, src: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80', title: 'Infinity Pool', category: 'Amenities' },
  { id: 8, src: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80', title: 'Poolside Lounge', category: 'Amenities' },
  { id: 9, src: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80', title: 'Swimming Pool', category: 'Amenities' },
  { id: 10, src: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80', title: 'Hotel Lobby', category: 'Amenities' },
  { id: 11, src: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80', title: 'Resort View', category: 'Amenities' },
  { id: 12, src: '', title: 'Cozy Lounge', category: 'Amenities' },
]

export function stringSetting(settings: Record<string, unknown>, key: string, fallback: string): string {
  const value = settings[key]
  return typeof value === 'string' && value.trim() ? value : fallback
}

export function replaceHotelName(text: string, hotelName: string): string {
  return text
    .replaceAll('{hotel_name}', hotelName)
    .replaceAll('{hotelName}', hotelName)
}

export function buildHeroImages(settings: Record<string, unknown>): string[] {
  const urls = [1, 2, 3]
    .map((i) => stringSetting(settings, `hero_image_${i}`, ''))
    .filter((url) => url.length > 0)
  return urls.length > 0 ? urls : DEFAULT_HERO_IMAGES
}

export function buildGalleryPhotos(settings: Record<string, unknown>, hotelName: string): GalleryPhoto[] {
  const hasAnyConfigured = Array.from({ length: 12 }, (_, i) => `gallery_${i + 1}_image`)
    .some((key) => stringSetting(settings, key, '').length > 0)

  if (!hasAnyConfigured) {
    return DEFAULT_GALLERY_PHOTOS
      .filter((p) => p.src)
      .map((p) => ({ ...p, title: replaceHotelName(p.title, hotelName) }))
  }

  const photos: GalleryPhoto[] = []
  for (let i = 1; i <= 12; i++) {
    const src = stringSetting(settings, `gallery_${i}_image`, '')
    if (!src) continue
    const fallback = DEFAULT_GALLERY_PHOTOS[i - 1]
    photos.push({
      id: i,
      src,
      title: replaceHotelName(stringSetting(settings, `gallery_${i}_title`, fallback.title), hotelName),
      category: stringSetting(settings, `gallery_${i}_category`, fallback.category),
    })
  }
  return photos
}
