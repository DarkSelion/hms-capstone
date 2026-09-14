import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: number
  name: string
  email: string
  role: string
}

interface AuthState {
  token: string | null
  user: User | null
  pendingOtp: boolean
  tempToken: string | null
  setAuth: (token: string, user: User) => void
  setPendingOtp: (tempToken: string) => void
  clearPendingOtp: () => void
  logout: () => void
}

// SECURITY: Token is stored in localStorage via zustand/persist middleware.
// For production, consider encrypting the token or using httpOnly cookies.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      pendingOtp: false,
      tempToken: null,
      setAuth: (token, user) => set({ token, user, pendingOtp: false, tempToken: null }),
      setPendingOtp: (tempToken) => set({ pendingOtp: true, tempToken }),
      clearPendingOtp: () => set({ pendingOtp: false, tempToken: null }),
      logout: () => set({ token: null, user: null, pendingOtp: false, tempToken: null }),
    }),
    { name: 'auth-storage' },
  ),
)
