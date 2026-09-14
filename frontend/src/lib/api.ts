import { useAuthStore } from '../stores/authStore'

const API_BASE = '/api'

// Event-based navigation to avoid hard page reloads outside React tree
export const AUTH_EVENTS = {
  UNAUTHORIZED: 'auth:unauthorized',
} as const

export function dispatchAuthEvent(eventName: string, detail?: unknown) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }))
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token
  const headers: HeadersInit = {
    'Accept': 'application/json',
    ...options.headers,
  }

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  if (!(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    if (response.status === 401) {
      const currentToken = useAuthStore.getState().token
      if (currentToken) {
        useAuthStore.getState().logout()
        dispatchAuthEvent(AUTH_EVENTS.UNAUTHORIZED, '/admin/login')
      }
    }
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || error.error || 'Request failed')
  }

  return response.json()
}

export async function downloadFile(url: string, accept = 'application/pdf'): Promise<{ blob: Blob; filename: string }> {
  const token = useAuthStore.getState().token
  const headers: HeadersInit = { 'Accept': accept }

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${url}`, { headers })

  if (!response.ok) {
    if (response.status === 401) {
      const currentToken = useAuthStore.getState().token
      if (currentToken) {
        useAuthStore.getState().logout()
        dispatchAuthEvent(AUTH_EVENTS.UNAUTHORIZED, '/admin/login')
      }
    }
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || error.error || 'Request failed')
  }

  const blob = await response.blob()
  let filename = 'download.pdf'
  const disposition = response.headers.get('Content-Disposition')
  const match = disposition?.match(/filename="?([^"]+)"?/)
  if (match && match[1]) filename = match[1]

  return { blob, filename }
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, data?: unknown) => request<T>(url, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(url: string, data?: unknown) => request<T>(url, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
  upload: <T>(url: string, formData: FormData) => request<T>(url, { method: 'POST', body: formData }),
}