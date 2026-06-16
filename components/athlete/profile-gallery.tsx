import { ImageIcon } from 'lucide-react'

import { BlurImage } from '@/components/ui/blur-image'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

export interface ProfileGalleryProps {
  /** Athlete display name, used to build descriptive alt text. */
  name: string
  photos: string[]
  className?: string
}

/**
 * ProfileGallery — a 2-column masonry photo gallery of an athlete's action
 * photos (spec §10.2.2). Uses CSS columns for the masonry effect and BlurImage
 * (A8) for blur-up loading. With no media it shows a designed empty state.
 */
export default function ProfileGallery({ name, photos, className }: ProfileGalleryProps) {
  if (photos.length === 0) {
    return (
      <EmptyState
        {...(className ? { className } : {})}
        icon={<ImageIcon />}
        title="No photos yet"
        description="Action photos will appear here once they have been added to this profile."
      />
    )
  }

  return (
    <div className={cn('columns-2 gap-4 [&>*]:mb-4', className)}>
      {photos.map((src, i) => (
        <BlurImage
          key={src}
          src={src}
          alt={`${name} action photo ${i + 1}`}
          className="w-full break-inside-avoid rounded-[var(--radius)]"
        />
      ))}
    </div>
  )
}
