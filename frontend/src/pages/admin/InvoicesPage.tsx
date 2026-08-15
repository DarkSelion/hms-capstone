import { useState, useMemo } from 'react'
import {
  useInvoices, useInvoice, useCreateInvoice, useUpdateInvoice,
  useDeleteInvoice, useSendInvoice, useDownloadInvoicePdf, useCreatePayment, useReservations,
} from '@/hooks/useApi'
import type { Invoice, Reservation } from '@/types'
import { formatCurrency, formatDateDisplay } from '@/lib/format'
import { useHotelName, useHotelSettings } from '@/hooks/usePublicApi'
import { useToast } from '@/components/ui/toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { RowActions, RowActionButton } from '@/components/shared/RowActions'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Plus, Eye, Edit, Trash2, Send, DollarSign,
  Download, AlertCircle, X, Loader2,
} from 'lucide-react'

interface InvoiceExtended extends Invoice {
  reservation?: Reservation
  guest?: { id: number; first_name: string; last_name: string; email: string }
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
]

interface LineItem {
  description: string
  quantity: number
  unit_price: number
}

interface InvoiceFormData {
  reservation_id: number | ''
  items: LineItem[]
  tax_percent: number
  discount_percent: number
  issued_date: string
  due_date: string
}

function emptyLineItem(): LineItem {
  return { description: '', quantity: 1, unit_price: 0 }
}

