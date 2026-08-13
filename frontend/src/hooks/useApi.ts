import { useState, useEffect } from 'react'
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, downloadFile } from '@/lib/api'
import type {
  DashboardStats, RevenueData, BookingSourceData, OccupancyData, RoomTypeData,
  Reservation, PaginatedResponse, Guest, GuestHistory, Room, RoomImage, RoomType,
  Payment, Invoice, HousekeepingTask, MaintenanceRequest, Technician,
  Expense, ExpenseSummary, User, Role, ActivityLog, ApiResponse, StaffSchedule, LeaveRequest, ContactMessage,
  CheckoutPreview,
} from '@/types'

function buildQueryString(params?: Record<string, string | number | undefined | null>): string {
  if (!params) return ''
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value))
    }
  })
  return searchParams.toString()
}

// ── Dashboard ──────────────────────────────────────────

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => api.get<DashboardStats>('/dashboard/stats'),
  })
}

export function useDashboardRevenue(params?: Record<string, string | number | undefined>) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['dashboard', 'revenue', params],
    queryFn: () => api.get<RevenueData[]>(`/dashboard/revenue?${qs}`),
  })
}

export function useDashboardOccupancy(params?: Record<string, string | number | undefined>) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['dashboard', 'occupancy', params],
    queryFn: () => api.get<OccupancyData[]>(`/dashboard/occupancy?${qs}`),
  })
}

export function useBookingSources() {
  return useQuery({
    queryKey: ['dashboard', 'booking-sources'],
    queryFn: () => api.get<BookingSourceData[]>('/dashboard/booking-sources'),
  })
}

export function useRecentActivities() {
  return useQuery({
    queryKey: ['dashboard', 'recent-activities'],
    queryFn: () => api.get<ActivityLog[]>('/dashboard/recent-activities'),
  })
}

export function useTopRoomTypes() {
  return useQuery({
    queryKey: ['dashboard', 'top-room-types'],
    queryFn: () => api.get<RoomTypeData[]>('/dashboard/top-room-types'),
  })
}

// ── Reservations ───────────────────────────────────────

export function useReservations(params?: Record<string, string | number | undefined>) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['reservations', params],
    queryFn: () => api.get<PaginatedResponse<Reservation>>(`/reservations?${qs}`),
  })
}

export function useReservation(id: number) {
  return useQuery({
    queryKey: ['reservations', id],
    queryFn: () => api.get<ApiResponse<Reservation>>(`/reservations/${id}`),
    enabled: !!id,
  })
}

export function useCreateReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post<ApiResponse<Reservation>>('/reservations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['guests'] })
    },
  })
}

export function useUpdateReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) =>
      api.put<ApiResponse<Reservation>>(`/reservations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['guests'] })
    },
  })
}

export function useDeleteReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/reservations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['guests'] })
    },
  })
}

export function useCheckIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post(`/reservations/${id}/check-in`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['guests'] })
    },
  })
}

export function useCheckOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, actual_check_out }: { id: number; actual_check_out?: string }) =>
      api.post(`/reservations/${id}/check-out`, actual_check_out ? { actual_check_out } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['guests'] })
    },
  })
}

export function useCheckoutPreview(id: number, actualCheckOut?: string) {
  const queryKey = ['reservations', id, 'checkout-preview', actualCheckOut ?? 'today']
  return useQuery({
    queryKey,
    queryFn: () => {
      const qs = actualCheckOut ? `?actual_check_out=${encodeURIComponent(actualCheckOut)}` : ''
      return api.get<CheckoutPreview>(`/reservations/${id}/checkout-preview${qs}`)
    },
    enabled: !!id,
  })
}

export function useCancelReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post(`/reservations/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['guests'] })
    },
  })
}

export function useMarkNoShow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post(`/reservations/${id}/no-show`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['guests'] })
    },
  })
}

export function useExtendStay() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, new_check_out }: { id: number; new_check_out: string }) =>
      api.post<ApiResponse<Reservation>>(`/reservations/${id}/extend-stay`, { new_check_out }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['guests'] })
    },
  })
}

