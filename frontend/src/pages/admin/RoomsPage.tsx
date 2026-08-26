import { useState } from 'react'
import { useRooms, useRoomTypes, useUpdateRoom } from '@/hooks/useApi'
import type { Room, RoomImage } from '@/types'
import { formatCurrency } from '@/lib/format'
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
import { useAuthStore } from '@/stores/authStore'
import { isAdminRole } from '@/lib/permissions'
import { useToast } from '@/components/ui/toast'
import {
  Search, Users, X,
  Edit, Save, MapPin, BedDouble, Tag, Radio, StickyNote, Loader2
} from 'lucide-react'

const ROOM_STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'dirty', label: 'Dirty' },
  { value: 'maintenance', label: 'Maintenance' },
]

const ROOM_STATUS_HELPERS: Record<string, string> = {
  available: 'The room can be booked on the portal and for new reservations.',
  occupied: 'A guest is currently checked in.',
  reserved: 'An upcoming confirmed reservation is assigned to this room.',
  dirty: 'The room needs cleaning after a guest departure.',
  maintenance: 'The room is out of order and hidden from portal booking.',
}

const FLOOR_OPTIONS = [
  { value: '', label: 'All Floors' },
  { value: '1', label: 'Floor 1' },
  { value: '2', label: 'Floor 2' },
  { value: '3', label: 'Floor 3' },
]

interface RoomFormData {
  room_number: string
  room_type_id: number | ''
  floor: number | ''
  price_override: string
  status: string
  description: string
  notes: string
}

const defaultFormData: RoomFormData = {
  room_number: '',
  room_type_id: '',
  floor: '',
  price_override: '',
  status: 'available',
  description: '',
  notes: '',
}

