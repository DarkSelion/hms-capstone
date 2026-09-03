const PH_PHONE_REGEX = /^(\+63\s?|0)\d{8,13}$/

export function isValidPHPhone(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  return PH_PHONE_REGEX.test(trimmed)
}

export function stripPhoneInput(value: string): string {
  return value.replace(/[^0-9+\s]/g, '')
}

export const PH_PHONE_MAX_LENGTH = 15
