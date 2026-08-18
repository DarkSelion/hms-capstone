import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSettings, useUpdateSettings, useUpdateLogo, useDeleteLogo } from '@/hooks/useApi'
import { ImageSlotUpload } from '@/components/admin/ImageSlotUpload'
import { DEFAULT_BRANDING_TEXT, DEFAULT_GALLERY_PHOTOS, DEFAULT_HERO_IMAGES, stringSetting } from '@/lib/branding'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { CHECKOUT_HOUR_OPTIONS, CHECKOUT_MINUTE_OPTIONS, parseCheckoutTime, buildCheckoutTime } from '@/lib/format'
import { Save, Loader2, AlertCircle, RotateCcw, Plus, Trash2, Upload } from 'lucide-react'

const SETTINGS_TABS = ['Hotel', 'Booking', 'Taxes', 'Security', 'Contact', 'Payments', 'Website'] as const

const TAB_GROUP: Record<string, string> = {
  Hotel: 'hotel',
  Booking: 'booking',
  Taxes: 'tax',
  Security: 'security',
  Contact: 'contact',
  Payments: 'payment',
  Website: 'branding',
}

const THEME_PRESETS = [
  { value: 'gold', label: 'Gold (current)' },
  { value: 'emerald', label: 'Emerald & Sage' },
  { value: 'navy', label: 'Navy & Gold' },
  { value: 'neutral', label: 'Warm Neutral' },
]

const GALLERY_CATEGORIES = ['Rooms & Suites', 'Amenities', 'Others']

const CURRENCIES = [
  { value: 'PHP', label: 'PHP - Philippine Peso' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
]

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST)' },
  { value: 'America/Denver', label: 'America/Denver (MST)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Asia/Manila', label: 'Asia/Manila (PHT)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST)' },
]

