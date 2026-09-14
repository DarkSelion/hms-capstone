import { useState, useRef } from 'react'
import {
  useRoomTypes, useRoomTypeImages, useUploadRoomTypeImage,
  useUpdateRoomTypeImage, useDeleteRoomTypeImage,
} from '@/hooks/useApi'
import type { RoomTypeImage } from '@/types'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import {
  Trash2, Star, Loader2, ImageIcon, Images, Plus,
} from 'lucide-react'

export default function RoomTypeImagesPage() {
  const { data: roomTypesData, isLoading: typesLoading } = useRoomTypes({ per_page: 100 })
  const roomTypes = roomTypesData?.data ?? []
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null)

  const selectedType = roomTypes.find(rt => rt.id === selectedTypeId)

  return (
    <div>
      <PageHeader
        title="Room Type Gallery"
        description="Manage the photo gallery shown on each room type's detail page"
      />

      {typesLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-bg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roomTypes.map((rt) => (
            <RoomTypeCard
              key={rt.id}
              roomType={rt}
              onSelect={() => setSelectedTypeId(rt.id)}
            />
          ))}
        </div>
      )}

      {selectedType && (
        <GalleryManager
          roomTypeId={selectedType.id}
          roomTypeName={selectedType.name}
          onClose={() => setSelectedTypeId(null)}
        />
      )}
    </div>
  )
}

function RoomTypeCard({
  roomType,
  onSelect,
}: {
  roomType: { id: number; name: string; slug: string; description?: string }
  onSelect: () => void
}) {
  const { data: images = [], isLoading } = useRoomTypeImages(roomType.id)
  const primary = images.find(img => img.is_primary) ?? images[0]

  return (
    <Card className="group cursor-pointer transition-all hover:border-gold/30 hover:shadow-md" onClick={onSelect}>
      <div className="relative aspect-[16/9] overflow-hidden rounded-t-2xl">
        {isLoading ? (
          <div className="h-full w-full animate-pulse bg-bg" />
        ) : primary ? (
          <img src={primary.image_url} alt={roomType.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-bg">
            <ImageIcon className="h-12 w-12 text-muted/30" />
          </div>
        )}
        <div className="absolute bottom-3 left-3 rounded-full bg-card/90 px-3 py-1 text-xs font-medium shadow-sm">
          {images.length} {images.length === 1 ? 'image' : 'images'}
        </div>
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-foreground">{roomType.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted">Click to manage gallery photos</p>
      </CardContent>
    </Card>
  )
}

function GalleryManager({
  roomTypeId,
  roomTypeName,
  onClose,
}: {
  roomTypeId: number
  roomTypeName: string
  onClose: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [deleteTarget, setDeleteTarget] = useState<RoomTypeImage | null>(null)

  const { data: images = [], isLoading } = useRoomTypeImages(roomTypeId)
  const uploadMutation = useUploadRoomTypeImage()
  const updateMutation = useUpdateRoomTypeImage()
  const deleteMutation = useDeleteRoomTypeImage()
  const { addToast } = useToast()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('image', file)
    try {
      await uploadMutation.mutateAsync({ roomTypeId, formData })
      addToast('Image uploaded successfully', 'success')
    } catch {
      addToast('Failed to upload image', 'error')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSetPrimary = async (image: RoomTypeImage) => {
    try {
      await updateMutation.mutateAsync({ roomTypeId, id: image.id, data: { is_primary: true } })
      addToast('Primary image updated', 'success')
    } catch {
      addToast('Failed to set primary image', 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteMutation.mutateAsync({ roomTypeId, id: deleteTarget.id })
    setDeleteTarget(null)
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${roomTypeName} — Gallery`}
      size="xl"
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3">
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
              <Plus className="h-4 w-4" />
            )}
            Add Photo
          </Button>
          <p className="text-xs text-muted">JPEG, PNG, or WebP up to 4MB — photos shown on the public room detail page</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <div className="aspect-[16/7] animate-pulse rounded-xl bg-bg" />
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-bg" />
              ))}
            </div>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Images className="mb-3 h-12 w-12 text-muted/30" />
            <p className="text-sm font-medium text-foreground">No gallery photos yet</p>
            <p className="text-sm text-muted">Upload photos to show on the public room detail page.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Hero: first image full-width */}
            {(() => {
              const first = images[0]
              return (
                <div key={first.id} className="group relative overflow-hidden rounded-xl border border-border bg-card">
                  <div className="aspect-[16/7]">
                    <img src={first.image_url} alt={first.caption || ''} className="h-full w-full object-cover" />
                  </div>
                  {first.is_primary && (
                    <div className="absolute left-2 top-2 rounded-full bg-gold/90 px-2 py-0.5 text-xs font-medium text-white">
                      Primary
                    </div>
                  )}
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {!first.is_primary && (
                      <button
                        onClick={() => handleSetPrimary(first)}
                        disabled={updateMutation.isPending}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-gold shadow hover:bg-card"
                        title="Set as primary"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteTarget(first)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-danger shadow hover:bg-card"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* Rest: 3-column row */}
            {images.length > 1 && (
              <div className="grid grid-cols-3 gap-3">
                {images.slice(1, 4).map((image) => (
                  <div key={image.id} className="group relative overflow-hidden rounded-xl border border-border bg-card">
                    <div className="aspect-[4/3]">
                      <img src={image.image_url} alt={image.caption || ''} className="h-full w-full object-cover" />
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

            {/* Overflow: more than 4 images */}
            {images.length > 4 && (
              <div className="grid grid-cols-3 gap-3">
                {images.slice(4).map((image) => (
                  <div key={image.id} className="group relative overflow-hidden rounded-xl border border-border bg-card">
                    <div className="aspect-[4/3]">
                      <img src={image.image_url} alt={image.caption || ''} className="h-full w-full object-cover" />
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
          </div>
        )}

        <ConfirmDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Image"
          message="Are you sure you want to delete this gallery image? This action cannot be undone."
          confirmLabel="Delete"
          isLoading={deleteMutation.isPending}
        />
      </div>
    </Modal>
  )
}
