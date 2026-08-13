import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Save, Trash2, Upload } from 'lucide-react'
import { useUploadBrandingImage, useDeleteBrandingImage } from '@/hooks/useApi'
import { useToast } from '@/components/ui/toast'

interface ImageSlotUploadProps {
  label: string
  imageKey: string
  value: string
}

export function ImageSlotUpload({ label, imageKey, value }: ImageSlotUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState('')
  const uploadImage = useUploadBrandingImage()
  const deleteImage = useDeleteBrandingImage()
  const { addToast } = useToast()
  const url = preview || value

  return (
    <div>
      <div className="flex items-center gap-4">
        {url ? (
          <img src={url} alt={label} className="h-16 w-24 rounded-lg border border-border bg-card object-cover" />
        ) : (
          <div className="h-16 w-24 rounded-lg border border-dashed border-border bg-bg flex items-center justify-center text-muted">
            <Upload className="h-5 w-5" />
          </div>
        )}
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) setPreview(URL.createObjectURL(file))
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Choose File
          </Button>
          {(preview || value) && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={!preview || uploadImage.isPending}
                onClick={() => {
                  const file = fileRef.current?.files?.[0]
                  if (!file) return
                  uploadImage.mutate(
                    { key: imageKey, image: file },
                    {
                      onSuccess: () => {
                        addToast(`${label} uploaded successfully`, 'success')
                        setPreview('')
                        if (fileRef.current) fileRef.current.value = ''
                      },
                      onError: () => addToast(`Failed to upload ${label.toLowerCase()}`, 'error'),
                    }
                  )
                }}
              >
                {uploadImage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {preview ? 'Upload' : 'Re-upload'}
              </Button>
              <Button
                variant="outline"
                disabled={deleteImage.isPending}
                onClick={() => {
                  deleteImage.mutate(imageKey, {
                    onSuccess: () => {
                      addToast(`${label} removed`, 'success')
                      setPreview('')
                      if (fileRef.current) fileRef.current.value = ''
                    },
                    onError: () => addToast(`Failed to remove ${label.toLowerCase()}`, 'error'),
                  })
                }}
              >
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            </div>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted">JPEG, PNG or WebP, up to 2MB.</p>
    </div>
  )
}
