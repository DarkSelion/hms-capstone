import { Link, useNavigate } from 'react-router-dom'
import { Phone, Mail, MapPin, LogOut, ArrowUp } from 'lucide-react'
import {
  useHotelName, useHotelSettings, useBrandingSettings,
} from '@/hooks/usePublicApi'
import { usePublicAuthStore } from '@/stores/publicAuthStore'
import { publicApi } from '@/lib/publicApi'
import { stringSetting } from '@/lib/branding'
import { useToast } from '@/components/ui/toast'

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

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] uppercase tracking-[0.25em] text-gold/70 font-semibold mb-4">
      {children}
    </h4>
  )
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        to={to}
        className="text-sm text-white/55 hover:text-gold transition-colors duration-200 inline-flex items-center gap-1.5 group"
      >
        {children}
      </Link>
    </li>
  )
}

export function PublicFooter() {
  const navigate = useNavigate()
  const { token, logout } = usePublicAuthStore()
  const { addToast } = useToast()
  const hotelName = useHotelName()
  const hotel = useHotelSettings()
  const branding = useBrandingSettings()

  const address = (hotel['hotel_address'] as string) || 'Pampanga, Philippines'
  const phone = (hotel['hotel_phone'] as string) || '+63 912 345 6789'
  const email = (hotel['hotel_email'] as string) || 'info@pampangahomesuites.com'
  const tagline = stringSetting(branding, 'footer_tagline', 'Cozy stays, warm smiles — right here in Pampanga.')
  const logoUrl = (hotel['hotel_logo'] as string | undefined) || ''

  const facebook = (hotel['contact_facebook'] as string) || ''
  const instagram = (hotel['contact_instagram'] as string) || ''
  const tiktok = (hotel['contact_tiktok'] as string) || ''
  const SOCIALS = [
    { icon: FacebookIcon, href: facebook, label: 'Facebook' },
    { icon: InstagramIcon, href: instagram, label: 'Instagram' },
    { icon: TikTokIcon, href: tiktok, label: 'TikTok' },
  ].filter((s) => s.href && s.href !== '#')

  function handleSignOut() {
    publicApi.post('/public/logout').catch(() => {})
    logout()
    addToast('Signed out', 'success')
    navigate('/public')
  }

  function handleBackToTop() {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const year = new Date().getFullYear()

  return (
    <footer className="bg-dark border-t border-white/5">
      <div className="h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-white/5">
          {/* Brand block (5 cols) */}
          <div className="sm:col-span-2 lg:col-span-5">
            <Link to="/public" className="inline-flex items-center gap-3 mb-5 group">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={hotelName}
                  className="h-12 w-12 rounded-full bg-cream/5 object-contain border border-gold/20 p-1"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-gold to-gold-light text-dark flex items-center justify-center font-serif text-lg font-medium shadow-md shadow-gold/10">
                  {hotelName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="font-serif text-gold text-2xl font-medium leading-none">{hotelName}</h3>
                <p className="text-[10px] uppercase tracking-[0.25em] text-gold/60 mt-1.5">Home Suites</p>
              </div>
            </Link>
            <p className="text-white/60 text-sm leading-relaxed max-w-sm mb-6">
              {tagline}
            </p>
            {SOCIALS.length > 0 && (
              <div className="flex items-center gap-2.5">
                {SOCIALS.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={s.label}
                    aria-label={s.label}
                    className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:border-gold/50 hover:text-gold hover:bg-gold/5 transition-all duration-300"
                  >
                    <s.icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Explore (2 cols) */}
          <div className="lg:col-span-2">
            <ColumnTitle>Explore</ColumnTitle>
            <ul className="space-y-2.5">
              <FooterLink to="/public">Home</FooterLink>
              <FooterLink to="/public/rooms">Our Rooms</FooterLink>
              <FooterLink to="/public/gallery">Gallery</FooterLink>
              <FooterLink to="/public/contact">Contact</FooterLink>
            </ul>
          </div>

          {/* Account (2 cols) */}
          <div className="lg:col-span-2">
            <ColumnTitle>Account</ColumnTitle>
            <ul className="space-y-2.5">
              {token ? (
                <>
                  <FooterLink to="/public/my-reservations">My Bookings</FooterLink>
                  <FooterLink to="/public/profile">Profile</FooterLink>
                  <li>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="text-sm text-white/55 hover:text-gold transition-colors duration-200 inline-flex items-center gap-1.5"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <FooterLink to="/public/login">Sign In</FooterLink>
                  <FooterLink to="/public/register">Create Account</FooterLink>
                </>
              )}
            </ul>
          </div>

          {/* Contact (3 cols) */}
          <div className="lg:col-span-3">
            <ColumnTitle>Contact</ColumnTitle>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-gold/60 mt-0.5 shrink-0" />
                <span className="text-sm text-white/70 leading-relaxed">{address}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone className="h-4 w-4 text-gold/60 mt-0.5 shrink-0" />
                <a
                  href={`tel:${phone.replace(/\s/g, '')}`}
                  className="text-sm text-white/70 hover:text-gold transition-colors"
                >
                  {phone}
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="h-4 w-4 text-gold/60 mt-0.5 shrink-0" />
                <a
                  href={`mailto:${email}`}
                  className="text-sm text-white/70 hover:text-gold transition-colors break-all"
                >
                  {email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom: legal + back to top */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/30">
          <p>
            &copy; {year} {hotelName}. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={handleBackToTop}
              className="inline-flex items-center gap-1.5 hover:text-gold transition-colors"
              aria-label="Back to top"
            >
              Back to top
              <ArrowUp className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
