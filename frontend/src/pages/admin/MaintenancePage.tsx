import { useState } from 'react'
import {
  useMaintenanceRequests, useCreateMaintenanceRequest, useUpdateMaintenanceStatus,
  useAssignMaintenanceRequest, useTechnicians, useCreateTechnician, useUpdateTechnician,
  useDeleteTechnician, useRooms,
} from '@/hooks/useApi'
import type { MaintenanceRequest, Technician } from '@/types'
import { formatCurrency, formatDateDisplay } from '@/lib/format'
import { stripPhoneInput } from '@/lib/phone'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { RowActions, RowActionButton } from '@/components/shared/RowActions'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores/authStore'
import { isAdminRole } from '@/lib/permissions'
import { Plus, Search, Eye, Image, Clock, DollarSign, User, Users, Trash2, Edit, Wrench, BedDouble, ClipboardList, MessageSquareText, TriangleAlert } from 'lucide-react'

const CATEGORY_OPTIONS = [
  { value: 'Plumbing', label: 'Plumbing' },
  { value: 'Electrical', label: 'Electrical' },
  { value: 'HVAC', label: 'HVAC' },
  { value: 'Furniture', label: 'Furniture' },
  { value: 'Painting', label: 'Painting' },
  { value: 'Appliance', label: 'Appliance' },
  { value: 'Other', label: 'Other' },
]

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'reported', label: 'Reported' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const CATEGORY_BADGE: Record<string, 'default' | 'info' | 'warning' | 'danger'> = {
  Plumbing: 'info',
  Electrical: 'danger',
  HVAC: 'warning',
  Furniture: 'default',
  Painting: 'info',
  Appliance: 'warning',
  Other: 'default',
}

function formatCurrencyOrNull(amount?: number) {
  if (amount == null) return '—'
  return formatCurrency(amount)
}

