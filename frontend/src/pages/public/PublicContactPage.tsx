import { useState, useEffect, useMemo } from 'react'
import { usePublicSettings, useHotelName, useHotelSettings, usePublicSendContactMessage } from '@/hooks/usePublicApi'
import { Mail, Phone, MapPin, Clock, Send, ChevronDown, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

const SUBJECTS = [
  'General Inquiry',
  'Reservation Question',
  'Feedback & Suggestions',
  'Partnership Opportunity',
  'Event Planning',
  'Other',
]

const DEFAULT_FAQ = [
  {
    q: 'What time is check-in and check-out?',
    a: 'Check-in is available 24/7 at our front desk. Check-out time is 11:00 AM. Need more time? Ask our team about late check-out options.',
  },
  {
    q: 'Do you offer airport transfers?',
    a: 'Yes, we offer complimentary airport transfers for guests staying 3 nights or more. Contact our concierge to arrange your pickup.',
  },
  {
    q: 'Is breakfast included in the room rate?',
    a: 'Breakfast is included with select room types. Please check your booking details or contact us for more information.',
  },
]

export default function PublicContactPage() {
  const { data: s } = usePublicSettings('contact')
  const { data: bookingData } = usePublicSettings('booking')
  const hotelName = useHotelName()
  const hotel = useHotelSettings()
  const settings = (s ?? {}) as Record<string, any>
  const bookingSettings = (bookingData ?? {}) as Record<string, any>
  const cancellationPolicy = bookingSettings.cancellation_policy || ''

  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', website: '' })
  const [submitted, setSubmitted] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const sendMessage = usePublicSendContactMessage()

  const COOLDOWN_SECONDS = 120

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => c - 1), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  function formatCooldown(seconds: number) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  const heading = settings.contact_heading || 'Get in Touch'
  const description = settings.contact_description || 'Have a question or special request? We would love to hear from you.'
  const address = (hotel['hotel_address'] as string) || settings.contact_address || ''
  const phone = (hotel['hotel_phone'] as string) || settings.contact_phone || ''
  const email = (hotel['hotel_email'] as string) || settings.contact_email || ''
  const receptionHours = settings.contact_reception_hours || ''
  const mapUrl = settings.contact_map_embed_url || ''
  const facebook = settings.contact_facebook || '#'
  const instagram = settings.contact_instagram || '#'
  const tiktok = settings.contact_tiktok || '#'

  const faqItems = useMemo(() => {
    let items: { q: string; a: string }[]
    const raw = settings.contact_faq
    if (!raw) {
      items = [...DEFAULT_FAQ]
    } else {
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        items = Array.isArray(parsed) && parsed.length > 0 ? [...parsed] : [...DEFAULT_FAQ]
      } catch {
        items = [...DEFAULT_FAQ]
      }
    }
    if (cancellationPolicy) {
      const withoutCancellation = items.filter((i) => !/cancellation/i.test(i.q))
      withoutCancellation.push({ q: 'What is your cancellation policy?', a: cancellationPolicy })
      return withoutCancellation
    }
    return items
  }, [settings.contact_faq, cancellationPolicy])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (cooldown > 0) return
    sendMessage.mutate(form, {
      onSuccess: () => {
        setSubmitted(true)
        setForm({ name: '', email: '', subject: '', message: '', website: '' })
        setCooldown(COOLDOWN_SECONDS)
        setTimeout(() => setSubmitted(false), 4000)
      },
    })
  }

  const rateLimited = sendMessage.isError && (sendMessage.error as { status?: number })?.status === 429
  const retryAfter = rateLimited ? (sendMessage.error as { retryAfter?: number })?.retryAfter : undefined
  const buttonDisabled = sendMessage.isPending || cooldown > 0

  return (
    <div className="min-h-screen bg-dark">
      {/* Hero */}
      <section className="relative py-20 bg-dark">
        <div className="absolute inset-0 bg-gradient-to-b from-gold/5 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 text-center">
          <p className="section-subtitle mb-4">{hotelName}</p>
          <h1 className="font-serif text-4xl md:text-5xl text-white font-extralight mb-4">
            {heading}
          </h1>
          <div className="gold-line mx-auto mb-6" />
          <p className="text-white/40 text-sm max-w-lg mx-auto">
            {description}
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section className="bg-cream py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            {/* Contact Form */}
            <div className="lg:col-span-3">
              <h2 className="font-serif text-2xl text-dark font-light mb-2">Send Us a Message</h2>
              <p className="text-sm text-dark/40 mb-8">We typically respond within 24 hours.</p>

              {submitted ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                    <CheckCircle className="h-8 w-8 text-success" />
                  </div>
                  <h3 className="text-lg font-medium text-dark mb-2">Message Sent!</h3>
                  <p className="text-sm text-dark/50">Thank you for reaching out. We will get back to you soon.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div aria-hidden="true" className="absolute left-[-9999px] top-auto">
                    <label htmlFor="contact_website">Website</label>
                    <input
                      type="text"
                      id="contact_website"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={form.website}
                      onChange={(e) => setForm(p => ({ ...p, website: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="text-xs text-dark/40 uppercase tracking-[0.15em] block mb-1.5 font-medium">Your Name</label>
                      <input type="text" required value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Juan Dela Cruz" className="input-light" />
                    </div>
                    <div>
                      <label className="text-xs text-dark/40 uppercase tracking-[0.15em] block mb-1.5 font-medium">Email Address</label>
                      <input type="email" required value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} placeholder="juan@example.com" className="input-light" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-dark/40 uppercase tracking-[0.15em] block mb-1.5 font-medium">Subject</label>
                    <select required value={form.subject} onChange={(e) => setForm(p => ({ ...p, subject: e.target.value }))} className="select-light">
                      <option value="" disabled>Select a subject</option>
                      {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-dark/40 uppercase tracking-[0.15em] block mb-1.5 font-medium">Message</label>
                    <textarea required rows={5} value={form.message} onChange={(e) => setForm(p => ({ ...p, message: e.target.value }))} placeholder="Tell us how we can help..." className="input-light resize-none" />
                  </div>
                  <button
                    type="submit"
                    disabled={buttonDisabled}
                    className="btn-gold flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sendMessage.isPending
                      ? 'Sending...'
                      : cooldown > 0
                        ? `Wait ${formatCooldown(cooldown)}`
                        : 'Send Message'}
                  </button>
                  {cooldown > 0 && (
                    <p className="text-xs text-dark/50">
                      Thanks for your message. You can send another in {formatCooldown(cooldown)}.
                    </p>
                  )}
                  {sendMessage.isError && (
                    <p className="text-xs text-danger flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {rateLimited
                        ? retryAfter
                          ? `You've reached the message limit. Please try again in about ${Math.ceil(retryAfter / 60)} minute${Math.ceil(retryAfter / 60) > 1 ? 's' : ''}.`
                          : "You've reached the message limit. Please try again later."
                        : sendMessage.error instanceof Error ? sendMessage.error.message : 'Something went wrong. Please try again.'}
                    </p>
                  )}
                </form>
              )}
            </div>

            {/* Contact Info Card */}
            <div className="lg:col-span-2">
              <div className="bg-dark border border-white/5 rounded-2xl p-8 text-white sticky top-24">
                <h3 className="font-serif text-xl font-light mb-1">{hotelName}</h3>
                <p className="text-gold text-[11px] uppercase tracking-[0.2em] mb-8">Home Suites</p>

                <div className="space-y-6">
                  {address && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                        <MapPin className="h-4 w-4 text-gold" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.15em] text-white/40 mb-1">Address</p>
                        <p className="text-sm text-white/80 whitespace-pre-line">{address}</p>
                      </div>
                    </div>
                  )}

                  {phone && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                        <Phone className="h-4 w-4 text-gold" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.15em] text-white/40 mb-1">Phone</p>
                        <a href={`tel:${phone.replace(/\s/g, '')}`} className="text-sm text-white/80 hover:text-gold transition-colors">{phone}</a>
                      </div>
                    </div>
                  )}

                  {email && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                        <Mail className="h-4 w-4 text-gold" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.15em] text-white/40 mb-1">Email</p>
                        <a href={`mailto:${email}`} className="text-sm text-white/80 hover:text-gold transition-colors">{email}</a>
                      </div>
                    </div>
                  )}

                  {receptionHours && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                        <Clock className="h-4 w-4 text-gold" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.15em] text-white/40 mb-1">Reception Hours</p>
                        <p className="text-sm text-white/80">{receptionHours}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-6 border-t border-white/10">
                  <p className="text-xs uppercase tracking-[0.15em] text-white/30 mb-3">Follow Us</p>
                  <div className="flex gap-3">
                    {[
                      { label: 'Facebook', url: facebook },
                      { label: 'Instagram', url: instagram },
                      { label: 'TikTok', url: tiktok },
                    ].map(({ label, url }) => (
                      <a
                        key={label}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-9 h-9 rounded-full bg-white/5 hover:bg-gold/20 flex items-center justify-center transition-colors"
                        title={label}
                      >
                        <span className="text-[10px] text-white/50 hover:text-gold font-medium">{label[0]}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map */}
      {mapUrl && (
        <section className="bg-dark py-16 border-t border-white/5">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-8">
              <p className="section-subtitle mb-3">Location</p>
              <h2 className="font-serif text-2xl text-white font-light">Find Us</h2>
            </div>
            <div className="rounded-2xl overflow-hidden border border-white/10">
              <iframe
                src={mapUrl}
                width="100%"
                height="350"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Hotel Location"
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="bg-cream py-16">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-10">
            <p className="section-subtitle mb-3">FAQ</p>
            <h2 className="font-serif text-2xl text-dark font-light">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {faqItems.map((item: { q: string; a: string }, i: number) => (
              <div key={i} className="bg-dark/50 border border-white/5 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left"
                >
                  <span className="text-sm font-medium text-white/80">{item.q}</span>
                  <ChevronDown className={`h-4 w-4 text-white/20 shrink-0 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4">
                    <p className="text-sm text-white/50 leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
