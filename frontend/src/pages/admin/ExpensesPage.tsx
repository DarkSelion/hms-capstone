import { useState, useMemo } from 'react'
import { useExpenses, useExpensesSummary, useCreateExpense, useUpdateExpense, useDeleteExpense, useUploadExpenseReceipt, useDeleteExpenseReceipt } from '@/hooks/useApi'
import type { Expense } from '@/types'
import { formatCurrency, formatDateDisplay } from '@/lib/format'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { RowActions, RowActionButton } from '@/components/shared/RowActions'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { DatePicker } from '@/components/ui/date-picker'
import { useToast } from '@/components/ui/toast'
import {
  Plus, Eye, Edit, Trash2, FileText, Save, Wallet, TrendingUp, ReceiptText, CalendarRange,
  AlertCircle, Upload, X, Tag, CalendarDays, UserRound, MessageSquareText,
} from 'lucide-react'

const CATEGORIES = [
  { value: 'utilities', label: 'Utilities', color: 'bg-info/10 text-info' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-warning/10 text-warning' },
  { value: 'supplies', label: 'Supplies', color: 'bg-success/10 text-success' },
  { value: 'salary', label: 'Salary', color: 'bg-purple/10 text-purple' },
  { value: 'marketing', label: 'Marketing', color: 'bg-gold/10 text-gold-dark' },
  { value: 'food', label: 'Food', color: 'bg-danger/10 text-danger' },
  { value: 'other', label: 'Other', color: 'bg-border/50 text-muted' },
]

const CATEGORY_COLORS: Record<string, string> = {
  utilities: 'bg-info/10 text-info',
  maintenance: 'bg-warning/10 text-warning',
  supplies: 'bg-success/10 text-success',
  salary: 'bg-purple/10 text-purple',
  marketing: 'bg-gold/10 text-gold-dark',
  food: 'bg-danger/10 text-danger',
  other: 'bg-border/50 text-muted',
}

function categoryLabel(value: string): string {
  return CATEGORIES.find(c => c.value === value)?.label ?? value
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return formatDateDisplay(dateStr)
}

interface ExpenseFormData {
  category: string
  amount: number | ''
  description: string
  date: string
}

const emptyForm: ExpenseFormData = {
  category: '',
  amount: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
}

export default function ExpensesPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('-date')
  const [page, setPage] = useState(1)

  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [form, setForm] = useState<ExpenseFormData>(emptyForm)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ExpenseFormData, string>>>({})
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const { addToast } = useToast()

  const queryParams = useMemo(() => {
    const params: Record<string, string | number | undefined> = { page, sort: sortBy }
    if (search) params.search = search
    if (categoryFilter) params.category = categoryFilter
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    return params
  }, [page, sortBy, search, categoryFilter, dateFrom, dateTo])

  const { data: expensesData, isLoading, error, refetch } = useExpenses(queryParams)
  const { data: summaryData } = useExpensesSummary(queryParams)
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()
  const uploadReceipt = useUploadExpenseReceipt()
  const deleteReceipt = useDeleteExpenseReceipt()

  const expenses = expensesData?.data ?? []
  const totalPages = expensesData?.last_page ?? 1

  const totalExpenses = summaryData?.total_amount ?? 0
  const expenseCount = summaryData?.count ?? 0
  const avgExpense = summaryData?.average ?? 0
  const thisMonthExpenses = summaryData?.this_month_amount ?? 0

  function openDetailModal(expense: Expense) {
    setSelectedExpense(expense)
    setShowDetailModal(true)
  }

  function openNewForm() {
    setEditingExpense(null)
    setForm(emptyForm)
    setReceiptFile(null)
    setFormErrors({})
    setShowFormModal(true)
  }

  function openEditForm(expense: Expense) {
    setEditingExpense(expense)
    setForm({
      category: expense.category,
      amount: expense.amount,
      description: expense.description ?? '',
      date: expense.date?.split('T')[0] ?? '',
    })
    setReceiptFile(null)
    setFormErrors({})
    setShowFormModal(true)
  }

  function closeFormModal() {
    setShowFormModal(false)
    setEditingExpense(null)
    setForm(emptyForm)
    setReceiptFile(null)
    setFormErrors({})
  }

  function validateForm(): boolean {
    const errors: Partial<Record<keyof ExpenseFormData, string>> = {}
    if (!form.category) errors.category = 'Category is required'
    if (form.amount === '' || Number(form.amount) <= 0) errors.amount = 'Amount must be greater than 0'
    if (!form.date) errors.date = 'Date is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleFormSubmit() {
    if (!validateForm()) return

    const payload = {
      category: form.category,
      amount: Number(form.amount),
      description: form.description || undefined,
      date: form.date,
    }

    function afterSave(expenseId: number) {
      if (receiptFile) {
        uploadReceipt.mutate(
          { id: expenseId, file: receiptFile },
          {
            onSuccess: () => addToast('Receipt uploaded successfully', 'success'),
            onError: () => addToast('Expense saved but receipt upload failed', 'error'),
          },
        )
      }
      closeFormModal()
    }

    if (editingExpense) {
      updateExpense.mutate(
        { id: editingExpense.id, data: payload },
        {
          onSuccess: () => afterSave(editingExpense.id),
          onError: () => addToast('Failed to update expense', 'error'),
        },
      )
    } else {
      createExpense.mutate(payload, {
        onSuccess: (created) => afterSave(created.id),
        onError: () => addToast('Failed to create expense', 'error'),
      })
    }
  }

  function handleDelete() {
    if (!deleteConfirmId) return
    deleteExpense.mutate(deleteConfirmId, { onSuccess: () => setDeleteConfirmId(null) })
  }

  function handleRemoveReceipt(expense: Expense) {
    if (deleteReceipt.isPending) return
    deleteReceipt.mutate(expense.id, {
      onSuccess: () => {
        setSelectedExpense(prev =>
          prev && prev.id === expense.id ? { ...prev, receipt: undefined, receipt_url: null } : prev)
        setEditingExpense(prev =>
          prev && prev.id === expense.id ? { ...prev, receipt: undefined, receipt_url: null } : prev)
        addToast('Receipt removed successfully', 'success')
      },
      onError: () => addToast('Failed to remove receipt', 'error'),
    })
  }

  function updateField<K extends keyof ExpenseFormData>(key: K, value: ExpenseFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    if (formErrors[key]) {
      setFormErrors(prev => {
        const copy = { ...prev }
        delete copy[key]
        return copy
      })
    }
  }

  function handleSort(key: string) {
    setSortBy(prev => prev === key ? `-${key}` : prev === `-${key}` ? key : key)
  }

  const isFormSubmitting = createExpense.isPending || updateExpense.isPending || uploadReceipt.isPending

  const columns: Column<Expense>[] = [
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      render: (r) => <span>{formatDate(r.date)}</span>,
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (r) => {
        const cat = CATEGORIES.find(c => c.value === r.category)
        return (
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[r.category] ?? 'bg-border/50 text-muted'}`}>
            {cat?.label ?? r.category}
          </span>
        )
      },
    },
    {
      key: 'description',
      label: 'Description',
      sortable: true,
      render: (r) => <span className="text-foreground">{r.description || '-'}</span>,
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      render: (r) => <span className="font-medium">{formatCurrency(r.amount)}</span>,
    },
    {
      key: 'receipt',
      label: 'Receipt',
      render: (r) => (
        r.receipt_url ? (
          <a
            href={r.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <FileText className="h-4 w-4" />
            View
          </a>
        ) : (
          <span className="text-muted">—</span>
        )
      ),
    },
    {
      key: 'created_by',
      label: 'Created By',
      sortable: true,
      render: (r) => <span>{r.created_by_user?.name ?? '-'}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <RowActions>
          <RowActionButton
            tone="neutral"
            title="View"
            icon={<Eye className="h-4 w-4" />}
            onClick={() => openDetailModal(r)}
          />
          <RowActionButton
            tone="neutral"
            title="Edit"
            icon={<Edit className="h-4 w-4" />}
            onClick={() => openEditForm(r)}
          />
          <RowActionButton
            tone="danger"
            title="Delete"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => setDeleteConfirmId(r.id)}
          />
        </RowActions>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Track hotel expenses and operational costs."
        actions={
          <Button variant="gold" onClick={openNewForm}>
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Wallet className="h-5 w-5" />} label="Total (Filtered)" value={formatCurrency(totalExpenses)} />
        <StatCard icon={<CalendarRange className="h-5 w-5" />} label="This Month" value={formatCurrency(thisMonthExpenses)} />
        <StatCard icon={<ReceiptText className="h-5 w-5" />} label="Expense Entries" value={expenseCount} />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Average Expense" value={formatCurrency(avgExpense)} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Input
                placeholder="Search expenses..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <div className="w-44">
              <Select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}>
                <option value="">All Categories</option>
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </div>
            <div className="w-44">
              <DatePicker value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(1) }} placeholder="From date" clearable />
            </div>
            <div className="w-44">
              <DatePicker value={dateTo} onChange={(v) => { setDateTo(v); setPage(1) }} placeholder="To date" clearable />
            </div>
          </div>

          <DataTable
            columns={columns}
            data={expenses}
            loading={isLoading}
            error={error ? 'Failed to load expenses' : null}
            sortBy={sortBy}
            onSort={handleSort}
            pagination={expensesData ? {
              currentPage: page,
              lastPage: totalPages,
              total: expensesData.total,
              from: (expensesData.current_page - 1) * expensesData.per_page + 1,
              to: Math.min(expensesData.current_page * expensesData.per_page, expensesData.total),
              onPageChange: setPage,
            } : undefined}
            onRetry={() => refetch()}
            keyExtractor={(r) => r.id}
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Expense Details"
        size="xl"
        footer={
          <>
            {selectedExpense?.receipt_url && (
              <Button
                variant="outline"
                onClick={() => selectedExpense && handleRemoveReceipt(selectedExpense)}
                disabled={deleteReceipt.isPending}
              >
                <Trash2 className="h-4 w-4" />
                {deleteReceipt.isPending ? 'Removing...' : 'Remove Receipt'}
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowDetailModal(false)}>Close</Button>
          </>
        }
      >
        {selectedExpense ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${CATEGORY_COLORS[selectedExpense.category] ?? 'bg-border/50 text-muted'}`}>
                  <ReceiptText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {categoryLabel(selectedExpense.category)}
                  </p>
                  <p className="text-xs text-muted">
                    {selectedExpense.created_by_user?.name
                      ? `Recorded by ${selectedExpense.created_by_user.name}`
                      : 'Expense record'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted">Amount</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(selectedExpense.amount)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-muted">Date</p>
                <p className="text-sm font-semibold text-foreground">{formatDate(selectedExpense.date)}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15 text-gold-dark">
                  <MessageSquareText className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Details</h4>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                {selectedExpense.description || '—'}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <Tag className="h-3.5 w-3.5" /> Category
                  </p>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[selectedExpense.category] ?? 'bg-border/50 text-muted'}`}>
                    {categoryLabel(selectedExpense.category)}
                  </span>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <CalendarDays className="h-3.5 w-3.5" /> Date
                  </p>
                  <p className="text-sm font-semibold text-foreground">{formatDate(selectedExpense.date)}</p>
                </div>
                <div className="rounded-xl bg-bg p-3 sm:col-span-2">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <UserRound className="h-3.5 w-3.5" /> Created By
                  </p>
                  <p className="text-sm font-semibold text-foreground">{selectedExpense.created_by_user?.name ?? '—'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10 text-info">
                  <FileText className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Receipt</h4>
              </div>
              {selectedExpense.receipt_url ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-bg p-3">
                  <FileText className="h-4 w-4 text-primary" />
                  <a
                    href={selectedExpense.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    View receipt
                  </a>
                  <span className="text-xs text-muted">Attached</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={() => handleRemoveReceipt(selectedExpense)}
                    disabled={deleteReceipt.isPending}
                  >
                    {deleteReceipt.isPending ? 'Removing...' : 'Remove'}
                  </Button>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-3 rounded-xl bg-bg p-3">
                  <FileText className="h-4 w-4 text-muted" />
                  <p className="text-sm text-muted">No receipt attached</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 text-center">
            <AlertCircle className="mb-2 h-8 w-8 text-muted" />
            <p className="text-sm text-muted">Could not load expense details.</p>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showFormModal}
        onClose={closeFormModal}
        title={editingExpense ? 'Edit Expense' : 'Add Expense'}
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={closeFormModal} disabled={isFormSubmitting}>
              Cancel
            </Button>
            <Button variant="gold" onClick={handleFormSubmit} disabled={isFormSubmitting}>
              {isFormSubmitting ? 'Saving...' : <><Save className="h-4 w-4" /> Save</>}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                {editingExpense ? 'Edit Expense' : 'Add Expense'}
              </h4>
              <p className="text-xs text-muted">
                {editingExpense ? 'Update the expense details.' : 'Record a hotel expense or operational cost.'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15 text-gold-dark">
                <ReceiptText className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">Expense Details</h4>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Category"
                placeholder="Select category"
                value={form.category}
                onChange={(e) => updateField('category', e.target.value)}
                error={formErrors.category}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>

              <Input
                label="Amount (₱)"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={form.amount === '' ? '' : form.amount}
                onChange={(e) => updateField('amount', e.target.value ? Number(e.target.value) : '')}
                error={formErrors.amount}
              />
            </div>
            <div className="mt-4">
              <DatePicker
                label="Date"
                value={form.date}
                onChange={(v) => updateField('date', v)}
              />
            </div>
            <div className="mt-4 space-y-1">
              <label className="text-sm font-medium text-foreground">Description</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm ring-offset-card placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
                placeholder="Expense description..."
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10 text-info">
                <Upload className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">Receipt</h4>
            </div>
            {receiptFile ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-bg p-3">
                <FileText className="h-4 w-4 text-primary" />
                <span className="max-w-[220px] truncate text-sm text-foreground">{receiptFile.name}</span>
                <button
                  type="button"
                  onClick={() => setReceiptFile(null)}
                  className="text-muted hover:text-danger"
                  aria-label="Remove receipt"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-bg px-4 py-6 text-center transition-colors hover:border-primary/40 hover:bg-cream">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-gold-dark">
                    <Upload className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {editingExpense?.receipt_url ? 'Replace Receipt' : 'Upload Receipt'}
                  </span>
                  <span className="text-xs text-muted">PNG, JPG or PDF · Max 4MB</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setReceiptFile(file)
                    }}
                  />
                </label>
                {editingExpense?.receipt_url && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-bg p-3">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm text-foreground">Current receipt attached</span>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      className="ml-auto"
                      onClick={() => handleRemoveReceipt(editingExpense)}
                      disabled={deleteReceipt.isPending}
                    >
                      {deleteReceipt.isPending ? 'Removing...' : 'Remove'}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteExpense.isPending}
      />
    </div>
  )
}
