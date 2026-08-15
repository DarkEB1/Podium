import Link from 'next/link'
import { ImageIcon } from 'lucide-react'

import { BlurImage } from '@/components/ui/blur-image'
import { buttonVariants } from '@/components/ui/button'
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
 * (A8) for blur-up loading. With no media it shows a condensed empty state —
 * paragraph text rather than a heading, so it never pollutes the section
 * outline (PROF9) — and the profile's owner additionally gets an inline
 * "Add photos" action so the gap is fixable from where it is noticed.
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
      <div
        className={cn(
          'rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center',
          className,
        )}
      >
        <ImageIcon aria-hidden="true" className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-2 text-medium text-foreground">No photos yet</p>
        <p className="mx-auto mt-1 max-w-prose text-small text-muted-foreground">
          {owner
            ? 'Add action photos in Settings so brands can see you in your element.'
            : 'Action photos will appear here once they have been added to this profile.'}
        </p>
        {isOwner && manageHref ? (
          <Link
            href={manageHref}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3')}
          >
            Add photos
          </Link>
        ) : null}
      </div>
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