function emptyForm(reservation?: Reservation): InvoiceFormData {
  const items: LineItem[] = reservation
    ? [
        {
          description: `Room ${reservation.room?.room_number ?? ''} - ${reservation.room?.room_type?.name ?? ''}`,
          quantity: 1,
          unit_price: reservation.total_amount,
        },
      ]
    : [emptyLineItem()]
  return {
    reservation_id: reservation?.id ?? '',
    items,
    tax_percent: 12,
    discount_percent: 0,
    issued_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return formatDateDisplay(dateStr)
}

export default function InvoicesPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceExtended | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<InvoiceExtended | null>(null)
  const [form, setForm] = useState<InvoiceFormData>(emptyForm())
  const [formErrors, setFormErrors] = useState<Partial<Record<string, string>>>({})
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [sendConfirmId, setSendConfirmId] = useState<number | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentReference, setPaymentReference] = useState('')

  const queryParams = useMemo(() => {
    const params: Record<string, string | number | undefined> = { page }
    if (search) params.search = search
    if (statusFilter) params.status = statusFilter
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    return params
  }, [page, search, statusFilter, dateFrom, dateTo])

  const { data: invoicesData, isLoading, error, refetch } = useInvoices(queryParams)
  const { data: invoiceDetailData, isLoading: detailLoading } = useInvoice(selectedInvoice?.id ?? 0)

  const hotelName = useHotelName()
  const hotel = useHotelSettings()
  const hotelAddress = (hotel['hotel_address'] as string) || ''
  const hotelPhone = (hotel['hotel_phone'] as string) || ''
  const hotelEmail = (hotel['hotel_email'] as string) || ''
  const hotelLogo = (hotel['hotel_logo'] as string) || ''
  const { data: reservationsData } = useReservations({ per_page: 100, status: 'checked_in,checked_out,confirmed' })

  const createInvoice = useCreateInvoice()
  const updateInvoice = useUpdateInvoice()
  const deleteInvoice = useDeleteInvoice()
  const sendInvoice = useSendInvoice()
  const downloadPdf = useDownloadInvoicePdf()
  const createPayment = useCreatePayment()
  const { addToast } = useToast()

  const invoices = (invoicesData?.data ?? []) as InvoiceExtended[]
  const reservations = (reservationsData?.data ?? []) as Reservation[]
  const totalPages = invoicesData?.last_page ?? 1

  const detailInvoice = invoiceDetailData as InvoiceExtended | undefined

  function calcSubtotal(items: LineItem[]) {
    return items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  }

  function calcTotal(subtotal: number, taxPct: number, discountPct: number) {
    const discount = subtotal * (discountPct / 100)
    const tax = (subtotal - discount) * (taxPct / 100)
    return subtotal - discount + tax
  }

  const formSubtotal = useMemo(() => calcSubtotal(form.items), [form.items])
  const formTotal = useMemo(() => calcTotal(formSubtotal, form.tax_percent, form.discount_percent), [formSubtotal, form.tax_percent, form.discount_percent])

  function openDetailModal(invoice: InvoiceExtended) {
    setSelectedInvoice(invoice)
    setShowDetailModal(true)
  }

  function openNewForm() {
    setEditingInvoice(null)

    setForm(emptyForm())
    setFormErrors({})
    setShowFormModal(true)
  }

  function openEditForm(invoice: InvoiceExtended) {
    setEditingInvoice(invoice)
    const itemsSubtotal = (invoice.items ?? []).reduce((s, i) => s + i.total_price, 0)
    setForm({
      reservation_id: invoice.reservation_id ?? '',
      items: (invoice.items ?? []).map(i => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price })),
      tax_percent: itemsSubtotal > 0 ? Math.round((invoice.tax_amount / itemsSubtotal) * 1000) / 10 : 0,
      discount_percent: itemsSubtotal > 0 ? Math.round((invoice.discount_amount / itemsSubtotal) * 1000) / 10 : 0,
      issued_date: invoice.issued_date?.split('T')[0] ?? '',
      due_date: invoice.due_date?.split('T')[0] ?? '',
    })
    setFormErrors({})
    setShowFormModal(true)
  }

  function closeFormModal() {
    setShowFormModal(false)
    setEditingInvoice(null)
    setForm(emptyForm())
    setFormErrors({})
  }

  function validateForm(): boolean {
    const errors: Partial<Record<string, string>> = {}
    if (form.reservation_id === '') errors.reservation_id = 'Reservation is required'
    if (!form.issued_date) errors.issued_date = 'Issue date is required'
    if (!form.due_date) errors.due_date = 'Due date is required'
    if (form.items.length === 0 || form.items.every(i => !i.description)) errors.items = 'At least one item is required'
    form.items.forEach((item, idx) => {
      if (!item.description.trim()) errors[`item_${idx}_desc`] = 'Required'
      if (item.quantity < 1) errors[`item_${idx}_qty`] = 'Min 1'
      if (item.unit_price < 0) errors[`item_${idx}_price`] = 'Invalid'
    })
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleFormSubmit() {
    if (!validateForm()) return

    const subtotal = calcSubtotal(form.items)
    const tax = subtotal * (form.tax_percent / 100)
    const discount = subtotal * (form.discount_percent / 100)

    const payload = {
      reservation_id: Number(form.reservation_id),
      items: form.items.map(i => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price })),
      subtotal,
      tax,
      discount,
      issued_date: form.issued_date,
      due_date: form.due_date,
    }

    if (editingInvoice) {
      updateInvoice.mutate({ id: editingInvoice.id, data: payload }, { onSuccess: closeFormModal })
    } else {
      createInvoice.mutate(payload, { onSuccess: closeFormModal })
    }
  }

  function handleDelete() {
    if (!deleteConfirmId) return
    deleteInvoice.mutate(deleteConfirmId, { onSuccess: () => setDeleteConfirmId(null) })
  }

  function handleSend() {
    if (!sendConfirmId) return
    sendInvoice.mutate(sendConfirmId, { onSuccess: () => setSendConfirmId(null) })
  }

  function handleDownloadPdf(invoiceId: number) {
    downloadPdf.mutate(invoiceId, {
      onError: (e) => {
        const message = e instanceof Error ? e.message : 'Unable to download PDF. Please try again.'
        addToast(message, 'error')
      },
    })
  }

  function handleSubmitPayment() {
    if (!selectedInvoice) return
    if (paymentAmount <= 0) {
      addToast('Enter a payment amount greater than zero', 'error')
      return
    }
    createPayment.mutate({
      reservation_id: selectedInvoice.reservation_id,
      amount: paymentAmount,
      payment_method: paymentMethod,
      reference_number: paymentReference,
      payment_type: 'full',
    }, {
      onSuccess: () => {
        setShowPaymentModal(false)
      },
      onError: (e) => {
        const message = e instanceof Error ? e.message : 'Failed to record payment'
        addToast(message, 'error')
      },
    })
  }

  function handleReservationSelect(id: number) {
    const res = reservations.find(r => r.id === id)

    if (res) {
      setForm(prev => ({
        ...prev,
        reservation_id: id,
        items: [
          {
            description: `Room ${res.room?.room_number ?? ''} - ${res.room?.room_type?.name ?? ''}`,
            quantity: 1,
            unit_price: res.total_amount,
          },
        ],
      }))
    } else {
      setForm(prev => ({ ...prev, reservation_id: id }))
    }
  }

  function addLineItem() {
    setForm(prev => ({ ...prev, items: [...prev.items, emptyLineItem()] }))
  }

  function removeLineItem(idx: number) {
    if (form.items.length <= 1) return
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))
  }

  function updateLineItem(idx: number, field: keyof LineItem, value: string | number) {
    setForm(prev => {
      const items = [...prev.items]
      items[idx] = { ...items[idx], [field]: value }
      return { ...prev, items }
    })
  }

  function handleRecordPayment() {
    if (!selectedInvoice) return
    const due = selectedInvoice.reservation?.due_amount
    setPaymentAmount(due != null ? due : selectedInvoice.total_amount)
    setPaymentMethod('cash')
    setPaymentReference('')
    setShowPaymentModal(true)
  }

  const isFormSubmitting = createInvoice.isPending || updateInvoice.isPending
  const getGuestName = (inv: InvoiceExtended) => {
    if (inv.guest) return `${inv.guest.first_name} ${inv.guest.last_name}`
    if (inv.reservation?.guest) return `${inv.reservation.guest.first_name} ${inv.reservation.guest.last_name}`
    return '-'
  }

  const columns: Column<InvoiceExtended>[] = [
    {
      key: 'invoice_number',
      label: 'Invoice #',
      className: 'font-medium',
      render: (r) => (
        <button onClick={() => openDetailModal(r)} className="text-primary hover:underline">
          {r.invoice_number}
        </button>
      ),
    },
    {
      key: 'guest',
      label: 'Guest',
      render: (r) => <span>{getGuestName(r)}</span>,
    },
    {
      key: 'reservation_id',
      label: 'Reservation #',
      render: (r) => <span>{r.reservation?.reservation_number ?? `#${r.reservation_id}`}</span>,
    },
    {
      key: 'total_amount',
      label: 'Amount',
      render: (r) => <span className="font-medium">{formatCurrency(r.total_amount)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'issued_date',
      label: 'Issued Date',
      render: (r) => <span>{formatDate(r.issued_date)}</span>,
    },
    {
      key: 'due_date',
      label: 'Due Date',
      render: (r) => <span>{formatDate(r.due_date)}</span>,
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
          {r.status === 'draft' && (
            <RowActionButton
              tone="danger"
              title="Delete"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => setDeleteConfirmId(r.id)}
            />
          )}
          <RowActionButton
            tone="info"
            title="Download PDF"
            icon={<Download className="h-4 w-4" />}
            onClick={() => handleDownloadPdf(r.id)}
          />
        </RowActions>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Manage invoices and billing."
        actions={
          <Button variant="gold" onClick={openNewForm}>
            <Plus className="h-4 w-4" />
            Generate Invoice
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Input
                placeholder="Search by invoice # or guest name..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <div className="w-44">
              <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
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
            data={invoices}
            loading={isLoading}
            error={error ? 'Failed to load invoices' : null}
            pagination={invoicesData ? {
              currentPage: page,
              lastPage: totalPages,
              total: invoicesData.total,
              from: (invoicesData.current_page - 1) * invoicesData.per_page + 1,
              to: Math.min(invoicesData.current_page * invoicesData.per_page, invoicesData.total),
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
        title={`Invoice ${detailInvoice?.invoice_number ?? selectedInvoice?.invoice_number ?? ''}`}
        size="xl"
      >
        {detailLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 w-full animate-pulse rounded bg-bg" />
            ))}
          </div>
        ) : detailInvoice ? (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {hotelLogo && (
                  <img src={hotelLogo} alt={hotelName} className="h-12 w-12 rounded-lg border border-border bg-card object-contain p-1" />
                )}
                <div>
                  <h3 className="text-lg font-bold text-foreground">{hotelName}</h3>
                  {hotelAddress && <p className="text-sm text-muted">{hotelAddress}</p>}
                  <p className="text-sm text-muted">{hotelPhone}</p>
                  <p className="text-sm text-muted">{hotelEmail}</p>
                </div>
              </div>
              <div className="text-right">
                <StatusBadge status={detailInvoice.status} />
                <p className="mt-1 text-sm text-muted">Issued: {formatDate(detailInvoice.issued_date)}</p>
                <p className="text-sm text-muted">Due: {formatDate(detailInvoice.due_date)}</p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted">Guest</p>
              <p className="text-sm font-medium text-foreground">{getGuestName(detailInvoice)}</p>
              <p className="text-xs text-muted">{detailInvoice.guest?.email ?? ''}</p>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-foreground">Invoice Items</h4>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg/50">
                      <th className="px-4 py-2 text-left font-medium text-muted">Description</th>
                      <th className="px-4 py-2 text-right font-medium text-muted">Qty</th>
                      <th className="px-4 py-2 text-right font-medium text-muted">Unit Price</th>
                      <th className="px-4 py-2 text-right font-medium text-muted">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailInvoice.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 text-foreground">{item.description}</td>
                        <td className="px-4 py-2 text-right text-muted">{item.quantity}</td>
                        <td className="px-4 py-2 text-right text-muted">{formatCurrency(item.unit_price)}</td>
                        <td className="px-4 py-2 text-right font-medium text-foreground">{formatCurrency(item.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span>{formatCurrency(detailInvoice.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Tax</span>
                <span>{formatCurrency(detailInvoice.tax_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Discount</span>
                <span>{formatCurrency(detailInvoice.discount_amount)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-semibold text-foreground">
                <span>Total</span>
                <span>{formatCurrency(detailInvoice.total_amount)}</span>
              </div>
            </div>

            {detailInvoice.status === 'paid' && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-foreground">Payment History</h4>
                <p className="text-sm text-muted">Payment recorded on {formatDate(detailInvoice.issued_date)}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDetailModal(false)}>Close</Button>
              {detailInvoice.status === 'draft' && (
                <Button variant="primary" onClick={() => setSendConfirmId(detailInvoice.id)}>
                  <Send className="h-4 w-4" /> Send Invoice
                </Button>
              )}
              {(detailInvoice.status === 'sent' || detailInvoice.status === 'overdue') && (
                <Button variant="primary" onClick={handleRecordPayment}>
                  <DollarSign className="h-4 w-4" /> Record Payment
                </Button>
              )}
              <Button variant="outline" onClick={() => handleDownloadPdf(detailInvoice.id)}>
                <Download className="h-4 w-4" /> Download PDF
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 text-center">
            <AlertCircle className="mb-2 h-8 w-8 text-muted" />
            <p className="text-sm text-muted">Could not load invoice details.</p>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showFormModal}
        onClose={closeFormModal}
        title={editingInvoice ? 'Edit Invoice' : 'Generate Invoice'}
        size="xl"
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Reservation</label>
            <Select
              value={form.reservation_id ? String(form.reservation_id) : ''}
              onChange={(e) => handleReservationSelect(Number(e.target.value))}
              error={formErrors.reservation_id}
            >
              <option value="" disabled>Select a reservation</option>
              {reservations.map(r => (
                <option key={r.id} value={r.id}>
                  #{r.reservation_number} - {r.guest?.first_name} {r.guest?.last_name} ({formatCurrency(r.total_amount)})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Invoice Items</label>
              <Button variant="ghost" size="sm" onClick={addLineItem}>
                <Plus className="h-3.5 w-3.5" /> Add Item
              </Button>
            </div>
            {formErrors.items && <p className="mb-2 text-xs text-danger">{formErrors.items}</p>}
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded-lg border border-border p-3">
                  <div className="flex-1">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                      error={formErrors[`item_${idx}_desc`]}
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      min={1}
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(idx, 'quantity', Number(e.target.value))}
                      error={formErrors[`item_${idx}_qty`]}
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Price"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(idx, 'unit_price', Number(e.target.value))}
                      error={formErrors[`item_${idx}_price`]}
                    />
                  </div>
                  <div className="flex h-10 items-center justify-center font-medium text-foreground min-w-[80px]">
                    {formatCurrency(item.quantity * item.unit_price)}
                  </div>
                  <Button variant="ghost" size="sm" square onClick={() => removeLineItem(idx)} disabled={form.items.length <= 1}>
                    <X className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tax (%)"
              type="number"
              min={0}
              max={100}
              value={form.tax_percent}
              onChange={(e) => setForm(prev => ({ ...prev, tax_percent: Number(e.target.value) }))}
            />
            <Input
              label="Discount (%)"
              type="number"
              min={0}
              max={100}
              value={form.discount_percent}
              onChange={(e) => setForm(prev => ({ ...prev, discount_percent: Number(e.target.value) }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DatePicker
              label="Issue Date"
              value={form.issued_date}
              onChange={(v) => setForm(prev => ({ ...prev, issued_date: v }))}
            />
            <DatePicker
              label="Due Date"
              value={form.due_date}
              onChange={(v) => setForm(prev => ({ ...prev, due_date: v }))}
            />
          </div>

          <div className="rounded-lg border border-border bg-bg/50 p-4">
            <h4 className="mb-2 text-sm font-semibold text-foreground">Invoice Preview</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span>{formatCurrency(formSubtotal)}</span>
              </div>
              {form.tax_percent > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">Tax ({form.tax_percent}%)</span>
                  <span>{formatCurrency(formSubtotal * (form.tax_percent / 100))}</span>
                </div>
              )}
              {form.discount_percent > 0 && (
                <div className="flex justify-between text-danger">
                  <span>Discount ({form.discount_percent}%)</span>
                  <span>-{formatCurrency(formSubtotal * (form.discount_percent / 100))}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1 font-semibold text-foreground">
                <span>Total</span>
                <span>{formatCurrency(formTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={closeFormModal} disabled={isFormSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleFormSubmit} disabled={isFormSubmitting}>
            {isFormSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {editingInvoice ? 'Update Invoice' : 'Generate Invoice'}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Record Payment"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Amount (₱)"
            type="number"
            min={0}
            step="0.01"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(Number(e.target.value))}
          />
          <Select label="Payment Method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="online">Online</option>
          </Select>
          <Input
            label="Reference / Transaction ID"
            placeholder="Ref-12345"
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmitPayment}>Record Payment</Button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice? This action cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteInvoice.isPending}
      />

      <ConfirmDialog
        isOpen={sendConfirmId !== null}
        onClose={() => setSendConfirmId(null)}
        onConfirm={handleSend}
        title="Send Invoice"
        message="Send this invoice to the guest?"
        variant="warning"
        confirmLabel="Send"
        isLoading={sendInvoice.isPending}
      />
    </div>
  )
}
