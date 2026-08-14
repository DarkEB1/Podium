import { ImageIcon } from 'lucide-react'

import { BlurImage } from '@/components/ui/blur-image'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

export interface ProfileGalleryProps {
  /** Athlete display name, used to build descriptive alt text. */
  name: string
  photos: string[]
  /** Viewer owns this profile — the empty state gains an "Add photos" CTA. */
  isOwner?: boolean
  /** Where "Add photos" points (the athlete settings profile section). */
  manageHref?: string
  className?: string
}

/**
 * ProfileGallery — a 2-column masonry photo gallery of an athlete's action
 * photos (spec §10.2.2). Uses CSS columns for the masonry effect and BlurImage
 * (A8) for blur-up loading. With no media it shows a designed empty state;
 * the profile's owner additionally gets an inline "Add photos" action so the
 * gap is fixable from where it is noticed.
 */
export default function ProfileGallery({
  name,
  photos,
  isOwner = false,
  manageHref,
  className,
}: ProfileGalleryProps) {
  if (photos.length === 0) {
    const owner = isOwner && manageHref
    return (
      <EmptyState
        {...(className ? { className } : {})}
        icon={<ImageIcon />}
        title="No photos yet"
        description={
          owner
            ? 'Add action photos from your settings so brands can see you in your element.'
            : 'Action photos will appear here once they have been added to this profile.'
        }
        {...(isOwner && manageHref
          ? { action: { label: 'Add photos', href: manageHref } }
          : {})}
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
