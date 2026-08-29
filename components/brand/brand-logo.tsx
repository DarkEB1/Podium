import { cn } from '@/lib/utils'
import { brandColor, brandInitials } from '@/components/discovery/brand-visual'

const SIZE = {
  sm: 'size-10 rounded-lg text-sm',
  lg: 'size-20 rounded-2xl text-2xl',
} as const

interface BrandLogoProps {
  name: string
  logoUrl?: string | null
  size?: keyof typeof SIZE
  className?: string
}

/**
 * A brand's logo as a standalone tile: the uploaded image when there is one,
 * otherwise the same deterministic monogram the discovery cards use
 * (`BrandLockup`), so a brand reads the same everywhere.
 */
export default function BrandLogo({ name, logoUrl, size = 'sm', className }: BrandLogoProps) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- brand logos come from arbitrary hosts not declared in next.config images.remotePatterns
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className={cn('shrink-0 object-cover ring-1 ring-foreground/10', SIZE[size], className)}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: brandColor(name) }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-bold text-white',
        SIZE[size],
        className,
      )}
    >
      {brandInitials(name)}
    </span>
  )
}
