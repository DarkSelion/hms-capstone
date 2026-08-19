import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { publicApi } from '@/lib/publicApi'
import { usePublicAuthStore } from '@/stores/publicAuthStore'
import type {
  PublicAuthResponse,
  PublicUser,
  PublicRoomType,
  PublicRoom,
  PublicReservationsResponse,
  PublicReservation,
} from '@/types'

// Auth
export function usePublicLogin() {
  const { setAuth } = usePublicAuthStore()
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      publicApi.post<PublicAuthResponse>('/public/login', data),
    onSuccess: (res) => {
      setAuth(res.token, res.user)
    },
  })
}

export function usePublicRegister() {
  const { setAuth } = usePublicAuthStore()
  return useMutation({
    mutationFn: (data: {
      first_name: string; last_name: string; email: string;
      phone: string; password: string; password_confirmation: string;
    }) => publicApi.post<PublicAuthResponse>('/public/register', data),
    onSuccess: (res) => {
      setAuth(res.token, res.user)
    },
  })
}

export function usePublicMe() {
  const token = usePublicAuthStore((s) => s.token)
  return useQuery({
    queryKey: ['public-me'],
    queryFn: () => publicApi.get<PublicUser>('/public/me'),
    enabled: !!token,
  })
}

// Room Types
export function usePublicRoomTypes(params?: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v) })
  }
  const qs = query.toString()
  return useQuery({
    queryKey: ['public-room-types', params],
    queryFn: () => publicApi.get<PublicRoomType[]>('/public/rooms' + (qs ? '?' + qs : '')),
  })
}

export function usePublicRoomType(slug: string | undefined) {
  return useQuery({
    queryKey: ['public-room-type', slug],
    queryFn: () => publicApi.get<PublicRoomType>('/public/rooms/' + slug),
    enabled: !!slug,
  })
}

export function usePublicAvailableRooms(params?: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([k, v]) => { if (v) query.set(k, v) })
  }
  const qs = query.toString()
  return useQuery({
    queryKey: ['public-available-rooms', params],
    queryFn: () => publicApi.get<PublicRoom[]>('/public/rooms/available' + (qs ? '?' + qs : '')),
    enabled: !!params?.check_in && !!params?.check_out,
  })
}

// Reservations
export function usePublicReservations() {
  const token = usePublicAuthStore((s) => s.token)
  return useQuery({
    queryKey: ['public-reservations'],
    queryFn: () => publicApi.get<PublicReservationsResponse>('/public/reservations'),
    enabled: !!token,
  })
}

export function usePublicReservation(id: number | undefined) {
  const token = usePublicAuthStore((s) => s.token)
  return useQuery({
    queryKey: ['public-reservation', id],
    queryFn: () => publicApi.get<PublicReservation>('/public/reservations/' + id),
    enabled: !!token && !!id,
  })
}

export function usePublicCreateReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      room_type_id: number; check_in: string; check_out: string;
      adults: number; children?: number; special_requests?: string;
    }) => publicApi.post<PublicReservation>('/public/reservations', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['public-reservations'] })
    },
  })
}

export function usePublicCancelReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => publicApi.post<{ message: string }>('/public/reservations/' + id + '/cancel'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['public-reservations'] })
    },
  })
}

// Settings (public)
export function usePublicSettings(group: string) {
  return useQuery({
    queryKey: ['public-settings', group],
    queryFn: () => publicApi.get<Record<string, unknown>>('/public/settings/' + group),
  })
}

export const DEFAULT_HOTEL_NAME = 'Pampanga Home Suites'

export function useHotelSettings(): Record<string, unknown> {
  const { data } = usePublicSettings('hotel')
  return (data ?? {}) as Record<string, unknown>
}

export function useHotelName(): string {
  const settings = useHotelSettings()
  const name = settings['hotel_name']
  return typeof name === 'string' && name.trim() ? name.trim() : DEFAULT_HOTEL_NAME
}

export function usePortalCurrency(): string {
  const settings = useHotelSettings()
  const code = settings['default_currency']
  return typeof code === 'string' && code.trim() ? code.trim().toUpperCase() : 'PHP'
}

export function useBrandingSettings(): Record<string, unknown> {
  const { data } = usePublicSettings('branding')
  return (data ?? {}) as Record<string, unknown>
}

export function usePaymentSettings(): Record<string, unknown> {
  const { data } = usePublicSettings('payment')
  return (data ?? {}) as Record<string, unknown>
}

// Payments
export function usePublicInitiateOnlinePayment() {
  return useMutation({
    mutationFn: (reservationId: number) =>
      publicApi.post<{ redirect_url: string }>('/public/payments/initiate-online', { reservation_id: reservationId }),
  })
}

export function usePublicConfirmOnlinePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reservationId: number) =>
      publicApi.post<{ message: string; reservation: PublicReservation }>(
        '/public/payments/confirm-online',
        { reservation_id: reservationId },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['public-reservations'] })
    },
  })
}

// Contact
export function usePublicSendContactMessage() {
  return useMutation({
    mutationFn: (data: { name: string; email: string; subject: string; message: string }) =>
      publicApi.post<{ message: string }>('/public/contact', data),
  })
}

// Profile
export function usePublicUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => publicApi.put<PublicUser>('/public/profile', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['public-me'] })
    },
  })
}

export function usePublicDeleteAccount() {
  const { logout } = usePublicAuthStore()
  return useMutation({
    mutationFn: () => publicApi.delete<{ message: string }>('/public/profile'),
    onSuccess: () => {
      logout()
    },
  })
}