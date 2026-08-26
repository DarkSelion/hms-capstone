import { useState, useRef, useMemo } from 'react'
import {
  useRooms, useRoomImages, useUploadRoomImage, useUpdateRoomImage,
  useDeleteRoomImage, useRoomTypes, useUpdateRoom, useDeleteRoom,
} from '@/hooks/useApi'
import type { RoomImage } from '@/types'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { RowActions, RowActionButton } from '@/components/shared/RowActions'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import {
  Upload, Trash2, Star, Loader2, ImageIcon, Search, Edit,
} from 'lucide-react'

export default function RoomImagesPage() {
  const [editRoomId, setEditRoomId] = useState<number | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const { addToast } = useToast()

  // All rooms fetched once — type filter + type-name search run client-side.
  const { data: roomsData, isLoading, error } = useRooms({ all: 'true' })
  const { data: roomTypesData } = useRoomTypes({ per_page: 100 })
  const roomTypes = roomTypesData?.data ?? []
  const deleteRoom = useDeleteRoom()

  const hasActiveFilters = Boolean(search || typeFilter)

  function clearAllFilters() {
    setSearch('')
    setTypeFilter('')
    setPage(1)
  }

  const filteredRooms = useMemo(() => {
    const list = roomsData?.data ?? []
    const q = search.trim().toLowerCase()
    return list.filter((r) => {
      if (typeFilter && String(r.room_type?.id ?? '') !== typeFilter) return false
      if (!q) return true
      const numberMatch = r.room_number.toLowerCase().includes(q)
      const typeMatch = (r.room_type?.name ?? '').toLowerCase().includes(q)
      return numberMatch || typeMatch
    })
  }, [roomsData, search, typeFilter])

  // Client-side pagination over the filtered list.
  const lastPage = Math.max(1, Math.ceil(filteredRooms.length / pageSize))
  const currentPage = Math.min(page, lastPage)
  const rooms = useMemo(
    () => filteredRooms.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredRooms, currentPage, pageSize],
  )

  const editRoom = editRoomId ? rooms.find(r => r.id === editRoomId) : null

  const handleDeleteRoom = async () => {
    if (!deleteConfirmId) return
    try {
      await deleteRoom.mutateAsync(deleteConfirmId)
      addToast('Room deleted successfully', 'success')
      setDeleteConfirmId(null)
    } catch {
      addToast('Failed to delete room. It may have reservation history.', 'error')
    }
  }

  const columns: Column<(typeof rooms)[number]>[] = [
    {
      key: 'room_number',
      label: 'Room ID',
      sortable: true,
      render: (r) => <span className="font-medium">{r.room_number}</span>,
    },
    {
      key: 'room_type',
      label: 'Room Type',
      sortable: true,
      render: (r) => <span>{r.room_type?.name ?? '-'}</span>,
    },
    {
      key: 'images',
      label: 'Images',
      render: (r) => {
        const images = r.images ?? []
        const primary = images.find(img => img.is_primary) ?? images[0]
        return (
          <div className="flex items-center gap-2">
            {primary ? (
              <img
                src={primary.image_url}
                alt=""
                className="h-24 w-24 flex-shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-md bg-bg text-muted">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
            <span className="text-sm text-muted">{images.length === 0 && <span className="text-sm text-muted">No images</span>}</span>
          </div>
        )
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <RowActions>
          <RowActionButton
            tone="neutral"
            title="Edit"
            icon={<Edit className="h-4 w-4" />}
            onClick={() => setEditRoomId(r.id)}
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
        title="Room Images"
        description="Manage photos for each room"
      />

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div className="relative max-w-xs flex-1">
              <Input
                placeholder="Search by room number or type..."
                icon={<Search className="h-4 w-4" />}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <Select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
              className="w-[170px]"
            >
              <option value="">All Types</option>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={String(rt.id)}>{rt.name}</option>
              ))}
            </Select>
            <Select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="w-32"
            >
              <option value={5}>5 entries</option>
              <option value={10}>10 entries</option>
              <option value={25}>25 entries</option>
              <option value={50}>50 entries</option>
            </Select>
          </div>

          <DataTable
            columns={columns}
            data={rooms}
            loading={isLoading}
            error={error ? 'Failed to load rooms' : null}
            keyExtractor={(r) => r.id}
            pagination={{
              currentPage,
              lastPage,
              total: filteredRooms.length,
              from: filteredRooms.length ? (currentPage - 1) * pageSize + 1 : 0,
              to: Math.min(currentPage * pageSize, filteredRooms.length),
              onPageChange: setPage,
            }}
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <ImageIcon className="mb-3 h-10 w-10 text-muted/50" />
                <p className="text-sm font-medium text-foreground">No rooms match your filters</p>
                <p className="text-sm text-muted">Try adjusting your search or type filter.</p>
                {hasActiveFilters && (
                  <Button variant="outline" className="mt-4" onClick={clearAllFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            }
          />
        </CardContent>
      </Card>

      {editRoom && (
        <EditRoomImagesModal
          roomId={editRoom.id}
          roomNumber={editRoom.room_number}
          currentRoomTypeId={editRoom.room_type?.id ?? 0}
          onClose={() => setEditRoomId(null)}
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDeleteRoom}
        title="Delete Room"
        message="Are you sure you want to delete this room? This action cannot be undone. The room must not have any reservation history."
        confirmLabel="Delete"
        isLoading={deleteRoom.isPending}
      />
    </div>
  )
}

function EditRoomImagesModal({
  roomId,
  roomNumber,
  currentRoomTypeId,
  onClose,
}: {
  roomId: number
  roomNumber: string
  currentRoomTypeId: number
  onClose: () => void
}) {
  const { data: roomTypesData } = useRoomTypes({ per_page: 100 })
  const roomTypes = roomTypesData?.data ?? []
  const updateRoom = useUpdateRoom()
  const { addToast } = useToast()
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState(currentRoomTypeId)

  const handleSaveRoomType = async () => {
    if (selectedRoomTypeId === currentRoomTypeId) {
      onClose()
      return
    }
    try {
      await updateRoom.mutateAsync({ id: roomId, data: { room_type_id: selectedRoomTypeId } })
      addToast('Room type updated successfully', 'success')
      onClose()
    } catch {
      addToast('Failed to update room type', 'error')
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Room ${roomNumber} — Edit Images & Room Type`}
      size="xl"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button
            variant="primary"
            onClick={handleSaveRoomType}
            disabled={updateRoom.isPending}
          >
            {updateRoom.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Room Type</label>
          <Select
            value={selectedRoomTypeId}
            onChange={(e) => setSelectedRoomTypeId(Number(e.target.value))}
          >
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>{rt.name}</option>
            ))}
          </Select>
        </div>

        <hr className="border-border" />

        <RoomImageManager roomId={roomId} />
      </div>
    </Modal>
  )
}

function RoomImageManager({ roomId }: { roomId: number }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [deleteTarget, setDeleteTarget] = useState<RoomImage | null>(null)

  const { data: images = [], isLoading: imagesLoading } = useRoomImages(roomId)
  const uploadMutation = useUploadRoomImage()
  const updateMutation = useUpdateRoomImage()
  const deleteMutation = useDeleteRoomImage()
  const { addToast } = useToast()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('image', file)

    try {
      await uploadMutation.mutateAsync({ roomId, formData })
      addToast('Image uploaded successfully', 'success')
    } catch {
      addToast('Failed to upload image', 'error')
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSetPrimary = async (image: RoomImage) => {
    try {
      await updateMutation.mutateAsync({
        roomId,
        id: image.id,
        data: { is_primary: true },
      })
      addToast('Primary image updated', 'success')
    } catch {
      addToast('Failed to set primary image', 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteMutation.mutateAsync({ roomId, id: deleteTarget.id })
    setDeleteTarget(null)
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          variant="primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload Image
        </Button>
        <p className="text-xs text-muted">JPEG, PNG, or WebP up to 4MB</p>
      </div>

      {imagesLoading ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-lg bg-bg" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <ImageIcon className="mb-3 h-12 w-12 text-muted/50" />
          <p className="text-sm font-medium text-foreground">No images yet</p>
          <p className="text-sm text-muted">Upload photos for this room.</p>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {images.map((image) => (
            <div key={image.id} className="group relative overflow-hidden rounded-lg border border-border bg-card">
              <div className="aspect-[4/3]">
                <img
                  src={image.image_url}
                  alt={image.caption || ''}
                  className="h-full w-full object-cover"
                />
              </div>
              {image.is_primary && (
                <div className="absolute left-2 top-2 rounded-full bg-gold/90 px-2 py-0.5 text-xs font-medium text-white">
                  Primary
                </div>
              )}
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {!image.is_primary && (
                  <button
                    onClick={() => handleSetPrimary(image)}
                    disabled={updateMutation.isPending}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-gold shadow hover:bg-card"
                    title="Set as primary"
                  >
                    <Star className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setDeleteTarget(image)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-danger shadow hover:bg-card"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Image"
        message="Are you sure you want to delete this image? This action cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