export function useRefreshOverdue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ count: number; reservation_ids: number[] }>('/reservations/refresh-overdue'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useCheckInOutWithPayment() {
  const checkIn = useCheckIn()
  const checkOut = useCheckOut()
  const isLoading = checkIn.isPending || checkOut.isPending

  const performStatusChange = async (
    action: 'check-in' | 'check-out',
    reservation: Reservation,
    actualCheckOut?: string,
  ) => {
    if (action === 'check-in') await checkIn.mutateAsync(reservation.id)
    else await checkOut.mutateAsync({ id: reservation.id, actual_check_out: actualCheckOut })
  }

  return { performStatusChange, isLoading }
}

// ── Guests ─────────────────────────────────────────────

export function useGuests(params?: Record<string, string | number | undefined>) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['guests', params],
    queryFn: () => api.get<PaginatedResponse<Guest>>(`/guests?${qs}`),
  })
}

export function useGuest(id: number) {
  return useQuery({
    queryKey: ['guests', id],
    queryFn: () => api.get<Guest>(`/guests/${id}`),
    enabled: !!id,
  })
}

export function useGuestHistory(id: number) {
  return useQuery({
    queryKey: ['guests', id, 'history'],
    queryFn: () => api.get<GuestHistory>(`/guests/${id}/history`),
    enabled: !!id,
  })
}

export function useCreateGuest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post<ApiResponse<Guest>>('/guests', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guests'] })
    },
  })
}

export function useUpdateGuest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) =>
      api.put<ApiResponse<Guest>>(`/guests/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guests'] })
    },
  })
}

export function useDeleteGuest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/guests/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guests'] })
    },
  })
}

// ── Rooms ──────────────────────────────────────────────

export function useRooms(params?: Record<string, string | number | undefined>) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['rooms', params],
    queryFn: () => api.get<PaginatedResponse<Room>>(`/rooms?${qs}`),
    placeholderData: keepPreviousData,
  })
}

export function useRoom(id: number) {
  return useQuery({
    queryKey: ['rooms', id],
    queryFn: () => api.get<ApiResponse<Room>>(`/rooms/${id}`),
    enabled: !!id,
  })
}

export function useAvailableRooms(params?: Record<string, string | number | undefined>) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['rooms', 'available', params],
    queryFn: () => api.get<Room[]>(`/rooms/available?${qs}`),
  })
}

export function useCreateRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post<ApiResponse<Room>>('/rooms', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export function useUpdateRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) =>
      api.put<ApiResponse<Room>>(`/rooms/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export function useDeleteRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/rooms/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export function useUpdateRoomStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.put<ApiResponse<Room>>(`/rooms/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ── Room Types ─────────────────────────────────────────

export function useRoomTypes(params?: Record<string, string | number | undefined>, options?: { enabled?: boolean }) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['room-types', params],
    queryFn: () => api.get<PaginatedResponse<RoomType>>(`/room-types?${qs}`),
    enabled: options?.enabled,
  })
}

export function useRoomType(id: number) {
  return useQuery({
    queryKey: ['room-types', id],
    queryFn: () => api.get<ApiResponse<RoomType>>(`/room-types/${id}`),
    enabled: !!id,
  })
}

export function useCreateRoomType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/room-types', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['room-types'] }),
  })
}

export function useUpdateRoomType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => api.put(`/room-types/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['room-types'] }),
  })
}

export function useDeleteRoomType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/room-types/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['room-types'] }),
  })
}

// ── Room Images ─────────────────────────────────────────

export function useRoomImages(roomId: number) {
  return useQuery({
    queryKey: ['rooms', roomId, 'images'],
    queryFn: () => api.get<RoomImage[]>(`/rooms/${roomId}/images`),
    enabled: !!roomId,
  })
}

export function useUploadRoomImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ roomId, formData }: { roomId: number; formData: FormData }) =>
      api.upload<ApiResponse<RoomImage>>(`/rooms/${roomId}/images`, formData),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rooms', variables.roomId, 'images'] })
    },
  })
}

export function useUpdateRoomImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ roomId, id, data }: { roomId: number; id: number; data: unknown }) =>
      api.put<ApiResponse<RoomImage>>(`/rooms/${roomId}/images/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rooms', variables.roomId, 'images'] })
    },
  })
}

export function useDeleteRoomImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ roomId, id }: { roomId: number; id: number }) =>
      api.delete(`/rooms/${roomId}/images/${id}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rooms', variables.roomId, 'images'] })
    },
  })
}

// ── Payments ───────────────────────────────────────────

