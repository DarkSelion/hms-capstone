import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PublicUser {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string
  address?: string
  city?: string
  country?: string
  nationality?: string
  date_of_birth?: string
  gender?: string
  is_blacklisted?: boolean
  email_verified_at?: string | null
}

interface PublicAuthState {
  token: string | null
  user: PublicUser | null
  setAuth: (token: string, user: PublicUser) => void
  logout: () => void
}

// SECURITY: Token is stored in localStorage via zustand/persist middleware.
// For production, consider encrypting the token or using httpOnly cookies.
export const usePublicAuthStore = create<PublicAuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'public-auth-storage' },
  ),
)
