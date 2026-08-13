import { describe, it, expect } from 'vitest'
import { formatCurrency, formatCurrencyWith, formatCheckoutTime, parseCheckoutTime, buildCheckoutTime } from './format'

describe('formatCurrencyWith', () => {
  it('formats with the given currency code', () => {
    expect(formatCurrencyWith(1500, 'USD')).toBe(new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'USD' }).format(1500))
  })

  it('falls back to PHP for empty or unknown codes', () => {
    expect(formatCurrencyWith(1500, '')).toBe(formatCurrency(1500))
    expect(formatCurrencyWith(1500, 'NOT_A_REAL_CODE')).toBe(formatCurrency(1500))
  })

  it('defaults to PHP when the code is missing', () => {
    expect(formatCurrencyWith(1500, undefined as unknown as string)).toBe(formatCurrency(1500))
  })
})

describe('formatCheckoutTime', () => {
  it('formats a 24h time as 12-hour display', () => {
    expect(formatCheckoutTime('12:00')).toBe('12:00 PM')
    expect(formatCheckoutTime('00:00')).toBe('12:00 AM')
    expect(formatCheckoutTime('09:30')).toBe('9:30 AM')
    expect(formatCheckoutTime('14:00')).toBe('2:00 PM')
  })

  it('falls back to 12:00 PM for empty or malformed input', () => {
    expect(formatCheckoutTime('')).toBe('12:00 PM')
    expect(formatCheckoutTime('bogus')).toBe('12:00 PM')
  })
})

describe('checkout time round-trip', () => {
  it('parse + build preserves the original 24h value', () => {
    for (const t of ['12:00', '14:00', '00:15', '09:45', '23:30']) {
      const p = parseCheckoutTime(t)
      expect(buildCheckoutTime(p.hour12, p.minute, p.meridiem)).toBe(t)
    }
  })
})
