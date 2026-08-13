import { describe, it, expect } from 'vitest'
import {
  DEFAULT_BRANDING_TEXT,
  DEFAULT_GALLERY_PHOTOS,
  DEFAULT_HERO_IMAGES,
  buildGalleryPhotos,
  buildHeroImages,
  replaceHotelName,
  stringSetting,
} from './branding'

describe('buildGalleryPhotos', () => {
  it('returns the default photos when no gallery image keys are configured', () => {
    const photos = buildGalleryPhotos({}, 'Pampanga Home Suites')

    expect(photos.length).toBe(11)
    expect(photos.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(photos[0]).toEqual({
      id: 1,
      src: DEFAULT_GALLERY_PHOTOS[0].src,
      title: DEFAULT_GALLERY_PHOTOS[0].title,
      category: DEFAULT_GALLERY_PHOTOS[0].category,
    })
  })

  it('shows only configured slots when any gallery image key is present', () => {
    const photos = buildGalleryPhotos(
      { gallery_1_image: 'https://example.com/a.jpg', gallery_3_image: 'https://example.com/c.jpg' },
      'Pampanga Home Suites'
    )

    expect(photos.map((p) => p.id)).toEqual([1, 3])
    expect(photos[0].src).toBe('https://example.com/a.jpg')
    expect(photos[1].src).toBe('https://example.com/c.jpg')
  })

  it('falls back to default title and category per slot', () => {
    const photos = buildGalleryPhotos({ gallery_1_image: 'https://example.com/a.jpg' }, 'Pampanga Home Suites')

    expect(photos[0].title).toBe(DEFAULT_GALLERY_PHOTOS[0].title)
    expect(photos[0].category).toBe(DEFAULT_GALLERY_PHOTOS[0].category)
  })

  it('replaces {hotel_name} placeholders in configured titles', () => {
    const photos = buildGalleryPhotos(
      { gallery_1_image: 'https://example.com/a.jpg', gallery_1_title: '{hotel_name} Signature Room' },
      'Pampanga Home Suites'
    )

    expect(photos[0].title).toBe('Pampanga Home Suites Signature Room')
  })

  it('treats empty-string image keys as missing and returns the defaults', () => {
    const photos = buildGalleryPhotos(
      {
        gallery_1_image: null,
        gallery_2_image: '',
        gallery_3_image: '',
        gallery_4_image: '',
        gallery_5_image: '',
        gallery_6_image: '',
        gallery_7_image: '',
        gallery_8_image: '',
        gallery_9_image: '',
        gallery_10_image: '',
        gallery_11_image: '',
        gallery_12_image: '',
      },
      'Pampanga Home Suites'
    )

    expect(photos.length).toBe(11)
    expect(photos[0].id).toBe(1)
  })

  it('shows only the non-empty slots when some image keys are empty', () => {
    const photos = buildGalleryPhotos(
      { gallery_1_image: '', gallery_2_image: 'https://example.com/b.jpg', gallery_3_image: 'https://example.com/c.jpg' },
      'Pampanga Home Suites'
    )

    expect(photos.map((p) => p.id)).toEqual([2, 3])
  })
})

describe('buildHeroImages', () => {
  it('returns the default hero images when none are configured', () => {
    expect(buildHeroImages({})).toEqual(DEFAULT_HERO_IMAGES)
  })

  it('returns only the configured hero images', () => {
    const images = buildHeroImages({ hero_image_1: 'https://example.com/a.jpg', hero_image_3: 'https://example.com/c.jpg' })

    expect(images).toEqual(['https://example.com/a.jpg', 'https://example.com/c.jpg'])
  })
})

describe('stringSetting', () => {
  it('returns the fallback for missing or empty values', () => {
    expect(stringSetting({}, 'key', 'fb')).toBe('fb')
    expect(stringSetting({ key: '' }, 'key', 'fb')).toBe('fb')
    expect(stringSetting({ key: null }, 'key', 'fb')).toBe('fb')
    expect(stringSetting({ key: 42 }, 'key', 'fb')).toBe('fb')
  })

  it('returns the value when present and non-empty', () => {
    expect(stringSetting({ key: ' hello ' }, 'key', 'fb')).toBe(' hello ')
  })
})

describe('replaceHotelName', () => {
  it('replaces both placeholder forms', () => {
    expect(replaceHotelName('Welcome to {hotel_name} and {hotelName}', 'Pampanga Home Suites'))
      .toBe('Welcome to Pampanga Home Suites and Pampanga Home Suites')
  })
})

describe('DEFAULT_BRANDING_TEXT', () => {
  it('holds the current website default copy', () => {
    expect(DEFAULT_BRANDING_TEXT.theme_preset).toBe('gold')
    expect(DEFAULT_BRANDING_TEXT.hero_title).toBe('Comfortable Stays, Warm Smiles')
    expect(DEFAULT_BRANDING_TEXT.footer_tagline).toBe('Cozy stays, warm smiles — right here in Pampanga.')
  })
})