export function usePayments(params?: Record<string, string | number | undefined>) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['payments', params],
    queryFn: () => api.get<PaginatedResponse<Payment>>(`/payments?${qs}`),
  })
}

export function useCreatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post<ApiResponse<Payment>>('/payments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useUpdatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) =>
      api.put<ApiResponse<Payment>>(`/payments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useDeletePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

// ── Invoices ───────────────────────────────────────────

export function useInvoices(params?: Record<string, string | number | undefined>) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: () => api.get<PaginatedResponse<Invoice>>(`/invoices?${qs}`),
  })
}

export function useInvoice(id: number) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => api.get<Invoice>(`/invoices/${id}`),
    enabled: !!id,
  })
}

export function useCreateInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post<ApiResponse<Invoice>>('/invoices', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) =>
      api.put<ApiResponse<Invoice>>(`/invoices/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useSendInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post(`/invoices/${id}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useDownloadInvoicePdf() {
  return useMutation({
    mutationFn: async (id: number) => {
      const { blob, filename } = await downloadFile(`/invoices/${id}/pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    },
  })
}

// ── Housekeeping ───────────────────────────────────────

export function useHousekeepingTasks(params?: Record<string, string | number | undefined>) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['housekeeping', params],
    queryFn: () => api.get<PaginatedResponse<HousekeepingTask>>(`/housekeeping?${qs}`),
  })
}

export function useCreateHousekeepingTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post<ApiResponse<HousekeepingTask>>('/housekeeping', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['housekeeping'] })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export function useUpdateHousekeepingStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, completion_notes }: { id: number; status: string; completion_notes?: string }) =>
      api.put<ApiResponse<HousekeepingTask>>(`/housekeeping/${id}/status`, { status, completion_notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['housekeeping'] })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export function useUpdateHousekeepingTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put<ApiResponse<HousekeepingTask>>(`/housekeeping/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['housekeeping'] })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export function useDeleteHousekeepingTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/housekeeping/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['housekeeping'] })
    },
  })
}

export function useAssignHousekeepingTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, assigned_to }: { id: number; assigned_to: number }) =>
      api.post<ApiResponse<HousekeepingTask>>(`/housekeeping/${id}/assign`, { assigned_to }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['housekeeping'] })
    },
  })
}

// ── Maintenance ────────────────────────────────────────

export function useMaintenanceRequests(params?: Record<string, string | number | undefined>) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['maintenance', params],
    queryFn: () => api.get<PaginatedResponse<MaintenanceRequest>>(`/maintenance?${qs}`),
  })
}

export function useCreateMaintenanceRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post<ApiResponse<MaintenanceRequest>>('/maintenance', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
    },
  })
}

export function useUpdateMaintenanceStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.put<ApiResponse<MaintenanceRequest>>(`/maintenance/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export function useAssignMaintenanceRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, assigned_to, estimated_cost }: { id: number; assigned_to: number; estimated_cost?: number }) =>
      api.post<ApiResponse<MaintenanceRequest>>(`/maintenance/${id}/assign`, { assigned_to, estimated_cost }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
    },
  })
}

// ── Technicians ─────────────────────────────────────────

export function useTechnicians() {
  return useQuery({
    queryKey: ['technicians'],
    queryFn: () => api.get<Technician[]>('/technicians'),
  })
}

export function useCreateTechnician() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<ApiResponse<Technician>>('/technicians', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians'] })
    },
  })
}

export function useUpdateTechnician() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put<ApiResponse<Technician>>(`/technicians/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians'] })
    },
  })
}

export function useDeleteTechnician() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/technicians/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians'] })
    },
  })
}

// ── Expenses ───────────────────────────────────────────

export function useExpenses(params?: Record<string, string | number | undefined>) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['expenses', params],
    queryFn: () => api.get<PaginatedResponse<Expense>>(`/expenses?${qs}`),
  })
}

export function useExpensesSummary(params?: Record<string, string | number | undefined>) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['expenses', 'summary', params],
    queryFn: () => api.get<ExpenseSummary>(`/expenses/summary?${qs}`),
  })
}

export function useCreateExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post<Expense>('/expenses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) =>
      api.put<ApiResponse<Expense>>(`/expenses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}

