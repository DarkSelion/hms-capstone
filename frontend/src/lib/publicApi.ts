import { usePublicAuthStore } from '../stores/publicAuthStore'

const API_BASE = '/api'

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = usePublicAuthStore.getState().token
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

  let response: Response
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    })
  } catch (e) {
    throw new Error('Network error. Please check your internet connection and try again.')
  }

  if (!response.ok) {
    if (response.status === 401) {
      if (usePublicAuthStore.getState().token) {
        usePublicAuthStore.getState().logout()
        throw new Error('Session expired. Please log in again.')
      }
    }
    const body = await response.json().catch(() => ({}))
    let message = body?.message || body?.error || 'Request failed'
    const fieldErrors = body?.errors
    if (fieldErrors && typeof fieldErrors === 'object') {
      const first = Object.values(fieldErrors)[0]
      if (Array.isArray(first) && first.length > 0) message = first[0]
      else if (typeof first === 'string') message = first
    }
    const err = new Error(message) as Error & { status?: number; retryAfter?: number }
    err.status = response.status
    const retryAfter = response.headers.get('Retry-After')
    if (retryAfter) err.retryAfter = Number(retryAfter)
    throw err
  }

  return response.json()
}

export const publicApi = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, data?: unknown) => request<T>(url, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(url: string, data?: unknown) => request<T>(url, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
}
