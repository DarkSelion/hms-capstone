import { Link } from 'react-router-dom'
import { Phone, Mail, MapPin } from 'lucide-react'
import { useHotelName, useHotelSettings, useBrandingSettings } from '@/hooks/usePublicApi'
import { stringSetting } from '@/lib/branding'

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 12a4 4 0 1 0 4 4V4h5a4 4 0 0 0 4 4" />
    </svg>
  )
}

export function PublicFooter() {
  const hotelName = useHotelName()
  const hotel = useHotelSettings()
  const branding = useBrandingSettings()
  const address = (hotel['hotel_address'] as string) || 'Pampanga, Philippines'
  const phone = (hotel['hotel_phone'] as string) || '+63 912 345 6789'
  const email = (hotel['hotel_email'] as string) || 'info@pampangahomesuites.com'
  const tagline = stringSetting(branding, 'footer_tagline', 'Cozy stays, warm smiles — right here in Pampanga.')
  const facebook = (hotel['contact_facebook'] as string) || ''
  const instagram = (hotel['contact_instagram'] as string) || ''
  const tiktok = (hotel['contact_tiktok'] as string) || ''
  const SOCIALS = [
    { icon: FacebookIcon, href: facebook, label: 'Facebook' },
    { icon: InstagramIcon, href: instagram, label: 'Instagram' },
    { icon: TikTokIcon, href: tiktok, label: 'TikTok' },
  ].filter((s) => s.href && s.href !== '#')
  return (
    <footer className="bg-dark">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
        <div className="text-center mb-14">
          <div className="w-12 h-px bg-gold/30 mx-auto mb-8" />
          <h3 className="font-serif text-gold text-2xl font-light tracking-wider mb-4">{hotelName}</h3>
          <p className="text-white/40 text-sm leading-relaxed max-w-md mx-auto mb-8">
            {tagline}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-white/40 mb-8">
            <span className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-gold/50" /> {address}
            </span>
            <span className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-gold/50" /> {phone}
            </span>
            <span className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-gold/50" /> {email}
            </span>
          </div>
          {SOCIALS.length > 0 && (
            <div className="flex items-center justify-center gap-4">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={s.label}
                  className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-white/30 hover:border-gold/40 hover:text-gold hover:bg-gold/5 transition-all duration-300"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-white/20">
            &copy; {new Date().getFullYear()} {hotelName}. All rights reserved.
          </p>
          <div className="flex gap-6 text-[11px] text-white/20">
            <Link to="/public" className="hover:text-gold transition-colors">Privacy Policy</Link>
            <Link to="/public" className="hover:text-gold transition-colors">Terms of Use</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
