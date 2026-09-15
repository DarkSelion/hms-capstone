import { useState, useEffect } from 'react'
import { useSettings, useUpdateSettings } from '@/hooks/useApi'
import { buildAmenities } from '@/lib/branding'
import type { Amenity } from '@/lib/branding'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Plus, Save, Trash2, Sparkles, ImageIcon } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

function AmenityCard({
  item,
  index,
  canDelete,
  onChange,
  onDelete,
}: {
  item: Amenity
  index: number
  canDelete: boolean
  onChange: (index: number, field: keyof Amenity, value: string) => void
  onDelete: (index: number) => void
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {item.name || `Amenity ${index + 1}`}
            </h3>
            <p className="mt-0.5 text-xs text-muted">Amenity #{index + 1}</p>
          </div>
        </div>
        {canDelete && (
          <button
            onClick={() => onDelete(index)}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="px-6 py-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Name"
            placeholder="e.g. Swimming Pool"
            value={item.name}
            onChange={(e) => onChange(index, 'name', e.target.value)}
          />
          <Input
            label="Description"
            placeholder="Short description for the homepage"
            value={item.description}
            onChange={(e) => onChange(index, 'description', e.target.value)}
          />
        </div>
        <div className="mt-4">
          <Input
            label="Image URL"
            placeholder="https://images.unsplash.com/..."
            value={item.image}
            onChange={(e) => onChange(index, 'image', e.target.value)}
          />
          {item.image && (
            <div className="mt-3 flex items-center gap-3">
              <img
                src={item.image}
                alt={item.name || 'Preview'}
                className="h-20 w-28 rounded-xl border border-gray-200 bg-bg object-cover"
              />
              <div className="text-xs text-muted">
                Image preview — make sure the URL is publicly accessible.
              </div>
            </div>
          )}
          {!item.image && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-bg/50 px-4 py-6 text-center">
              <ImageIcon className="h-5 w-5 text-muted" />
              <span className="text-xs text-muted">No image set — paste an image URL above</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default function AmenitiesPage() {
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const { addToast } = useToast()

  const [amenities, setAmenities] = useState<Amenity[]>([
    { name: '', description: '', image: '' },
  ])

  useEffect(() => {
    if (settings) {
      const parsed = buildAmenities(settings as Record<string, unknown>)
      setAmenities(parsed.length > 0 ? parsed : [{ name: '', description: '', image: '' }])
    }
  }, [settings])

  function handleChange(index: number, field: keyof Amenity, value: string) {
    setAmenities((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  function handleDelete(index: number) {
    setAmenities((prev) => prev.filter((_, i) => i !== index))
  }

  function handleAdd() {
    setAmenities((prev) => [...prev, { name: '', description: '', image: '' }])
  }

  function handleSave() {
    const valid = amenities.filter((a) => a.name.trim())
    updateSettings.mutate(
      {
        settings: [
          { key: 'amenities_data', value: JSON.stringify(valid), group: 'branding' },
        ],
      },
      {
        onSuccess: () => addToast('Amenities saved successfully', 'success'),
        onError: () => addToast('Failed to save amenities', 'error'),
      },
    )
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Amenities" description="Manage hotel amenities and features" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl border border-gray-200 bg-white/50" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="pb-24">
      <PageHeader
        title="Amenities"
        description="Configure the amenities displayed on the homepage. These appear in both the 'Why Stay With Us' and 'Amenities' sections."
      />

      <div className="space-y-4">
        {amenities.map((item, i) => (
          <AmenityCard
            key={i}
            item={item}
            index={i}
            canDelete={amenities.length > 1}
            onChange={handleChange}
            onDelete={handleDelete}
          />
        ))}

        <button
          onClick={handleAdd}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-white/50 py-4 text-sm text-muted transition-all hover:border-gold/40 hover:bg-gold/5 hover:text-gold-dark"
        >
          <Plus className="h-4 w-4" /> Add Amenity
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] backdrop-blur-sm lg:left-[260px]">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
          <p className="mr-auto hidden text-xs text-muted sm:block">
            {amenities.filter((a) => a.name.trim()).length} amenit{amenities.filter((a) => a.name.trim()).length === 1 ? 'y' : 'ies'} configured
          </p>
          <Button variant="primary" onClick={handleSave} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Amenities
          </Button>
        </div>
      </div>
    </div>
  )
}