export default function RoomsPage() {
  const [search, setSearch] = useState('')
  const role = useAuthStore((s) => s.user?.role ?? '')
  const isAdmin = isAdminRole(role)
  const { addToast } = useToast()
  const [currentPage, setCurrentPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [floorFilter, setFloorFilter] = useState('')
  const [roomTypeFilter, setRoomTypeFilter] = useState('')

  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [formData, setFormData] = useState<RoomFormData>(defaultFormData)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof RoomFormData, string>>>({})

  const params: Record<string, string | number | undefined> = {
    page: currentPage,
    per_page: 12,
    search: search || undefined,
    status: statusFilter || undefined,
    floor: floorFilter || undefined,
    room_type_id: roomTypeFilter || undefined,
  }

  const { data: roomsData, isLoading: roomsLoading, error: roomsError, refetch: refetchRooms } = useRooms(params)

  const { data: roomTypesData } = useRoomTypes(undefined, { enabled: isAdmin })
  const updateRoom = useUpdateRoom()

  const rooms = roomsData?.data ?? []
  const paginationInfo = roomsData
    ? { currentPage: roomsData.current_page, lastPage: roomsData.last_page, total: roomsData.total, per_page: roomsData.per_page }
    : null
  const roomTypesList = roomTypesData?.data ?? []
  const selectedRoomType = roomTypesList.find((rt) => rt.id === formData.room_type_id)
  const primaryImage = selectedRoom?.images?.find(img => img.is_primary) ?? selectedRoom?.images?.[0]
  const effectivePrice = formData.price_override !== ''
    ? Number(formData.price_override)
    : selectedRoomType ? Number(selectedRoomType.base_price) : 0

  function getRoomTypeName(room: Room): string {
    return typeof room.room_type === 'object' ? room.room_type?.name ?? '-' : '-'
  }

  function getRoomTypeId(room: Room): number {
    return typeof room.room_type === 'object' ? room.room_type?.id : 0
  }

  function openEditModal(room: Room) {
    setSelectedRoom(room)
    setFormData({
      room_number: room.room_number,
      room_type_id: getRoomTypeId(room),
      floor: room.floor,
      price_override: room.price_override?.toString() ?? '',
      status: room.status,
      description: room.description ?? '',
      notes: room.notes ?? '',
    })
    setFormErrors({})
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setSelectedRoom(null)
  }

  function validateForm(): boolean {
    const errors: Partial<Record<keyof RoomFormData, string>> = {}
    if (!formData.room_number.trim()) errors.room_number = 'Room number is required'
    if (formData.room_type_id === '') errors.room_type_id = 'Room type is required'
    if (formData.floor === '') errors.floor = 'Floor is required'
    else if (Number(formData.floor) < 0) errors.floor = 'Floor must be 0 or greater'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateForm()) return
    if (!selectedRoom) return

    const payload: Record<string, unknown> = {
      room_number: formData.room_number,
      room_type_id: formData.room_type_id,
      floor: Number(formData.floor),
      status: formData.status,
      description: formData.description === '' ? null : formData.description,
      notes: formData.notes === '' ? null : formData.notes,
      price_override: formData.price_override === '' ? null : Number(formData.price_override),
    }

    updateRoom.mutate({ id: selectedRoom.id, data: payload }, {
      onSuccess: () => {
        addToast('Room updated successfully', 'success')
        closeModal()
      },
      onError: (err: unknown) => {
        addToast(err instanceof Error ? err.message : 'Failed to update room', 'error')
      },
    })
  }

  function updateField<K extends keyof RoomFormData>(key: K, value: RoomFormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }))
    if (formErrors[key]) {
      setFormErrors((prev) => {
        const copy = { ...prev }
        delete copy[key]
        return copy
      })
    }
  }

  function getPrice(room: Room): number {
    if (room.price_override != null) return Number(room.price_override)
    const rt = typeof room.room_type === 'object' ? room.room_type : null
    return rt ? Number(rt.base_price) : 0
  }

  const isMutating = updateRoom.isPending

  // Helper to get primary image for a room
  function getPrimaryImage(room: Room): RoomImage | undefined {
    return room.images?.find(img => img.is_primary) ?? room.images?.[0]
  }

  const listColumns: Column<Room>[] = [
    {
      key: 'room_number',
      label: 'Room',
      render: (r) => {
        const img = getPrimaryImage(r)
        return (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-primary/10">
              {img ? (
                <img src={img.image_url} alt={`Room ${r.room_number}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-primary">
                  <BedDouble className="h-5 w-5" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-foreground block truncate">Room {r.room_number}</span>
              <span className="text-xs text-muted truncate block">{getRoomTypeName(r)}</span>
            </div>
          </div>
        )
      },
    },
    {
      key: 'floor',
      label: 'Floor',
      render: (r) => (
        <div className="flex items-center gap-1.5 text-muted">
          <MapPin className="h-3.5 w-3.5" /> Floor {r.floor}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: Room) => <StatusBadge status={r.status} />,
    },
    {
      key: 'cleaning_status',
      label: 'Cleaning',
      render: (r: Room) => <StatusBadge status={r.cleaning_status ?? 'clean'} />,
    },
    {
      key: 'price',
      label: 'Price',
      className: 'text-right font-semibold',
      render: (r) => (
        <span className="text-foreground">{formatCurrency(getPrice(r))}</span>
      ),
    },
    {
      key: 'capacity',
      label: 'Capacity',
      render: (r) => (
        <div className="flex items-center gap-1.5 text-muted">
          <Users className="h-3.5 w-3.5" /> {r.capacity}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <RowActions>
          {isAdmin && (
            <RowActionButton
              tone="neutral"
              title="Edit"
              icon={<Edit className="h-4 w-4" />}
              onClick={() => openEditModal(r)}
            />
          )}
        </RowActions>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Rooms"
        description="Manage hotel rooms and their availability."
      />

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative max-w-[200px] flex-1">
              <Input
                placeholder="Search room number..."
                icon={<Search className="h-4 w-4" />}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
              className="w-[140px]"
            >
              <option value="">All Status</option>
              {ROOM_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
            <Select
              value={floorFilter}
              onChange={(e) => { setFloorFilter(e.target.value); setCurrentPage(1) }}
              className="w-[130px]"
            >
              {FLOOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
            {isAdmin && (
              <Select
                value={roomTypeFilter}
                onChange={(e) => { setRoomTypeFilter(e.target.value); setCurrentPage(1) }}
                className="w-[160px]"
              >
                <option value="">All Types</option>
                {roomTypesList.map((rt) => (
                  <option key={rt.id} value={rt.id}>{rt.name}</option>
                ))}
              </Select>
            )}
          </div>

          {/* Active Filter Bar */}
          {(search || statusFilter || floorFilter || roomTypeFilter) && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted">
              <span>Active filters:</span>
              {search && (
                <Badge variant="secondary" className="gap-1">
                  Search: {search}
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { setSearch(''); setCurrentPage(1) }}>
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {statusFilter && (
                <Badge variant="secondary" className="gap-1">
                  Status: {ROOM_STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { setStatusFilter(''); setCurrentPage(1) }}>
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {floorFilter && (
                <Badge variant="secondary" className="gap-1">
                  Floor: {floorFilter}
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { setFloorFilter(''); setCurrentPage(1) }}>
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {roomTypeFilter && (
                <Badge variant="secondary" className="gap-1">
                  Type: {roomTypesList.find(rt => rt.id === Number(roomTypeFilter))?.name}
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { setRoomTypeFilter(''); setCurrentPage(1) }}>
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatusFilter(''); setFloorFilter(''); setRoomTypeFilter(''); setCurrentPage(1) }}>
                Clear all
              </Button>
            </div>
          )}

          <DataTable
            columns={listColumns}
            data={rooms}
            loading={roomsLoading}
            error={roomsError ? (roomsError as Error).message : null}
            onSearch={undefined}
            onRetry={() => refetchRooms()}
            keyExtractor={(r) => r.id}
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <BedDouble className="mb-3 h-10 w-10 text-muted/50" />
                <p className="text-sm font-medium text-foreground">No rooms match your filters</p>
                <p className="text-sm text-muted">Try adjusting your search or filters.</p>
                {(search || statusFilter || floorFilter || roomTypeFilter) && (
                  <Button variant="outline" className="mt-4" onClick={() => { setSearch(''); setStatusFilter(''); setFloorFilter(''); setRoomTypeFilter(''); setCurrentPage(1) }}>
                    Clear all filters
                  </Button>
                )}
              </div>
            }
            pagination={paginationInfo ? {
              currentPage: paginationInfo.currentPage,
              lastPage: paginationInfo.lastPage,
              total: paginationInfo.total,
              from: paginationInfo.total ? (paginationInfo.currentPage - 1) * paginationInfo.per_page + 1 : 0,
              to: paginationInfo.total ? Math.min(paginationInfo.currentPage * paginationInfo.per_page, paginationInfo.total) : 0,
              onPageChange: setCurrentPage,
            } : undefined}
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={modalMode !== null}
        onClose={closeModal}
        title={modalMode === 'add' ? 'Add Room' : 'Edit Room'}
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={closeModal} disabled={isMutating}>
              Cancel
            </Button>
            <Button variant="gold" onClick={handleSubmit} disabled={isMutating}>
              {isMutating ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save Room</>}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-5">
            {selectedRoom && modalMode === 'edit' && (
              <div className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-primary/10">
                  {primaryImage ? (
                    <img src={primaryImage.image_url} alt={`Room ${selectedRoom.room_number}`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-primary">
                      <BedDouble className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-lg font-bold text-foreground">Room {selectedRoom.room_number}</h4>
                  <p className="mt-0.5 text-sm text-muted">
                    {getRoomTypeName(selectedRoom)}
                    {selectedRoom.room_type?.bed_type ? ` · ${selectedRoom.room_type.bed_type}` : ''}
                    {` · Floor ${selectedRoom.floor}`}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={selectedRoom.status} />
                    <StatusBadge status={selectedRoom.cleaning_status ?? 'clean'} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium text-muted">Current Price</p>
                  <p className="mt-1 text-lg font-bold text-gold-dark">{formatCurrency(getPrice(selectedRoom))}</p>
                  <p className="mt-1 flex items-center justify-end gap-1 text-xs text-muted">
                    <Users className="h-3 w-3" /> Sleeps {selectedRoom.capacity}
                  </p>
                </div>
              </div>
            )}

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BedDouble className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Room Details</h4>
                  <p className="text-xs text-muted">Basic identification and room type.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Room Number"
                  placeholder="101"
                  value={formData.room_number}
                  onChange={(e) => updateField('room_number', e.target.value)}
                  error={formErrors.room_number}
                />
                <Select
                  label="Room Type"
                  placeholder="Select type"
                  value={formData.room_type_id}
                  onChange={(e) => updateField('room_type_id', e.target.value ? Number(e.target.value) : '')}
                  error={formErrors.room_type_id}
                >
                  {roomTypesList.map((rt) => (
                    <option key={rt.id} value={rt.id}>{rt.name} ({formatCurrency(Number(rt.base_price))})</option>
                  ))}
                </Select>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Tag className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Location & Pricing</h4>
                  <p className="text-xs text-muted">Floor assignment and per-night rate.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Floor"
                  type="number"
                  min={0}
                  placeholder="1"
                  value={formData.floor === '' ? '' : formData.floor}
                  onChange={(e) => updateField('floor', e.target.value ? Number(e.target.value) : '')}
                  error={formErrors.floor}
                />
                <div className="space-y-1">
                  <Input
                    label="Price Override"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={selectedRoomType ? `${selectedRoomType.base_price}` : 'Auto'}
                    value={formData.price_override}
                    onChange={(e) => updateField('price_override', e.target.value)}
                  />
                  <p className="text-xs text-muted">Leave empty to use the room type's base price.</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/5 px-3 py-2.5">
                <span className="text-sm font-medium text-primary-dark">Effective Price / Night</span>
                <span className="text-base font-bold text-primary-dark">{formatCurrency(effectivePrice)}</span>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Radio className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Room Status</h4>
                  <p className="text-xs text-muted">Current availability of this room.</p>
                </div>
              </div>
              <Select
                label="Status"
                value={formData.status}
                onChange={(e) => updateField('status', e.target.value)}
              >
                {ROOM_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
              <p className="mt-2 text-xs text-muted">{ROOM_STATUS_HELPERS[formData.status]}</p>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <StickyNote className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Description & Notes</h4>
                  <p className="text-xs text-muted">Guest-facing description and internal notes.</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Description</label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm ring-offset-card placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
                    placeholder="Room description..."
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Notes</label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm ring-offset-card placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
                    placeholder="Internal notes..."
                    value={formData.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                  />
                </div>
              </div>
            </section>
          </div>
        </form>
      </Modal>
    </div>
  )
}
