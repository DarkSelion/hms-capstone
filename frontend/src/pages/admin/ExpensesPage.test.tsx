import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExpensesPage from './ExpensesPage'
import type { Expense, PaginatedResponse, ExpenseSummary } from '@/types'

const {
  mockUseExpenses,
  mockUseExpensesSummary,
  mockUseCreateExpense,
  mockUseUpdateExpense,
  mockUseDeleteExpense,
  mockUseUploadExpenseReceipt,
  mockUseDeleteExpenseReceipt,
  mockDeleteReceiptMutate,
  mockUseToast,
} = vi.hoisted(() => ({
  mockUseExpenses: vi.fn(),
  mockUseExpensesSummary: vi.fn(),
  mockUseCreateExpense: vi.fn(),
  mockUseUpdateExpense: vi.fn(),
  mockUseDeleteExpense: vi.fn(),
  mockUseUploadExpenseReceipt: vi.fn(),
  mockUseDeleteExpenseReceipt: vi.fn(),
  mockDeleteReceiptMutate: vi.fn(),
  mockUseToast: vi.fn(),
}))

vi.mock('@/hooks/useApi', () => ({
  useExpenses: (params?: Record<string, unknown>) => mockUseExpenses(params),
  useExpensesSummary: (params?: Record<string, unknown>) => mockUseExpensesSummary(params),
  useCreateExpense: () => mockUseCreateExpense(),
  useUpdateExpense: () => mockUseUpdateExpense(),
  useDeleteExpense: () => mockUseDeleteExpense(),
  useUploadExpenseReceipt: () => mockUseUploadExpenseReceipt(),
  useDeleteExpenseReceipt: () => mockUseDeleteExpenseReceipt(),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => mockUseToast(),
}))

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 1,
    category: 'utilities',
    amount: 1250.5,
    description: 'Monthly electricity bill',
    date: '2026-10-05',
    receipt_url: '/storage/receipts/electric.pdf',
    created_by: 1,
    created_by_user: { id: 1, name: 'Jane Doe' },
    ...overrides,
  }
}

function paginated(items: Expense[]): PaginatedResponse<Expense> {
  return {
    data: items,
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: items.length,
  }
}

function summary(): ExpenseSummary {
  return { total_amount: 0, count: 0, average: 0, this_month_amount: 0 }
}

function formCategorySelect(): HTMLSelectElement {
  const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
  return selects.find(s => s.textContent?.includes('Select category')) as HTMLSelectElement
}

function renderPage(item: Expense = expense()) {
  mockUseExpenses.mockReturnValue({
    data: paginated([item]),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
  mockUseExpensesSummary.mockReturnValue({
    data: summary(),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
  mockUseCreateExpense.mockReturnValue({ mutate: mockUseCreateExpense, isPending: false })
  mockUseUpdateExpense.mockReturnValue({ mutate: mockUseUpdateExpense, isPending: false })
  mockUseDeleteExpense.mockReturnValue({ mutate: vi.fn(), isPending: false })
  mockUseUploadExpenseReceipt.mockReturnValue({ mutate: vi.fn(), isPending: false })
  mockUseDeleteExpenseReceipt.mockReturnValue({ mutate: mockDeleteReceiptMutate, isPending: false })
  mockUseToast.mockReturnValue({ addToast: vi.fn() })
  return render(<ExpensesPage />)
}

describe('ExpensesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens the expense detail modal with all facts', () => {
    renderPage()
    fireEvent.click(screen.getByTitle('View'))

    expect(screen.getByRole('heading', { name: 'Expense Details' })).toBeTruthy()
    expect(screen.getByText('Recorded by Jane Doe')).toBeTruthy()
    expect(screen.getByText('Details')).toBeTruthy()
    expect(screen.getAllByText('Receipt').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Utilities').length).toBeGreaterThan(0)
    expect(screen.getAllByText('₱1,250.50').length).toBeGreaterThan(0)
    expect(screen.getAllByText('5 Oct 2026').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Monthly electricity bill').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'View receipt' })).toBeTruthy()
  })

  it('closes the detail modal', () => {
    renderPage()
    fireEvent.click(screen.getByTitle('View'))
    expect(screen.getByRole('heading', { name: 'Expense Details' })).toBeTruthy()

    fireEvent.click(screen.getByText('Close'))
    expect(screen.queryByRole('heading', { name: 'Expense Details' })).toBeNull()
  })

  it('shows a no-receipt placeholder when no receipt is attached', () => {
    renderPage(expense({ receipt_url: null }))
    fireEvent.click(screen.getByTitle('View'))

    expect(screen.getByText('No receipt attached')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'View receipt' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove Receipt' })).toBeNull()
  })

  it('removing a receipt reflects immediately and cannot be spam-clicked', () => {
    mockDeleteReceiptMutate.mockImplementation((_id, opts) => opts?.onSuccess?.())
    renderPage()

    fireEvent.click(screen.getByTitle('View'))
    expect(screen.getByRole('link', { name: 'View receipt' })).toBeTruthy()

    const removeBtn = screen.getByRole('button', { name: 'Remove Receipt' })
    fireEvent.click(removeBtn)
    fireEvent.click(removeBtn)

    expect(mockDeleteReceiptMutate).toHaveBeenCalledTimes(1)
    expect(screen.getByText('No receipt attached')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'View receipt' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove Receipt' })).toBeNull()
  })

  it('validates the add form and creates an expense', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Add Expense/ }))

    fireEvent.click(screen.getByRole('button', { name: /Save/ }))
    expect(screen.getByText('Category is required')).toBeTruthy()
    expect(screen.getByText('Amount must be greater than 0')).toBeTruthy()

    fireEvent.change(formCategorySelect(), { target: { value: 'maintenance' } })
    fireEvent.change(screen.getByLabelText('Amount (₱)'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))

    expect(mockUseCreateExpense).toHaveBeenCalledWith(
      {
        category: 'maintenance',
        amount: 500,
        description: undefined,
        date: expect.any(String),
      },
      expect.anything(),
    )
  })

  it('pre-fills the edit form and updates the expense', () => {
    renderPage()
    fireEvent.click(screen.getByTitle('Edit'))

    expect(formCategorySelect().value).toBe('utilities')
    expect((screen.getByLabelText('Amount (₱)') as HTMLInputElement).value).toBe('1250.5')
    expect((screen.getByPlaceholderText('Expense description...') as HTMLTextAreaElement).value).toBe(
      'Monthly electricity bill',
    )

    fireEvent.change(screen.getByLabelText('Amount (₱)'), { target: { value: '999' } })
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))

    expect(mockUseUpdateExpense).toHaveBeenCalledWith(
      {
        id: 1,
        data: {
          category: 'utilities',
          amount: 999,
          description: 'Monthly electricity bill',
          date: expect.any(String),
        },
      },
      expect.anything(),
    )
  })
})