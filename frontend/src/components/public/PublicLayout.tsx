import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { PublicNavbar } from './PublicNavbar'
import { PublicFooter } from './PublicFooter'
import { usePublicSettings, useHotelName } from '@/hooks/usePublicApi'

const THEME_PRESETS = ['gold', 'emerald', 'navy', 'neutral'] as const

export function PublicLayout() {
  const { data: branding } = usePublicSettings('branding')
  const hotelName = useHotelName()
  const brandingSettings = (branding ?? {}) as Record<string, unknown>
  const presetRaw = brandingSettings['theme_preset']
  const preset = THEME_PRESETS.includes(presetRaw as any) ? (presetRaw as string) : 'gold'
  const favicon = typeof brandingSettings['hotel_favicon'] === 'string' ? brandingSettings['hotel_favicon'] : ''

  useEffect(() => {
    document.title = hotelName
  }, [hotelName])

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('home-theme-root')

    const faviconLink =
      document.querySelector<HTMLLinkElement>('link[rel="icon"]') ||
      (() => {
        const link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
        return link
      })()
    const faviconHref = favicon || '/favicon.svg'
    if (faviconLink.getAttribute('href') !== faviconHref) {
      faviconLink.setAttribute('href', faviconHref)
    }

    return () => root.classList.remove('home-theme-root')
  }, [favicon])

  return (
    <div className={`home-theme theme-${preset} min-h-screen bg-dark`}>
      <PublicNavbar />
      <main className="pt-20">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  )
}