export default function MaintenancePage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const role = useAuthStore((s) => s.user?.role ?? '')
  const isAdmin = isAdminRole(role)

  const [showNewModal, setShowNewModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null)

  const [formData, setFormData] = useState({
    room_id: '',
    title: '',
    description: '',
    category: '',
    priority: 'medium',
    notes: '',
  })

  const [assignStaffId, setAssignStaffId] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('')

  const [showManageTechnicians, setShowManageTechnicians] = useState(false)
  const [technicianForm, setTechnicianForm] = useState({ name: '', phone: '', specialty: '' })
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null)
  const [technicianFormErrors, setTechnicianFormErrors] = useState<Record<string, string>>({})

  const params: Record<string, string | number | undefined> = {
    search: search || undefined,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    category: categoryFilter || undefined,
  }

  const { data: requestsData, isLoading, error, refetch } = useMaintenanceRequests(params)
  const { data: techniciansData } = useTechnicians()
  const { data: roomsData } = useRooms({ all: 'true' })

  const createRequest = useCreateMaintenanceRequest()
  const updateStatus = useUpdateMaintenanceStatus()
  const assignRequest = useAssignMaintenanceRequest()
  const createTechnician = useCreateTechnician()
  const updateTechnician = useUpdateTechnician()
  const deleteTechnician = useDeleteTechnician()
  const { addToast } = useToast()

  const requests = requestsData?.data ?? []
  const technicians = techniciansData ?? []
  const rooms = roomsData?.data ?? []

  const selectedRoom = rooms.find(r => r.id === Number(formData.room_id)) ?? null
  const selectedCategoryLabel = CATEGORY_OPTIONS.find(o => o.value === formData.category)?.label ?? ''
  const selectedPriorityLabel = PRIORITY_OPTIONS.find(o => o.value === formData.priority)?.label ?? ''

  const priorityChipClass =
    formData.priority === 'urgent'
      ? 'bg-danger/10 text-danger ring-danger/20'
      : formData.priority === 'high'
        ? 'bg-warning/10 text-warning ring-warning/20'
        : 'bg-success/10 text-success ring-success/20'

  function openNewModal() {
    setFormData({ room_id: '', title: '', description: '', category: '', priority: 'medium', notes: '' })
    setShowNewModal(true)
  }

  function openDetailModal(req: MaintenanceRequest) {
    setSelectedRequest(req)
    setShowDetailModal(true)
  }

  function openAssignModal(req: MaintenanceRequest) {
    setSelectedRequest(req)
    setAssignStaffId(req.assigned_to?.id?.toString() ?? '')
    setEstimatedCost(req.estimated_cost?.toString() ?? '')
    setShowAssignModal(true)
  }

  function handleCreate() {
    const payload: Record<string, unknown> = {
      room_id: Number(formData.room_id),
      title: formData.title,
      description: formData.description,
      category: formData.category,
      priority: formData.priority,
    }
    if (formData.notes) payload.notes = formData.notes
    createRequest.mutate(payload, {
      onSuccess: () => setShowNewModal(false),
      onError: (err) => {
        const message = err instanceof Error ? err.message : 'Failed to report maintenance request.'
        addToast(message, 'error')
      },
    })
  }

  function handleAssign() {
    if (!selectedRequest || !assignStaffId) return
    assignRequest.mutate(
      { id: selectedRequest.id, assigned_to: Number(assignStaffId), estimated_cost: estimatedCost ? Number(estimatedCost) : undefined },
      { onSuccess: () => setShowAssignModal(false) },
    )
  }

  function handleQuickAction(requestId: number, status: string) {
    updateStatus.mutate({ id: requestId, status })
  }

  function openManageTechnicians() {
    setEditingTechnician(null)
    setTechnicianForm({ name: '', phone: '', specialty: '' })
    setTechnicianFormErrors({})
    setShowManageTechnicians(true)
  }

  function startEditTechnician(t: Technician) {
    setEditingTechnician(t)
    setTechnicianForm({ name: t.name, phone: t.phone ?? '', specialty: t.specialty ?? '' })
    setTechnicianFormErrors({})
  }

  function handleTechnicianSave() {
    const errors: Record<string, string> = {}
    if (!technicianForm.name.trim()) errors.name = 'Name is required'
    setTechnicianFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    const payload = {
      name: technicianForm.name.trim(),
      phone: technicianForm.phone.trim() || null,
      specialty: technicianForm.specialty.trim() || null,
    }

    const onError = (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to save technician.'
      addToast(message, 'error')
    }

    if (editingTechnician) {
      updateTechnician.mutate({ id: editingTechnician.id, data: payload }, {
        onSuccess: () => {
          addToast('Technician updated.', 'success')
          setEditingTechnician(null)
          setTechnicianForm({ name: '', phone: '', specialty: '' })
        },
        onError,
      })
    } else {
      createTechnician.mutate(payload, {
        onSuccess: () => {
          addToast('Technician added.', 'success')
          setTechnicianForm({ name: '', phone: '', specialty: '' })
        },
        onError,
      })
    }
  }

  function handleTechnicianToggleActive(t: Technician) {
    updateTechnician.mutate({ id: t.id, data: { is_active: !t.is_active } }, {
      onError: (err) => {
        const message = err instanceof Error ? err.message : 'Failed to update technician.'
        addToast(message, 'error')
      },
    })
  }

  function handleDeleteTechnician(t: Technician) {
    deleteTechnician.mutate(t.id, {
      onSuccess: () => addToast('Technician deleted.', 'success'),
      onError: (err) => {
        const message = err instanceof Error ? err.message : 'Failed to delete technician.'
        addToast(message, 'error')
      },
    })
  }

  const columns: Column<MaintenanceRequest>[] = [
    {
      key: 'id',
      label: 'ID',
      render: (r) => <span className="font-mono text-xs text-muted">#{r.id}</span>,
    },
    {
      key: 'room',
      label: 'Room #',
      render: (r) => <span className="font-semibold">{r.room.room_number}</span>,
    },
    {
      key: 'title',
      label: 'Title',
      render: (r) => (
        <button onClick={() => openDetailModal(r)} className="text-left text-primary hover:underline">
          {r.title}
        </button>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (r) => (
        <Badge variant={CATEGORY_BADGE[r.category] ?? 'default'} size="sm">
          {r.category}
        </Badge>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (r) => <StatusBadge status={r.priority} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'assigned_to',
      label: 'Assigned To',
      render: (r) => (
        <span className="text-muted">{r.assigned_to ? r.assigned_to.name : '—'}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Reported Date',
      render: (r) => <span className="text-muted">{r.created_at ? formatDateDisplay(r.created_at) : '-'}</span>,
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
          {isAdmin && r.status === 'reported' && (
            <RowActionButton
              tone="info"
              title="Assign"
              label="Assign"
              icon={<User className="h-4 w-4" />}
              onClick={() => openAssignModal(r)}
            />
          )}
          {isAdmin && r.status === 'assigned' && (
            <RowActionButton
              tone="success"
              title="Start Work"
              label="Start Work"
              onClick={() => handleQuickAction(r.id, 'in_progress')}
            />
          )}
          {isAdmin && r.status === 'in_progress' && (
            <RowActionButton
              tone="success"
              title="Complete"
              label="Complete"
              onClick={() => handleQuickAction(r.id, 'completed')}
            />
          )}
          {isAdmin && (r.status === 'reported' || r.status === 'assigned' || r.status === 'in_progress') && (
            <RowActionButton
              tone="danger"
              title="Cancel"
              label="Cancel"
              onClick={() => handleQuickAction(r.id, 'cancelled')}
            />
          )}
        </RowActions>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Maintenance"
        description="Manage maintenance requests and work orders."
        actions={
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" onClick={openManageTechnicians}>
                <Users className="h-4 w-4" />
                Manage Technicians
              </Button>
            )}
            <Button variant="gold" onClick={openNewModal}>
              <Plus className="h-4 w-4" />
              Report Issue
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative max-w-[200px] flex-1">
              <Input
                placeholder="Search room or title..."
                icon={<Search className="h-4 w-4" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-[140px]">
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
            <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="w-[130px]">
              {PRIORITY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-[150px]">
              <option value="">All Categories</option>
              {CATEGORY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>

          <DataTable
            columns={columns}
            data={requests}
            loading={isLoading}
            error={error ? (error as Error).message : null}
            onRetry={() => refetch()}
            keyExtractor={(r) => r.id}
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Report Maintenance Issue"
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowNewModal(false)} disabled={createRequest.isPending}>
              Cancel
            </Button>
            <Button variant="gold" onClick={handleCreate} disabled={createRequest.isPending}>
              {createRequest.isPending ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/15 text-warning">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Report an Issue</h4>
              <p className="text-xs text-muted">
                Log a maintenance problem so the team can assign a technician and get it fixed.
              </p>
            </div>
          </div>

          {(selectedRoom || selectedCategoryLabel) && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/20 bg-warning/5 px-3.5 py-2.5">
              {selectedRoom && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <BedDouble className="h-3.5 w-3.5 text-warning" />
                  Room {selectedRoom.room_number}
                  <span className="text-xs font-normal text-muted">
                    {selectedRoom.room_type?.name ?? ''}
                    {selectedRoom.room_type?.name && selectedRoom.floor ? ` · Floor ${selectedRoom.floor}` : ''}
                  </span>
                </span>
              )}
              {selectedRoom && selectedCategoryLabel && <span className="text-warning">·</span>}
              {selectedCategoryLabel && (
                <span className="flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-foreground ring-1 ring-gray-200">
                  <ClipboardList className="h-3 w-3 text-muted" />
                  {selectedCategoryLabel}
                </span>
              )}
              {selectedPriorityLabel && (
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ${priorityChipClass}`}>
                  <TriangleAlert className="h-3 w-3" />
                  {selectedPriorityLabel}
                </span>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <TriangleAlert className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">Issue Details</h4>
            </div>
            <div className="space-y-4">
              <Select
                label="Room"
                placeholder="Select a room"
                value={formData.room_id}
                onChange={(e) => setFormData(f => ({ ...f, room_id: e.target.value }))}
              >
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>{r.room_number} — {r.room_type?.name ?? ''}</option>
                ))}
              </Select>
              <Input
                label="Title"
                placeholder="Brief description of the issue"
                value={formData.title}
                onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
              />
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <MessageSquareText className="h-3.5 w-3.5 text-muted" />
                  Description
                </label>
                <textarea
                  className="flex min-h-[100px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm ring-offset-card placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
                  placeholder="Detailed description of the issue..."
                  value={formData.description}
                  onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ClipboardList className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">Category & Priority</h4>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Category"
                  placeholder="Select category"
                  value={formData.category}
                  onChange={(e) => setFormData(f => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
                <Select
                  label="Priority"
                  value={formData.priority}
                  onChange={(e) => setFormData(f => ({ ...f, priority: e.target.value }))}
                >
                  {PRIORITY_OPTIONS.filter(o => o.value).map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <MessageSquareText className="h-3.5 w-3.5 text-muted" />
                  Notes
                </label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm ring-offset-card placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
                  placeholder="Internal notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Assign Technician"
        size="sm"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>
              Cancel
            </Button>
            <Button variant="gold" onClick={handleAssign} disabled={!assignStaffId}>
              Confirm
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Assign technician to {selectedRequest?.title} (Room {selectedRequest?.room.room_number})
          </p>
          <Select
            label="Technician"
            placeholder="Select technician"
            value={assignStaffId}
            onChange={(e) => setAssignStaffId(e.target.value)}
          >
            {technicians.filter(t => t.is_active).map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
          <Input
            label="Estimated Cost (₱)"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Maintenance Request Details"
        size="xl"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowDetailModal(false)}>Close</Button>
            {isAdmin && selectedRequest?.status === 'reported' && (
              <Button variant="primary" onClick={() => { setShowDetailModal(false); selectedRequest && openAssignModal(selectedRequest) }}>
                <User className="h-4 w-4" /> Assign Technician
              </Button>
            )}
            {isAdmin && selectedRequest?.status === 'assigned' && (
              <Button variant="primary" onClick={() => selectedRequest && handleQuickAction(selectedRequest.id, 'in_progress')}>
                Start Work
              </Button>
            )}
            {isAdmin && selectedRequest?.status === 'in_progress' && (
              <Button variant="primary" onClick={() => selectedRequest && handleQuickAction(selectedRequest.id, 'completed')}>
                Complete
              </Button>
            )}
            {isAdmin && (selectedRequest?.status === 'reported' || selectedRequest?.status === 'assigned' || selectedRequest?.status === 'in_progress') && (
              <Button variant="danger" onClick={() => selectedRequest && handleQuickAction(selectedRequest.id, 'cancelled')}>
                Cancel
              </Button>
            )}
          </div>
        }
      >
        {selectedRequest && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted">Request ID</label>
                <p className="text-sm font-mono">#{selectedRequest.id}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Status</label>
                <div className="mt-0.5"><StatusBadge status={selectedRequest.status} /></div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Room</label>
                <p className="text-sm font-semibold">{selectedRequest.room.room_number}</p>
                <p className="text-xs text-muted">{selectedRequest.room.room_type?.name ?? ''} — Floor {selectedRequest.room.floor}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Priority</label>
                <div className="mt-0.5"><StatusBadge status={selectedRequest.priority} /></div>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted">Title</label>
                <p className="text-sm font-semibold">{selectedRequest.title}</p>
              </div>
              {selectedRequest.description && (
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted">Description</label>
                  <p className="text-sm text-foreground">{selectedRequest.description}</p>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted">Category</label>
                <div className="mt-0.5">
                  <Badge variant={CATEGORY_BADGE[selectedRequest.category] ?? 'default'} size="sm">
                    {selectedRequest.category}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Assigned To</label>
                <p className="text-sm">{selectedRequest.assigned_to?.name ?? '—'}</p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Image className="h-4 w-4 text-muted" />
                Images
              </h4>
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border py-8">
                <p className="text-sm text-muted">No images attached</p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Clock className="h-4 w-4 text-muted" />
                Activity Timeline
              </h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-info" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Reported</p>
                    <p className="text-xs text-muted">{selectedRequest.created_at ? formatDateDisplay(selectedRequest.created_at) : 'Unknown'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className={`mt-1 h-2 w-2 rounded-full ${selectedRequest.status === 'assigned' || selectedRequest.status === 'in_progress' || selectedRequest.status === 'completed' ? 'bg-info' : 'bg-border'}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">Assigned</p>
                    <p className="text-xs text-muted">{selectedRequest.assigned_to ? `Assigned to ${selectedRequest.assigned_to.name}` : 'Pending assignment'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className={`mt-1 h-2 w-2 rounded-full ${selectedRequest.status === 'in_progress' || selectedRequest.status === 'completed' ? 'bg-warning' : 'bg-border'}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">In Progress</p>
                    <p className="text-xs text-muted">{selectedRequest.status === 'in_progress' || selectedRequest.status === 'completed' ? 'Work started' : 'Not started'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className={`mt-1 h-2 w-2 rounded-full ${selectedRequest.status === 'completed' ? 'bg-success' : 'bg-border'}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">Completed</p>
                    <p className="text-xs text-muted">{selectedRequest.status === 'completed' ? 'Work finished' : 'Pending'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <DollarSign className="h-4 w-4 text-muted" />
                Cost Tracking
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted">Estimated Cost</label>
                  <p className="text-sm font-semibold text-foreground">{formatCurrencyOrNull(selectedRequest.estimated_cost)}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted">Actual Cost</label>
                  <p className="text-sm font-semibold text-foreground">{formatCurrencyOrNull(selectedRequest.actual_cost)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showManageTechnicians}
        onClose={() => setShowManageTechnicians(false)}
        title="Manage Technicians"
        size="xl"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowManageTechnicians(false)}>
              Close
            </Button>
            <Button variant="gold" onClick={handleTechnicianSave}>
              {editingTechnician ? 'Update' : 'Add'} Technician
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="rounded-lg border border-border p-4">
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              {editingTechnician ? `Edit ${editingTechnician.name}` : 'Add New Technician'}
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="Name"
                placeholder="e.g. Mario Santos"
                value={technicianForm.name}
                onChange={(e) => setTechnicianForm((f) => ({ ...f, name: e.target.value }))}
                error={technicianFormErrors.name}
              />
              <Input
                label="Phone"
                placeholder="0917 123 4567 (optional)"
                value={technicianForm.phone}
                onChange={(e) => setTechnicianForm((f) => ({ ...f, phone: stripPhoneInput(e.target.value) }))}
                maxLength={15}
              />
              <Input
                label="Specialty"
                placeholder="e.g. HVAC / Electrical"
                value={technicianForm.specialty}
                onChange={(e) => setTechnicianForm((f) => ({ ...f, specialty: e.target.value }))}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border">
            <div className="divide-y divide-border">
              {technicians.length === 0 && (
                <p className="p-4 text-sm text-muted">No technicians yet. Add one above.</p>
              )}
              {technicians.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
                      {!t.is_active && (
                        <Badge variant="default" size="sm">Inactive</Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted">
                      {[t.specialty, t.phone].filter(Boolean).join(' · ') || 'No contact details'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => startEditTechnician(t)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant={t.is_active ? 'outline' : 'primary'}
                      size="sm"
                      onClick={() => handleTechnicianToggleActive(t)}
                    >
                      {t.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteTechnician(t)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
