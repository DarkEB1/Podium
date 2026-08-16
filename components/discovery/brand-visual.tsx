import type { ListingSummary } from '@/lib/supabase/discovery'

/**
 * Shared brand-visual + pay helpers for the discovery surfaces.
 *
 * These were originally local to `listing-card.tsx`. They are extracted here so
 * the old marketplace card, the new Live Board opportunity card and its
 * card-back all read a brand the same way and never drift apart (DISC7).
 */

export const PAY_TYPE_LABEL: Record<string, string> = {
  flat_fee: 'Flat fee',
  monthly_retainer: 'Monthly retainer',
  per_post: 'Per post',
  revenue_share: 'Revenue share',
}

/** Human sport/level string, e.g. `semi_professional` becomes `semi professional`. */
export function formatLevel(level: string | null): string | null {
  return level ? level.replace(/_/g, ' ') : null
}

/** Two-letter monogram used as a brand logo stand-in (DISC1/DISC7). */
export function brandInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

/** Deterministic hue (0-359) so a brand always reads the same colour everywhere. */
export function brandHue(name: string): number {
  let hue = 0
  for (let i = 0; i < name.length; i++) hue = (hue * 31 + name.charCodeAt(i)) % 360
  return hue
}

/** Deterministic brand colour so a brand always reads the same across cards. */
export function brandColor(name: string): string {
  return `hsl(${brandHue(name)} 52% 42%)`
}

/**
 * A branded cover tile (DISC1/DISC7). Real brand artwork is preferred; when a
 * brand has uploaded none, this inline SVG gives the card an intentional,
 * on-brand cover: a deterministic gradient in the brand's colour with its
 * monogram, instead of a single flat grey placeholder shared by every card.
 * Encoded as a data URI so it needs no network round-trip or stored asset.
 */
export function brandCoverDataUri(name: string): string {
  const hue = brandHue(name)
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 240'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='hsl(${hue} 55% 46%)'/>` +
    `<stop offset='1' stop-color='hsl(${hue} 52% 30%)'/>` +
    `</linearGradient></defs>` +
    `<rect width='400' height='240' fill='url(#g)'/>` +
    `<text x='200' y='150' text-anchor='middle' font-family='system-ui,sans-serif' ` +
    `font-size='104' font-weight='700' fill='rgba(255,255,255,0.9)'>${brandInitials(name)}</text>` +
    `</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * DISC4: the pay slot is always populated. A listing with no `pay_amount` used
 * to drop the row entirely, so cards were uneven. Every card now states its pay
 * shape: a figure, "Revenue share", or "Fee undisclosed".
 */
export function payDisplay(
  listing: Pick<ListingSummary, 'pay_type' | 'pay_amount' | 'pay_currency'>
): { value: string; label: string } {
  if (listing.pay_type === 'revenue_share') return { value: 'Revenue share', label: '' }
  if (listing.pay_amount != null) {
    return {
      value: `${listing.pay_currency} ${listing.pay_amount.toLocaleString()}`,
      label: listing.pay_type ? (PAY_TYPE_LABEL[listing.pay_type] ?? '') : '',
    }
  }
  return { value: 'Fee undisclosed', label: '' }
}

/**
 * Brand name preceded by the real brand logo when one exists, else a coloured
 * monogram stand-in. The mark is decorative (the name carries the label).
 */
export function BrandLockup({
  name,
  logoUrl,
  className,
}: {
  name: string
  logoUrl?: string | null
  className?: string
}) {
  return (
    <span className={className}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- brand logos come from arbitrary hosts not declared in next.config images.remotePatterns
        <img
          src={logoUrl}
          alt=""
          aria-hidden="true"
          className="size-5 shrink-0 rounded-full object-cover ring-1 ring-foreground/10"
        />
      ) : (
        <span
          aria-hidden="true"
          style={{ backgroundColor: brandColor(name) }}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
        >
          {brandInitials(name)}
        </span>
      )}
      <span className="min-w-0 truncate">{name}</span>
    </span>
  )
}
