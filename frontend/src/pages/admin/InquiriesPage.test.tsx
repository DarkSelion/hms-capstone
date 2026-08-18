import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InquiriesPage from './InquiriesPage'
import type { ContactMessage, PaginatedResponse } from '@/types'

const { mockUseContactMessages, mockUseDeleteContactMessage } = vi.hoisted(() => ({
  mockUseContactMessages: vi.fn(),
  mockUseDeleteContactMessage: vi.fn(),
}))

vi.mock('@/hooks/useApi', () => ({
  useContactMessages: (params?: Record<string, unknown>) => mockUseContactMessages(params),
  useDeleteContactMessage: () => mockUseDeleteContactMessage(),
}))

function message(overrides: Partial<ContactMessage> = {}): ContactMessage {
  return {
    id: 1,
    name: 'Maria Santos',
    email: 'maria@example.com',
    subject: 'Booking inquiry',
    message: 'Hi, is a Deluxe room available for next weekend?',
    ip_address: '192.168.1.50',
    created_at: '2026-08-10T09:30:00.000000Z',
    ...overrides,
  }
}

function paginated(messages: ContactMessage[]): PaginatedResponse<ContactMessage> {
  return {
    data: messages,
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: messages.length,
  }
}

function renderPage(messages: ContactMessage[] = [message()]) {
  mockUseContactMessages.mockReturnValue({
    data: paginated(messages),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
  mockUseDeleteContactMessage.mockReturnValue({ mutate: vi.fn(), isPending: false })
  return render(<InquiriesPage />)
}

describe('InquiriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders inquiry rows', () => {
    renderPage()
    expect(screen.getByText('Maria Santos')).toBeTruthy()
    expect(screen.getByText('maria@example.com')).toBeTruthy()
    expect(screen.getByText('Booking inquiry')).toBeTruthy()
  })

  it('opens the detail modal with sender, subject, and message body', () => {
    renderPage()
    fireEvent.click(screen.getByTitle('View'))

    expect(screen.getByRole('heading', { name: 'Message Details' })).toBeTruthy()
    expect(screen.getAllByText('Maria Santos').length).toBeGreaterThan(0)
    expect(screen.getByText('Portal inquiry')).toBeTruthy()
    expect(screen.getAllByText('Message').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Hi, is a Deluxe room available for next weekend?').length).toBeGreaterThan(0)
    expect(screen.getAllByText('maria@example.com').length).toBeGreaterThan(0)
    expect(screen.getByText('192.168.1.50')).toBeTruthy()
    expect(screen.getAllByText('Subject').length).toBeGreaterThan(0)
  })

  it('reply link opens a Gmail compose draft prefilled', () => {
    renderPage()
    fireEvent.click(screen.getByTitle('View'))

    const replyLink = screen.getByRole('link', { name: /Reply via Gmail/ })
    expect(replyLink).toHaveProperty('target', '_blank')
    expect(replyLink.getAttribute('href')).toContain('mail.google.com/mail/?view=cm')
    expect(replyLink.getAttribute('href')).toContain('to=maria%40example.com')
    expect(replyLink.getAttribute('href')).toContain('su=Re%3A%20Booking%20inquiry')
  })

  it('closes the detail modal', () => {
    renderPage()
    fireEvent.click(screen.getByTitle('View'))
    expect(screen.getByRole('heading', { name: 'Message Details' })).toBeTruthy()

    fireEvent.click(screen.getByText('Close'))
    expect(screen.queryByRole('heading', { name: 'Message Details' })).toBeNull()
  })

  it('shows em dash placeholder when ip address is absent', () => {
    renderPage([message({ ip_address: undefined })])
    fireEvent.click(screen.getByTitle('View'))

    expect(screen.getByText('IP Address')).toBeTruthy()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})