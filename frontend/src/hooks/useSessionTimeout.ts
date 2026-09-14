import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'

interface TokenInfo {
  expires_at: string | null
  last_used_at: string | null
}

const WARNING_BEFORE_MS = 5 * 60 * 1000 // 5 minutes before expiry

export function useSessionTimeout() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const setAuth = useAuthStore((s) => s.setAuth)
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)

  // Fetch token info on mount and periodically
  const fetchTokenInfo = useCallback(async () => {
    if (!token) return
    try {
      const info = await api.get<TokenInfo>('/auth/token-info')
      if (info.expires_at) {
        setExpiresAt(new Date(info.expires_at))
      }
    } catch {
      // Token might be expired already
    }
  }, [token])

  useEffect(() => {
    fetchTokenInfo()
    const interval = setInterval(fetchTokenInfo, 5 * 60 * 1000) // Refresh every 5 min
    return () => clearInterval(interval)
  }, [fetchTokenInfo])

  // Countdown timer
  useEffect(() => {
    if (!expiresAt || !token) return

    const tick = () => {
      const now = Date.now()
      const expiry = expiresAt.getTime()
      const remaining = expiry - now

      if (remaining <= 0) {
        setShowWarning(false)
        logout()
        return
      }

      setSecondsLeft(Math.floor(remaining / 1000))

      if (remaining <= WARNING_BEFORE_MS && remaining > 0) {
        setShowWarning(true)
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [expiresAt, token, logout])

  // Actual token rotation — revoke old token, issue new one
  const extendSession = useCallback(async () => {
    try {
      const response = await api.post<{ token: string; expires_at: string }>('/auth/refresh-token')
      // Swap to the new token
      if (user) {
        setAuth(response.token, user)
      }
      setShowWarning(false)
      // Re-fetch token info with new expiry
      if (response.expires_at) {
        setExpiresAt(new Date(response.expires_at))
      }
    } catch {
      // If refresh fails (token already expired/revoked), logout
      logout()
    }
  }, [user, setAuth, logout])

  const dismissWarning = useCallback(() => {
    setShowWarning(false)
  }, [])

  return {
    showWarning,
    secondsLeft,
    extendSession,
    dismissWarning,
  }
}