export default function SettingsPage() {
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<string>(
    initialTab && SETTINGS_TABS.includes(initialTab as any) ? initialTab : 'Hotel'
  )
  const { addToast } = useToast()

  const { data: settings, isLoading, error, refetch } = useSettings()
  const updateSettings = useUpdateSettings()
  const updateLogo = useUpdateLogo()
  const deleteLogo = useDeleteLogo()
  const logoFileRef = useRef<HTMLInputElement>(null)

  const [logoPreview, setLogoPreview] = useState('')
  const logoUrl = (settings as any)?.hotel_logo || ''

  const [hotelForm, setHotelForm] = useState({
    hotel_name: '', default_currency: 'PHP', timezone: 'Asia/Manila',
  })
  const [bookingForm, setBookingForm] = useState({
    default_discount: 0, cancellation_policy: '', early_checkin_fee: 0, late_checkout_fee: 0, check_out_time: '11:00', max_advance_days: 30,
  })
  const [taxForm, setTaxForm] = useState({ tax_name: '', tax_rate: 0 })
  const [securityForm, setSecurityForm] = useState({
    password_min_length: 8, session_timeout: 30, max_login_attempts: 5, two_factor_auth: false,
  })
  const [contactForm, setContactForm] = useState({
    hotel_address: '', hotel_phone: '', hotel_email: '',
    contact_heading: '', contact_description: '',
    contact_reception_hours: '',
    contact_facebook: '', contact_instagram: '', contact_tiktok: '', contact_map_embed_url: '',
  })
  const [faqItems, setFaqItems] = useState<Array<{ q: string; a: string }>>([])
  const [paymentForm, setPaymentForm] = useState({
    online_gateway_enabled: false,
    online_gateway_base_url: 'https://hardreset.onrender.com',
    online_gateway_api_key: '',
    online_gateway_webhook_secret: '',
  })

  const [websiteForm, setWebsiteForm] = useState({
    theme_preset: 'gold',
    hero_badge: '', hero_title: '', hero_subtitle: '', hero_cta_label: '',
    section_discover_title: '', section_why_title: '', section_amenities_title: '', section_gallery_title: '',
    footer_tagline: '',
  })
  const [galleryItems, setGalleryItems] = useState<Array<{ title: string; category: string }>>(
    Array.from({ length: 12 }, () => ({ title: '', category: 'Amenities' }))
  )

  useEffect(() => {
    if (settings) {
      const s = settings as any
      setHotelForm({
        hotel_name: s.hotel_name ?? '',
        default_currency: s.default_currency ?? 'PHP',
        timezone: s.timezone ?? 'Asia/Manila',
      })
      setBookingForm({
        default_discount: s.default_discount ?? 0,
        cancellation_policy: s.cancellation_policy ?? '',
        early_checkin_fee: s.early_checkin_fee ?? 0,
        late_checkout_fee: s.late_checkout_fee ?? 0,
        check_out_time: s.check_out_time ?? '11:00',
        max_advance_days: s.max_advance_days ?? 30,
      })
      setTaxForm({
        tax_name: s.tax_name ?? '',
        tax_rate: s.tax_rate ?? 0,
      })
      setSecurityForm({
        password_min_length: s.password_min_length ?? 8,
        session_timeout: s.session_timeout ?? 30,
        max_login_attempts: s.max_login_attempts ?? 5,
        two_factor_auth: s.two_factor_auth === '1' || s.two_factor_auth === true,
      })
      setContactForm({
        hotel_address: s.hotel_address ?? '',
        hotel_phone: s.hotel_phone ?? '',
        hotel_email: s.hotel_email ?? '',
        contact_heading: s.contact_heading ?? 'Get in Touch',
        contact_description: s.contact_description ?? 'Have a question or special request? We would love to hear from you.',
        contact_reception_hours: s.contact_reception_hours ?? '24 / 7 — Always Open',
        contact_facebook: s.contact_facebook ?? '',
        contact_instagram: s.contact_instagram ?? '',
        contact_tiktok: s.contact_tiktok ?? '',
        contact_map_embed_url: s.contact_map_embed_url ?? '',
      })
      try {
        const parsed = typeof s.contact_faq === 'string' ? JSON.parse(s.contact_faq) : s.contact_faq
        if (Array.isArray(parsed)) setFaqItems(parsed)
      } catch { /* keep default */ }
      setPaymentForm({
        online_gateway_enabled: s.online_gateway_enabled === '1' || s.online_gateway_enabled === true,
        online_gateway_base_url: s.online_gateway_base_url ?? 'https://hardreset.onrender.com',
        online_gateway_api_key: s.online_gateway_api_key ?? '',
        online_gateway_webhook_secret: s.online_gateway_webhook_secret ?? '',
      })
      setWebsiteForm({
        theme_preset: stringSetting(s, 'theme_preset', DEFAULT_BRANDING_TEXT.theme_preset),
        hero_badge: stringSetting(s, 'hero_badge', DEFAULT_BRANDING_TEXT.hero_badge),
        hero_title: stringSetting(s, 'hero_title', DEFAULT_BRANDING_TEXT.hero_title),
        hero_subtitle: stringSetting(s, 'hero_subtitle', DEFAULT_BRANDING_TEXT.hero_subtitle),
        hero_cta_label: stringSetting(s, 'hero_cta_label', DEFAULT_BRANDING_TEXT.hero_cta_label),
        section_discover_title: stringSetting(s, 'section_discover_title', DEFAULT_BRANDING_TEXT.section_discover_title),
        section_why_title: stringSetting(s, 'section_why_title', DEFAULT_BRANDING_TEXT.section_why_title),
        section_amenities_title: stringSetting(s, 'section_amenities_title', DEFAULT_BRANDING_TEXT.section_amenities_title),
        section_gallery_title: stringSetting(s, 'section_gallery_title', DEFAULT_BRANDING_TEXT.section_gallery_title),
        footer_tagline: stringSetting(s, 'footer_tagline', DEFAULT_BRANDING_TEXT.footer_tagline),
      })
      setGalleryItems(
        Array.from({ length: 12 }, (_, i) => ({
          title: stringSetting(s, `gallery_${i + 1}_title`, DEFAULT_GALLERY_PHOTOS[i].title),
          category: stringSetting(s, `gallery_${i + 1}_category`, DEFAULT_GALLERY_PHOTOS[i].category),
        }))
      )
    }
  }, [settings])

  function handleSave() {
    const payload: Record<string, unknown> = {}
    if (activeTab === 'Hotel') {
      Object.assign(payload, hotelForm)
    } else if (activeTab === 'Booking') {
      Object.assign(payload, bookingForm)
    } else if (activeTab === 'Taxes') {
      Object.assign(payload, taxForm)
    } else if (activeTab === 'Security') {
      Object.assign(payload, securityForm, {
        two_factor_auth: securityForm.two_factor_auth ? '1' : '0',
      })
    } else if (activeTab === 'Contact') {
      Object.assign(payload, contactForm, { contact_faq: JSON.stringify(faqItems) })
    } else if (activeTab === 'Payments') {
      Object.assign(payload, {
        online_gateway_enabled: paymentForm.online_gateway_enabled ? '1' : '0',
        online_gateway_base_url: paymentForm.online_gateway_base_url,
        online_gateway_api_key: paymentForm.online_gateway_api_key,
        online_gateway_webhook_secret: paymentForm.online_gateway_webhook_secret,
      })
    } else if (activeTab === 'Website') {
      Object.assign(payload, websiteForm)
      galleryItems.forEach((item, i) => {
        payload[`gallery_${i + 1}_title`] = item.title
        payload[`gallery_${i + 1}_category`] = item.category
      })
    }
    updateSettings.mutate(
      {
        settings: Object.entries(payload).map(([key, value]) => ({
          key,
          value: String(value),
          group: TAB_GROUP[activeTab],
        })),
      },
      {
        onSuccess: () => addToast('Settings saved successfully', 'success'),
        onError: () => addToast('Failed to save settings', 'error'),
      },
    )
  }

  if (error) {
    return (
      <div>
        <PageHeader title="General Settings" />
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-12 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-danger" />
          <p className="mb-2 text-sm font-medium text-foreground">Failed to load settings</p>
          <Button variant="outline" onClick={() => refetch()}>
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="General Settings" />

      <div className="mb-6 flex gap-1 rounded-lg bg-border/50 p-0.5 w-fit">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            {activeTab === 'Hotel' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Hotel Logo / Branding Image</h3>
                  <div className="flex items-center gap-4">
                    {(logoPreview || logoUrl) ? (
                      <img
                        src={logoPreview || logoUrl}
                        alt="Hotel logo"
                        className="h-16 w-16 rounded-lg border border-border bg-card object-contain p-1"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-lg border border-dashed border-border bg-bg flex items-center justify-center text-muted">
                        <Upload className="h-5 w-5" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <input
                        ref={logoFileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) setLogoPreview(URL.createObjectURL(file))
                        }}
                      />
                      <Button
                        variant="outline"
                        onClick={() => logoFileRef.current?.click()}
                      >
                        <Upload className="h-4 w-4" /> Choose File
                      </Button>
                      {(logoPreview || logoUrl) && (
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            disabled={!logoPreview || updateLogo.isPending}
                            onClick={() => {
                              const file = logoFileRef.current?.files?.[0]
                              if (!file) return
                              updateLogo.mutate(file, {
                                onSuccess: () => {
                                  addToast('Logo uploaded successfully', 'success')
                                  setLogoPreview('')
                                  if (logoFileRef.current) logoFileRef.current.value = ''
                                },
                                onError: () => addToast('Failed to upload logo', 'error'),
                              })
                            }}
                          >
                            {updateLogo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {logoPreview ? 'Upload' : 'Re-upload'}
                          </Button>
                          <Button
                            variant="outline"
                            disabled={deleteLogo.isPending}
                            onClick={() => {
                              deleteLogo.mutate(undefined, {
                                onSuccess: () => addToast('Logo removed', 'success'),
                                onError: () => addToast('Failed to remove logo', 'error'),
                              })
                            }}
                          >
                            <Trash2 className="h-4 w-4" /> Remove
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted">JPEG, PNG or WebP, up to 2MB. Shown in the guest portal header and on invoices.</p>
                </div>

                <Input
                  label="Hotel Name"
                  value={hotelForm.hotel_name}
                  onChange={(e) => setHotelForm((p) => ({ ...p, hotel_name: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Default Currency"
                    value={hotelForm.default_currency}
                    onChange={(e) => setHotelForm((p) => ({ ...p, default_currency: e.target.value }))}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </Select>
                  <Select
                    label="Timezone"
                    value={hotelForm.timezone}
                    onChange={(e) => setHotelForm((p) => ({ ...p, timezone: e.target.value }))}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </Select>
                </div>
              </div>
            )}

            {activeTab === 'Booking' && (
              <div className="space-y-4">
                <Input
                  label="Default Discount (%)"
                  type="number"
                  min={0}
                  max={100}
                  value={bookingForm.default_discount}
                  onChange={(e) => setBookingForm((p) => ({ ...p, default_discount: Number(e.target.value) }))}
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Cancellation Policy</label>
                  <textarea
                    className="flex min-h-[100px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm ring-offset-card placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
                    value={bookingForm.cancellation_policy}
                    onChange={(e) => setBookingForm((p) => ({ ...p, cancellation_policy: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Early Check-in Fee"
                    type="number"
                    min={0}
                    step="0.01"
                    value={bookingForm.early_checkin_fee}
                    onChange={(e) => setBookingForm((p) => ({ ...p, early_checkin_fee: Number(e.target.value) }))}
                  />
                  <Input
                    label="Late Check-out Fee"
                    type="number"
                    min={0}
                    step="0.01"
                    value={bookingForm.late_checkout_fee}
                    onChange={(e) => setBookingForm((p) => ({ ...p, late_checkout_fee: Number(e.target.value) }))}
                  />
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Check-out Time</label>
                    <div className="flex items-center gap-2">
                      <Select
                        aria-label="Check-out hour"
                        value={parseCheckoutTime(bookingForm.check_out_time).hour12}
                        onChange={(e) => setBookingForm((p) => ({
                          ...p,
                          check_out_time: buildCheckoutTime(
                            e.target.value,
                            parseCheckoutTime(p.check_out_time).minute,
                            parseCheckoutTime(p.check_out_time).meridiem,
                          ),
                        }))}
                      >
                        {CHECKOUT_HOUR_OPTIONS.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </Select>
                      <span className="text-sm text-muted">:</span>
                      <Select
                        aria-label="Check-out minute"
                        value={parseCheckoutTime(bookingForm.check_out_time).minute}
                        onChange={(e) => setBookingForm((p) => ({
                          ...p,
                          check_out_time: buildCheckoutTime(
                            parseCheckoutTime(p.check_out_time).hour12,
                            e.target.value,
                            parseCheckoutTime(p.check_out_time).meridiem,
                          ),
                        }))}
                      >
                        {CHECKOUT_MINUTE_OPTIONS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </Select>
                      <Select
                        aria-label="Check-out meridiem"
                        value={parseCheckoutTime(bookingForm.check_out_time).meridiem}
                        onChange={(e) => setBookingForm((p) => ({
                          ...p,
                          check_out_time: buildCheckoutTime(
                            parseCheckoutTime(p.check_out_time).hour12,
                            parseCheckoutTime(p.check_out_time).minute,
                            e.target.value as 'AM' | 'PM',
                          ),
                        }))}
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </Select>
                    </div>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted">Flat fee for same-day departures after the check-out time. Staying past the check-out date bills extra nights.</p>
                <div>
                  <Input
                    label="Maximum Advance Booking Days"
                    type="number"
                    min={0}
                    value={bookingForm.max_advance_days}
                    onChange={(e) => setBookingForm((p) => ({ ...p, max_advance_days: Number(e.target.value) }))}
                  />
                  <p className="mt-1 text-xs text-muted">How far in advance guests can book online (check-in date). Enter 0 for unlimited.</p>
                </div>
              </div>
            )}

            {activeTab === 'Taxes' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Tax Name"
                    value={taxForm.tax_name}
                    onChange={(e) => setTaxForm((p) => ({ ...p, tax_name: e.target.value }))}
                  />
                  <Input
                    label="Tax Rate (%)"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={taxForm.tax_rate}
                    onChange={(e) => setTaxForm((p) => ({ ...p, tax_rate: Number(e.target.value) }))}
                  />
                </div>
              </div>
            )}

            {activeTab === 'Security' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Input
                    label="Password Minimum Length"
                    type="number"
                    min={4}
                    value={securityForm.password_min_length}
                    onChange={(e) => setSecurityForm((p) => ({ ...p, password_min_length: Number(e.target.value) }))}
                  />
                  <Input
                    label="Session Timeout (minutes)"
                    type="number"
                    min={1}
                    value={securityForm.session_timeout}
                    onChange={(e) => setSecurityForm((p) => ({ ...p, session_timeout: Number(e.target.value) }))}
                  />
                  <Input
                    label="Max Login Attempts"
                    type="number"
                    min={1}
                    value={securityForm.max_login_attempts}
                    onChange={(e) => setSecurityForm((p) => ({ ...p, max_login_attempts: Number(e.target.value) }))}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/50"
                    checked={securityForm.two_factor_auth}
                    onChange={(e) => setSecurityForm((p) => ({ ...p, two_factor_auth: e.target.checked }))}
                  />
                  Enable Two-Factor Authentication
                </label>
              </div>
            )}

            {activeTab === 'Contact' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Page Content</h3>
                  <div className="space-y-4">
                    <Input
                      label="Hero Heading"
                      value={contactForm.contact_heading}
                      onChange={(e) => setContactForm((p) => ({ ...p, contact_heading: e.target.value }))}
                    />
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Hero Description</label>
                      <textarea
                        className="flex min-h-[60px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm ring-offset-card placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
                        value={contactForm.contact_description}
                        onChange={(e) => setContactForm((p) => ({ ...p, contact_description: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Contact Information</h3>
                  <div className="space-y-4">
                    <Input
                      label="Reception Hours"
                      value={contactForm.contact_reception_hours}
                      onChange={(e) => setContactForm((p) => ({ ...p, contact_reception_hours: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Address & Contact Details</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Address</label>
                      <textarea
                        className="flex min-h-[80px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm ring-offset-card placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
                        value={contactForm.hotel_address}
                        onChange={(e) => setContactForm((p) => ({ ...p, hotel_address: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Phone"
                        value={contactForm.hotel_phone}
                        onChange={(e) => setContactForm((p) => ({ ...p, hotel_phone: e.target.value }))}
                      />
                      <Input
                        label="Email"
                        type="email"
                        value={contactForm.hotel_email}
                        onChange={(e) => setContactForm((p) => ({ ...p, hotel_email: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Social Media</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <Input
                      label="Facebook URL"
                      value={contactForm.contact_facebook}
                      onChange={(e) => setContactForm((p) => ({ ...p, contact_facebook: e.target.value }))}
                      placeholder="https://facebook.com/..."
                    />
                    <Input
                      label="Instagram URL"
                      value={contactForm.contact_instagram}
                      onChange={(e) => setContactForm((p) => ({ ...p, contact_instagram: e.target.value }))}
                      placeholder="https://instagram.com/..."
                    />
                    <Input
                      label="TikTok URL"
                      value={contactForm.contact_tiktok}
                      onChange={(e) => setContactForm((p) => ({ ...p, contact_tiktok: e.target.value }))}
                      placeholder="https://tiktok.com/..."
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Map</h3>
                  <Input
                    label="Google Maps Embed URL"
                    value={contactForm.contact_map_embed_url}
                    onChange={(e) => setContactForm((p) => ({ ...p, contact_map_embed_url: e.target.value }))}
                    placeholder="https://www.google.com/maps/embed?pb=..."
                  />
                  <p className="mt-1 text-xs text-muted">Paste the embed URL from Google Maps (Share → Embed a map → copy the src URL).</p>
                  {contactForm.contact_map_embed_url && (
                    <div className="mt-3 rounded-lg overflow-hidden border border-border">
                      <iframe
                        src={contactForm.contact_map_embed_url}
                        width="100%"
                        height="200"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title="Map Preview"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">FAQ</h3>
                    <button
                      type="button"
                      onClick={() => setFaqItems((p) => [...p, { q: '', a: '' }])}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Question
                    </button>
                  </div>
                  <div className="space-y-3">
                    {faqItems.map((item, i) => (
                      <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <input
                            className="flex-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm ring-offset-card placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                            placeholder="Question"
                            value={item.q}
                            onChange={(e) => setFaqItems((p) => p.map((x, j) => j === i ? { ...x, q: e.target.value } : x))}
                          />
                          <button
                            type="button"
                            onClick={() => setFaqItems((p) => p.filter((_, j) => j !== i))}
                            className="p-1.5 text-muted hover:text-danger transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <textarea
                          className="flex min-h-[50px] w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm ring-offset-card placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                          placeholder="Answer"
                          value={item.a}
                          onChange={(e) => setFaqItems((p) => p.map((x, j) => j === i ? { ...x, a: e.target.value } : x))}
                        />
                      </div>
                    ))}
                    {faqItems.length === 0 && (
                      <p className="text-xs text-muted italic">No FAQ items. Click "Add Question" to create one.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Payments' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Online Payment Gateway</h3>
                  <p className="text-xs text-muted mb-4">Partner processor used when guests choose "Pay Online" on the portal.</p>

                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Enable Online Gateway</p>
                      <p className="text-xs text-muted mt-0.5">Let guests pay through the partner processor</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaymentForm((p) => ({ ...p, online_gateway_enabled: !p.online_gateway_enabled }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 ${
                        paymentForm.online_gateway_enabled ? 'bg-primary' : 'bg-border'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-card shadow ring-0 transition duration-200 ease-in-out ${
                          paymentForm.online_gateway_enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    <Input
                      label="Gateway Base URL"
                      value={paymentForm.online_gateway_base_url}
                      onChange={(e) => setPaymentForm((p) => ({ ...p, online_gateway_base_url: e.target.value }))}
                      placeholder="https://hardreset.onrender.com"
                    />
                    <Input
                      label="API Key"
                      type="password"
                      value={paymentForm.online_gateway_api_key}
                      onChange={(e) => setPaymentForm((p) => ({ ...p, online_gateway_api_key: e.target.value }))}
                      placeholder="Gateway API key"
                    />
                    <Input
                      label="Webhook Secret"
                      type="password"
                      value={paymentForm.online_gateway_webhook_secret}
                      onChange={(e) => setPaymentForm((p) => ({ ...p, online_gateway_webhook_secret: e.target.value }))}
                      placeholder="Shared secret for webhook verification"
                    />
                    <p className="text-xs text-muted">
                      These values are stored server-side and are never exposed on the public portal. The gateway sends
                      payment callbacks to <code className="text-foreground">POST /api/webhooks/payment</code>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Website' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Portal Theme</h3>
                  <Select
                    label="Color Theme"
                    value={websiteForm.theme_preset}
                    onChange={(e) => setWebsiteForm((p) => ({ ...p, theme_preset: e.target.value }))}
                  >
                    {THEME_PRESETS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </Select>
                  <p className="mt-1 text-xs text-muted">The selected palette restyles the whole guest portal.</p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Branding Images</h3>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted uppercase tracking-wide">Hero Image 1</p>
                      <ImageSlotUpload label="Hero Image 1" imageKey="hero_image_1" value={(settings as any)?.hero_image_1 || DEFAULT_HERO_IMAGES[0]} />
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted uppercase tracking-wide">Hero Image 2</p>
                      <ImageSlotUpload label="Hero Image 2" imageKey="hero_image_2" value={(settings as any)?.hero_image_2 || DEFAULT_HERO_IMAGES[1]} />
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted uppercase tracking-wide">Hero Image 3</p>
                      <ImageSlotUpload label="Hero Image 3" imageKey="hero_image_3" value={(settings as any)?.hero_image_3 || DEFAULT_HERO_IMAGES[2]} />
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted uppercase tracking-wide">Favicon</p>
                      <ImageSlotUpload label="Favicon" imageKey="hotel_favicon" value={(settings as any)?.hotel_favicon || ''} />
                      <p className="mt-1 text-xs text-muted">Shown in the browser tab for the guest portal.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Hero Section</h3>
                  <div className="space-y-4">
                    <Input
                      label="Badge"
                      value={websiteForm.hero_badge}
                      onChange={(e) => setWebsiteForm((p) => ({ ...p, hero_badge: e.target.value }))}
                    />
                    <Input
                      label="Headline"
                      value={websiteForm.hero_title}
                      onChange={(e) => setWebsiteForm((p) => ({ ...p, hero_title: e.target.value }))}
                    />
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Subtitle</label>
                      <textarea
                        className="flex min-h-[60px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm ring-offset-card placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
                        value={websiteForm.hero_subtitle}
                        onChange={(e) => setWebsiteForm((p) => ({ ...p, hero_subtitle: e.target.value }))}
                      />
                    </div>
                    <Input
                      label="CTA Button Label"
                      value={websiteForm.hero_cta_label}
                      onChange={(e) => setWebsiteForm((p) => ({ ...p, hero_cta_label: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Section Titles</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Accommodations Title"
                      value={websiteForm.section_discover_title}
                      onChange={(e) => setWebsiteForm((p) => ({ ...p, section_discover_title: e.target.value }))}
                    />
                    <Input
                      label="Why Stay Title"
                      value={websiteForm.section_why_title}
                      onChange={(e) => setWebsiteForm((p) => ({ ...p, section_why_title: e.target.value }))}
                    />
                    <Input
                      label="Amenities Title"
                      value={websiteForm.section_amenities_title}
                      onChange={(e) => setWebsiteForm((p) => ({ ...p, section_amenities_title: e.target.value }))}
                    />
                    <Input
                      label="Gallery Title"
                      value={websiteForm.section_gallery_title}
                      onChange={(e) => setWebsiteForm((p) => ({ ...p, section_gallery_title: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Footer</h3>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Tagline</label>
                    <textarea
                      className="flex min-h-[60px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm ring-offset-card placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
                      value={websiteForm.footer_tagline}
                      onChange={(e) => setWebsiteForm((p) => ({ ...p, footer_tagline: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">Gallery</h3>
                    <p className="text-xs text-muted">The first 6 photos also appear on the homepage. Leave an image empty to hide the slot.</p>
                  </div>
                  <div className="space-y-5">
                    {Array.from({ length: 12 }, (_, i) => (
                      <div key={i} className="rounded-lg border border-border p-4">
                        <p className="mb-3 text-xs font-semibold text-muted uppercase tracking-wide">Photo {i + 1}</p>
                        <div className="flex flex-col md:flex-row md:items-end gap-4">
                          <div className="md:w-80 shrink-0">
                            <ImageSlotUpload
                              label={`Gallery ${i + 1}`}
                              imageKey={`gallery_${i + 1}_image`}
                              value={(settings as any)?.[`gallery_${i + 1}_image`] || DEFAULT_GALLERY_PHOTOS[i].src}
                            />
                          </div>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Input
                              label="Title"
                              value={galleryItems[i].title}
                              onChange={(e) => setGalleryItems((p) => p.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                            />
                            <Select
                              label="Category"
                              value={galleryItems[i].category}
                              onChange={(e) => setGalleryItems((p) => p.map((x, j) => j === i ? { ...x, category: e.target.value } : x))}
                            >
                              {GALLERY_CATEGORIES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="sticky bottom-0 z-10 mt-6 flex justify-end border-t border-border bg-bg/95 py-3 backdrop-blur">
        <Button variant="primary" onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          <Save className="h-4 w-4" />
          Save Settings
        </Button>
      </div>
    </div>
  )
}