export function useUploadExpenseReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => {
      const formData = new FormData()
      formData.append('receipt', file)
      return api.upload<ApiResponse<Expense>>(`/expenses/${id}/receipt`, formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}

export function useDeleteExpenseReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<ApiResponse<Expense>>(`/expenses/${id}/receipt`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}

// ── Staff ──────────────────────────────────────────────

export function useStaffList() {
  return useQuery({
    queryKey: ['staff'],
    queryFn: () => api.get<PaginatedResponse<User>>('/staff?per_page=100'),
  })
}

export function useStaffAssignable(role?: string) {
  const qs = role ? `?role=${encodeURIComponent(role)}` : ''
  return useQuery({
    queryKey: ['staff', 'assignable', role],
    queryFn: () => api.get<User[]>(`/staff/assignable${qs}`),
  })
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get<Role[]>('/roles'),
  })
}

export function useCreateStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/staff', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}

export function useStaffSchedules(params?: Record<string, string | number | undefined>) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['staff-schedules', params],
    queryFn: () => api.get<PaginatedResponse<StaffSchedule>>(`/staff-schedules?${qs}`),
  })
}

export function useLeaveRequests(params?: Record<string, string | number | undefined>) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['leave-requests', params],
    queryFn: () => api.get<PaginatedResponse<LeaveRequest>>(`/leave-requests?${qs}`),
  })
}

// ── Reports ────────────────────────────────────────────

export function useRevenueReport(params?: Record<string, string | number | undefined>) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['reports', 'revenue', params],
    queryFn: () => api.get<RevenueData[]>(`/reports/revenue?${qs}`),
  })
}

export function useOccupancyReport(params?: Record<string, string | number | undefined>) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['reports', 'occupancy', params],
    queryFn: () => api.get<OccupancyData[]>(`/reports/occupancy?${qs}`),
  })
}

export function useReservationReport(params?: Record<string, string | number | undefined>) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['reports', 'reservations', params],
    queryFn: () => api.get(`/reports/reservations?${qs}`),
  })
}

// ── Settings ───────────────────────────────────────────

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings'),
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.put('/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['public-settings'] })
    },
  })
}

export function useUpdateLogo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('logo', file)
      return api.upload('/settings/logo', formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['public-settings'] })
    },
  })
}

export function useDeleteLogo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete('/settings/logo'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['public-settings'] })
    },
  })
}

export function useUploadQrCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('qr_code', file)
      return api.upload('/settings/qr-code', formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['public-settings'] })
    },
  })
}

export function useDeleteQrCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete('/settings/qr-code'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['public-settings'] })
    },
  })
}

export function useUploadBrandingImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ key, image }: { key: string; image: File }) => {
      const formData = new FormData()
      formData.append('key', key)
      formData.append('image', image)
      return api.upload('/settings/branding-image', formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['public-settings'] })
    },
  })
}

export function useDeleteBrandingImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (key: string) => api.delete('/settings/branding-image?key=' + encodeURIComponent(key)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['public-settings'] })
    },
  })
}

// ── Activity Logs ──────────────────────────────────────

export function useActivityLogs(params?: Record<string, string | number | undefined>) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['activity-logs', params],
    queryFn: () => api.get<PaginatedResponse<ActivityLog>>(`/activity-logs?${qs}`),
  })
}

// ── Contact Messages ────────────────────────────────────

export function useContactMessages(params?: Record<string, string | number | undefined>) {
  const qs = buildQueryString(params)
  return useQuery({
    queryKey: ['contact-messages', params],
    queryFn: () => api.get<PaginatedResponse<ContactMessage>>(`/contact-messages?${qs}`),
  })
}

export function useContactMessage(id: number) {
  return useQuery({
    queryKey: ['contact-messages', id],
    queryFn: () => api.get<ContactMessage>(`/contact-messages/${id}`),
    enabled: !!id,
  })
}

export function useDeleteContactMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/contact-messages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-messages'] })
    },
  })
}

// ── Auth ────────────────────────────────────────────────

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post<{ token: string; user: User }>('/login', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/logout'),
    onSuccess: () => {
      queryClient.clear()
    },
  })
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<ApiResponse<User>>('/profile'),
  })
}

// ── Search ──────────────────────────────────────────

export interface SearchResult {
  type: 'guest' | 'reservation' | 'room' | 'room_type'
  id: number
  title: string
  subtitle: string
  badge: string | null
  route: string
}

function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function useSearch(query: string) {
  const debouncedQuery = useDebouncedValue(query, 300)
  return useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => api.get<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  })
}
