import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSettings, useUpdateSettings, useUpdateLogo, useDeleteLogo } from '@/hooks/useApi'
import { ImageSlotUpload } from '@/components/admin/ImageSlotUpload'
import { DEFAULT_BRANDING_TEXT, DEFAULT_GALLERY_PHOTOS, DEFAULT_HERO_IMAGES, stringSetting } from '@/lib/branding'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { CHECKOUT_HOUR_OPTIONS, CHECKOUT_MINUTE_OPTIONS, parseCheckoutTime, buildCheckoutTime } from '@/lib/format'
import { stripPhoneInput } from '@/lib/phone'
import {
  AlertCircle, BadgePercent, Building2, CalendarCheck2, CheckCircle2, CircleOff, Clock, CreditCard,
  FileText, Globe, HelpCircle, Image as ImageIcon, Images, KeyRound, Loader2, Lock, Mail,
  Map as MapIcon, MapPin, Palette, PanelBottom, Percent, Plus, RotateCcw, Save, Share2, ShieldCheck,
  Sparkles, Trash2, Type, Upload,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type TabName = 'Hotel' | 'Booking' | 'Taxes' | 'Security' | 'Contact' | 'Payments' | 'Website'

interface NavItem {
  name: TabName
  icon: LucideIcon
  description: string
  tint: string
}

const SETTINGS_NAV: NavItem[] = [
  { name: 'Hotel', icon: Building2, description: 'Name, logo & locale', tint: 'bg-primary/10 text-primary' },
  { name: 'Booking', icon: CalendarCheck2, description: 'Policies, fees & limits', tint: 'bg-sky-100 text-sky-600' },
  { name: 'Taxes', icon: Percent, description: 'Tax name & rate', tint: 'bg-rose-100 text-rose-600' },
  { name: 'Security', icon: ShieldCheck, description: 'Passwords & sessions', tint: 'bg-indigo-100 text-indigo-600' },
  { name: 'Contact', icon: Mail, description: 'Details, map & FAQ', tint: 'bg-emerald-100 text-emerald-600' },
  { name: 'Payments', icon: CreditCard, description: 'Online payment gateway', tint: 'bg-amber-100 text-amber-600' },
  { name: 'Website', icon: Globe, description: 'Portal theme & content', tint: 'bg-fuchsia-100 text-fuchsia-600' },
]

const TAB_GROUP: Record<TabName, string> = {
  Hotel: 'hotel',
  Booking: 'booking',
  Taxes: 'tax',
  Security: 'security',
  Contact: 'contact',
  Payments: 'payment',
  Website: 'branding',
}

const THEME_SWATCHES = [
  { value: 'gold', label: 'Gold', description: 'Warm gold & cream (default)', colors: ['#2C2C2C', '#C4A88A', '#FAFAF8'] },
  { value: 'emerald', label: 'Emerald & Sage', description: 'Calm garden greens', colors: ['#22301F', '#7C9A6E', '#F4F7F1'] },
  { value: 'navy', label: 'Navy & Gold', description: 'Deep navy with brass', colors: ['#12233A', '#C0A062', '#F6F3EC'] },
  { value: 'neutral', label: 'Warm Neutral', description: 'Soft earthy taupe', colors: ['#2E2A26', '#B09A82', '#FAF8F5'] },
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

const TEXTAREA_CLASS =
  'flex w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground ring-offset-card placeholder:text-muted focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'

function SectionCard({
  icon: Icon,
  tint,
  title,
  description,
  action,
  children,
}: {
  icon: LucideIcon
  tint: string
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tint}`}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  )
}

function ToggleRow({
  id,
  title,
  description,
  checked,
  onChange,
  tone = 'default',
}: {
  id: string
  title: string
  description?: string
  checked: boolean
  onChange: (value: boolean) => void
  tone?: 'default' | 'warning'
}) {
  const highlighted = tone === 'warning' && checked
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${
        highlighted ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-bg'
      }`}
    >
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm font-semibold text-foreground">
          {title}
        </label>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>}
      </div>
      <label className="relative inline-flex shrink-0 cursor-pointer items-center">
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className={`h-6 w-11 rounded-full transition-colors duration-200 ${
            checked ? 'bg-primary' : 'bg-border'
          } peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50 peer-focus-visible:ring-offset-2`}
        />
        <span
          className={`pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </label>
    </div>
  )
}

function PesoInput({
  label,
  value,
  onChange,
  help,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  help?: string
}) {
  const inputId = useRef(`peso-${label.toLowerCase().replace(/\s+/g, '-')}`).current
  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-muted">₱</span>
        <input
          id={inputId}
          type="number"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-lg border border-border bg-card py-2 pl-8 pr-3 text-sm text-foreground ring-offset-card placeholder:text-muted focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        />
      </div>
      {help && <p className="mt-1 text-xs text-muted">{help}</p>}
    </div>
  )
}

export default function SettingsPage() {
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<TabName>(
    initialTab && SETTINGS_NAV.some((n) => n.name === initialTab) ? (initialTab as TabName) : 'Hotel'
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
    online_gateway_self_settle: false,
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
        online_gateway_self_settle: s.online_gateway_self_settle === '1' || s.online_gateway_self_settle === true,
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
        online_gateway_self_settle: paymentForm.online_gateway_self_settle ? '1' : '0',
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
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
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
      <PageHeader
        title="General Settings"
        description="Configure how your hotel runs — branding, booking policies, payments and the guest portal."
      />

      <div className="lg:flex lg:items-start lg:gap-8">
        <nav className="mb-6 lg:mb-0 lg:w-64 lg:shrink-0" aria-label="Settings sections">
          <div className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-24 lg:flex-col lg:gap-1 lg:overflow-visible lg:rounded-2xl lg:border lg:border-gray-200 lg:bg-white lg:p-2 lg:shadow-sm">
            {SETTINGS_NAV.map((item) => {
              const active = activeTab === item.name
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setActiveTab(item.name)}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left transition-all duration-150 lg:w-full lg:whitespace-normal ${
                    active ? 'bg-orange-50 shadow-sm' : 'hover:bg-bg'
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 hidden h-6 w-[3px] -translate-y-1/2 rounded-full bg-amber-400 lg:block" />
                  )}
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      active ? item.tint : 'bg-bg text-muted group-hover:text-foreground'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-medium leading-tight ${active ? 'text-primary-dark' : 'text-foreground'}`}>
                      {item.name}
                    </span>
                    <span className="hidden text-xs text-muted lg:block">{item.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          {isLoading ? (
            <div className="space-y-6">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-xl" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <Skeleton key={j} className="h-10 w-full" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {activeTab === 'Hotel' && (
                <>
                  <SectionCard
                    icon={ImageIcon}
                    tint="bg-sky-100 text-sky-600"
                    title="Hotel Logo"
                    description="Shown in the guest portal header and on invoices."
                  >
                    <div className="flex items-center gap-5">
                      {(logoPreview || logoUrl) ? (
                        <img
                          src={logoPreview || logoUrl}
                          alt="Hotel logo"
                          className="h-20 w-20 rounded-xl border border-gray-200 bg-white object-contain p-1.5 shadow-sm"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-bg text-muted">
                          <Upload className="h-6 w-6" />
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
                        <Button variant="outline" onClick={() => logoFileRef.current?.click()}>
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
                    <p className="mt-3 text-xs text-muted">JPEG, PNG or WebP, up to 2MB.</p>
                  </SectionCard>

                  <SectionCard
                    icon={Building2}
                    tint="bg-primary/10 text-primary"
                    title="Property Details"
                    description="Basic identity of your property."
                  >
                    <div className="space-y-4">
                      <Input
                        label="Hotel Name"
                        value={hotelForm.hotel_name}
                        onChange={(e) => setHotelForm((p) => ({ ...p, hotel_name: e.target.value }))}
                      />
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  </SectionCard>
                </>
              )}

              {activeTab === 'Booking' && (
                <>
                  <SectionCard
                    icon={BadgePercent}
                    tint="bg-violet-100 text-violet-600"
                    title="Discounts & Policies"
                    description="Defaults applied to new bookings."
                  >
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
                          className={`${TEXTAREA_CLASS} min-h-[100px]`}
                          value={bookingForm.cancellation_policy}
                          onChange={(e) => setBookingForm((p) => ({ ...p, cancellation_policy: e.target.value }))}
                        />
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    icon={Clock}
                    tint="bg-sky-100 text-sky-600"
                    title="Fees & Schedule"
                    description="Charges and time rules for arrivals and departures."
                  >
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <PesoInput
                          label="Early Check-in Fee"
                          value={bookingForm.early_checkin_fee}
                          onChange={(v) => setBookingForm((p) => ({ ...p, early_checkin_fee: v }))}
                          help="Flat fee for arriving earlier than the booked date."
                        />
                        <PesoInput
                          label="Late Check-out Fee"
                          value={bookingForm.late_checkout_fee}
                          onChange={(v) => setBookingForm((p) => ({ ...p, late_checkout_fee: v }))}
                          help="Flat fee for same-day departures after the check-out time."
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                        <div>
                          <Input
                            label="Maximum Advance Booking Days"
                            type="number"
                            min={0}
                            value={bookingForm.max_advance_days}
                            onChange={(e) => setBookingForm((p) => ({ ...p, max_advance_days: Number(e.target.value) }))}
                          />
                          <p className="mt-1 text-xs text-muted">How far in advance guests can book online. Enter 0 for unlimited.</p>
                        </div>
                      </div>
                      <p className="rounded-xl bg-bg px-4 py-3 text-xs leading-relaxed text-muted">
                        Staying past the booked check-out date bills extra nights at check-out — only same-day late departures are charged the flat fee.
                      </p>
                    </div>
                  </SectionCard>
                </>
              )}

              {activeTab === 'Taxes' && (
                <SectionCard
                  icon={Percent}
                  tint="bg-rose-100 text-rose-600"
                  title="Tax Configuration"
                  description="Applied to booking totals on the portal and invoices."
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                </SectionCard>
              )}

              {activeTab === 'Security' && (
                <>
                  <SectionCard
                    icon={Lock}
                    tint="bg-indigo-100 text-indigo-600"
                    title="Password & Sessions"
                    description="Login hardening for staff accounts."
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                  </SectionCard>

                  <SectionCard
                    icon={KeyRound}
                    tint="bg-emerald-100 text-emerald-600"
                    title="Two-Factor Authentication"
                    description="Extra verification code at staff sign-in."
                  >
                    <ToggleRow
                      id="two_factor_auth"
                      title="Enable Two-Factor Authentication"
                      description="Requires a second verification step when staff sign in."
                      checked={securityForm.two_factor_auth}
                      onChange={(v) => setSecurityForm((p) => ({ ...p, two_factor_auth: v }))}
                    />
                  </SectionCard>
                </>
              )}

              {activeTab === 'Contact' && (
                <>
                  <SectionCard
                    icon={FileText}
                    tint="bg-sky-100 text-sky-600"
                    title="Page Content"
                    description="Heading and intro shown on the portal contact page."
                  >
                    <div className="space-y-4">
                      <Input
                        label="Hero Heading"
                        value={contactForm.contact_heading}
                        onChange={(e) => setContactForm((p) => ({ ...p, contact_heading: e.target.value }))}
                      />
                      <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">Hero Description</label>
                        <textarea
                          className={`${TEXTAREA_CLASS} min-h-[60px]`}
                          value={contactForm.contact_description}
                          onChange={(e) => setContactForm((p) => ({ ...p, contact_description: e.target.value }))}
                        />
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    icon={MapPin}
                    tint="bg-emerald-100 text-emerald-600"
                    title="Address & Contact Details"
                    description="Where guests can find and reach you."
                  >
                    <div className="space-y-4">
                      <Input
                        label="Reception Hours"
                        value={contactForm.contact_reception_hours}
                        onChange={(e) => setContactForm((p) => ({ ...p, contact_reception_hours: e.target.value }))}
                      />
                      <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">Address</label>
                        <textarea
                          className={`${TEXTAREA_CLASS} min-h-[80px]`}
                          value={contactForm.hotel_address}
                          onChange={(e) => setContactForm((p) => ({ ...p, hotel_address: e.target.value }))}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input
                          label="Phone"
                          value={contactForm.hotel_phone}
                          onChange={(e) => setContactForm((p) => ({ ...p, hotel_phone: stripPhoneInput(e.target.value) }))}
                          placeholder="+63 912 345 6789"
                          maxLength={15}
                        />
                        <Input
                          label="Email"
                          type="email"
                          value={contactForm.hotel_email}
                          onChange={(e) => setContactForm((p) => ({ ...p, hotel_email: e.target.value }))}
                        />
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    icon={Share2}
                    tint="bg-fuchsia-100 text-fuchsia-600"
                    title="Social Media"
                    description="Links shown in the portal footer. Empty links are hidden."
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                  </SectionCard>

                  <SectionCard
                    icon={MapIcon}
                    tint="bg-teal-100 text-teal-600"
                    title="Map"
                    description="Embedded location preview on the contact page."
                  >
                    <div className="space-y-3">
                      <div>
                        <Input
                          label="Google Maps Embed URL"
                          value={contactForm.contact_map_embed_url}
                          onChange={(e) => setContactForm((p) => ({ ...p, contact_map_embed_url: e.target.value }))}
                          placeholder="https://www.google.com/maps/embed?pb=..."
                        />
                        <p className="mt-1 text-xs text-muted">Paste the embed URL from Google Maps (Share → Embed a map → copy the src URL).</p>
                      </div>
                      {contactForm.contact_map_embed_url && (
                        <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
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
                  </SectionCard>

                  <SectionCard
                    icon={HelpCircle}
                    tint="bg-amber-100 text-amber-600"
                    title="FAQ"
                    description="Questions shown at the bottom of the contact page."
                    action={
                      <button
                        type="button"
                        onClick={() => setFaqItems((p) => [...p, { q: '', a: '' }])}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-orange-50"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Question
                      </button>
                    }
                  >
                    <div className="space-y-3">
                      {faqItems.map((item, i) => (
                        <div key={i} className="space-y-2 rounded-xl border border-gray-200 bg-bg p-3">
                          <div className="flex items-start gap-2">
                            <input
                              className={`${TEXTAREA_CLASS} flex-1 py-1.5`}
                              placeholder="Question"
                              value={item.q}
                              onChange={(e) => setFaqItems((p) => p.map((x, j) => j === i ? { ...x, q: e.target.value } : x))}
                            />
                            <button
                              type="button"
                              onClick={() => setFaqItems((p) => p.filter((_, j) => j !== i))}
                              className="rounded-md p-1.5 text-muted transition-colors hover:bg-red-50 hover:text-danger"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <textarea
                            className={`${TEXTAREA_CLASS} min-h-[50px]`}
                            placeholder="Answer"
                            value={item.a}
                            onChange={(e) => setFaqItems((p) => p.map((x, j) => j === i ? { ...x, a: e.target.value } : x))}
                          />
                        </div>
                      ))}
                      {faqItems.length === 0 && (
                        <p className="text-xs italic text-muted">No FAQ items. Click "Add Question" to create one.</p>
                      )}
                    </div>
                  </SectionCard>
                </>
              )}

              {activeTab === 'Payments' && (
                <>
                  <div
                    className={`flex items-center gap-3 rounded-2xl border p-4 shadow-sm ${
                      paymentForm.online_gateway_enabled ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        paymentForm.online_gateway_enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-bg text-muted'
                      }`}
                    >
                      {paymentForm.online_gateway_enabled ? <CheckCircle2 className="h-4 w-4" /> : <CircleOff className="h-4 w-4" />}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {paymentForm.online_gateway_enabled ? 'Online payments are live' : 'Online payments are currently disabled'}
                      </p>
                      <p className="text-xs text-muted">
                        {paymentForm.online_gateway_enabled
                          ? 'Guests can pay their bookings through the partner gateway.'
                          : 'Turn on the gateway below to accept online payments.'}
                      </p>
                    </div>
                  </div>

                  <SectionCard
                    icon={CreditCard}
                    tint="bg-amber-100 text-amber-600"
                    title="Online Payment Gateway"
                    description='Partner processor used when guests choose "Pay Online" on the portal.'
                  >
                    <div className="space-y-3">
                      <ToggleRow
                        id="online_gateway_enabled"
                        title="Enable Online Gateway"
                        description="Let guests pay through the partner processor."
                        checked={paymentForm.online_gateway_enabled}
                        onChange={(v) => setPaymentForm((p) => ({ ...p, online_gateway_enabled: v }))}
                      />
                      <ToggleRow
                        id="online_gateway_self_settle"
                        tone="warning"
                        title="Allow Guest Self-Settlement"
                        description="Lets the owning guest mark their own booking as paid after the checkout redirect (demo/testing only). Recommended OFF in production — the webhook is the trusted settlement path."
                        checked={paymentForm.online_gateway_self_settle}
                        onChange={(v) => setPaymentForm((p) => ({ ...p, online_gateway_self_settle: v }))}
                      />
                    </div>
                    <div className="mt-5 space-y-4 border-t border-gray-100 pt-5">
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
                      <p className="rounded-xl bg-bg px-4 py-3 text-xs leading-relaxed text-muted">
                        These values are stored server-side and are never exposed on the public portal. The gateway sends payment callbacks to{' '}
                        <code className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] text-foreground ring-1 ring-gray-200">POST /api/webhooks/payment</code>.
                      </p>
                    </div>
                  </SectionCard>
                </>
              )}

              {activeTab === 'Website' && (
                <>
                  <SectionCard
                    icon={Palette}
                    tint="bg-violet-100 text-violet-600"
                    title="Portal Theme"
                    description="The selected palette restyles the whole guest portal."
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      {THEME_SWATCHES.map((t) => {
                        const selected = websiteForm.theme_preset === t.value
                        return (
                          <button
                            key={t.value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setWebsiteForm((p) => ({ ...p, theme_preset: t.value }))}
                            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                              selected
                                ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200'
                                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-bg'
                            }`}
                          >
                            <span className="flex shrink-0 -space-x-1.5">
                              {t.colors.map((c) => (
                                <span key={c} className="h-6 w-6 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: c }} />
                              ))}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-foreground">{t.label}</span>
                              <span className="block truncate text-xs text-muted">{t.description}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </SectionCard>

                  <SectionCard
                    icon={Images}
                    tint="bg-sky-100 text-sky-600"
                    title="Branding Images"
                    description="Hero slideshow photos and the browser-tab favicon."
                  >
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Hero Image 1</p>
                        <ImageSlotUpload label="Hero Image 1" imageKey="hero_image_1" value={(settings as any)?.hero_image_1 || DEFAULT_HERO_IMAGES[0]} />
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Hero Image 2</p>
                        <ImageSlotUpload label="Hero Image 2" imageKey="hero_image_2" value={(settings as any)?.hero_image_2 || DEFAULT_HERO_IMAGES[1]} />
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Hero Image 3</p>
                        <ImageSlotUpload label="Hero Image 3" imageKey="hero_image_3" value={(settings as any)?.hero_image_3 || DEFAULT_HERO_IMAGES[2]} />
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Favicon</p>
                        <ImageSlotUpload label="Favicon" imageKey="hotel_favicon" value={(settings as any)?.hotel_favicon || ''} />
                        <p className="mt-1 text-xs text-muted">Shown in the browser tab for the guest portal.</p>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    icon={Sparkles}
                    tint="bg-amber-100 text-amber-600"
                    title="Hero Section"
                    description="The first thing guests see on the homepage."
                  >
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
                          className={`${TEXTAREA_CLASS} min-h-[60px]`}
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
                  </SectionCard>

                  <SectionCard
                    icon={Type}
                    tint="bg-teal-100 text-teal-600"
                    title="Section Titles"
                    description="Headings for each homepage block."
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  </SectionCard>

                  <SectionCard
                    icon={PanelBottom}
                    tint="bg-slate-100 text-slate-600"
                    title="Footer"
                    description="Tagline shown under the portal footer brand."
                  >
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Tagline</label>
                      <textarea
                        className={`${TEXTAREA_CLASS} min-h-[60px]`}
                        value={websiteForm.footer_tagline}
                        onChange={(e) => setWebsiteForm((p) => ({ ...p, footer_tagline: e.target.value }))}
                      />
                    </div>
                  </SectionCard>

                  <SectionCard
                    icon={ImageIcon}
                    tint="bg-pink-100 text-pink-600"
                    title="Gallery"
                    description="12 photo slots — the first 6 also appear on the homepage. Leave an image empty to hide the slot."
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      {Array.from({ length: 12 }, (_, i) => (
                        <div key={i} className="rounded-xl border border-gray-200 bg-bg/50 p-4">
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Photo {i + 1}</p>
                          <ImageSlotUpload
                            label={`Gallery ${i + 1}`}
                            imageKey={`gallery_${i + 1}_image`}
                            value={(settings as any)?.[`gallery_${i + 1}_image`] || DEFAULT_GALLERY_PHOTOS[i].src}
                          />
                          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      ))}
                    </div>
                  </SectionCard>
                </>
              )}
            </div>
          )}

          {!isLoading && !error && (
            <div className="sticky bottom-0 z-10 mt-6 flex items-center justify-end gap-3 rounded-t-2xl border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] backdrop-blur">
              <p className="mr-auto hidden text-xs text-muted sm:block">
                Saving applies to the <span className="font-semibold text-foreground">{activeTab}</span> tab only
              </p>
              <Button variant="primary" onClick={handleSave} disabled={updateSettings.isPending}>
                {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Settings
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
