import Link from 'next/link'
import { AtSign, Camera, Music2, Video } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { parseSocialInput, type SocialPlatform } from '@/lib/social/handles'
import { cn } from '@/lib/utils'

export interface SocialAccounts {
  instagram?: string
  tiktok?: string
  youtube?: string
  twitter?: string
}

interface PlatformDef {
  key: SocialPlatform & keyof SocialAccounts
  label: string
  Icon: typeof Camera
}

const PLATFORMS: PlatformDef[] = [
  { key: 'instagram', label: 'Instagram', Icon: Camera },
  { key: 'tiktok', label: 'TikTok', Icon: Music2 },
  { key: 'youtube', label: 'YouTube', Icon: Video },
  { key: 'twitter', label: 'X / Twitter', Icon: AtSign },
]

export interface ProfileSocialStripProps {
  accounts: SocialAccounts
  /** Viewer owns this profile — the empty state gains a "Connect social" CTA. */
  isOwner?: boolean
  /** Where "Connect social" points (the athlete settings profile section). */
  connectHref?: string
  className?: string
}

/**
 * ProfileSocialStrip — horizontal preview strip of connected social platforms
 * (spec §10.2.2). Stored values are read through `parseSocialInput`
 * (lib/social/handles.ts) so both canonical handles and legacy full-URL rows
 * render as "@handle" with a working absolute profile URL; values that cannot
 * be read as a handle are skipped. When nothing is connected a condensed empty
 * state stands in — paragraph text, not a heading, so it never pollutes the
 * section's outline (PROF9) — with an inline "Connect social" action for the
 * owner that reads as opening settings.
 */
export default function ProfileSocialStrip({
  accounts,
  isOwner = false,
  connectHref,
  className,
}: ProfileSocialStripProps) {
  const connected = PLATFORMS.flatMap((platform) => {
    const parsed = parseSocialInput(platform.key, accounts[platform.key])
    return parsed ? [{ ...platform, ...parsed }] : []
  })

  if (connected.length === 0) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center',
          className,
        )}
      >
        <p className="text-medium text-foreground">No social accounts</p>
        <p className="mx-auto mt-1 max-w-prose text-small text-muted-foreground">
          {isOwner && connectHref
            ? 'Connect your social accounts in Settings so brands can see your reach.'
            : 'Connected social profiles will appear here.'}
        </p>
        {isOwner && connectHref ? (
          <Link
            href={connectHref}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3')}
          >
            Connect social
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {connected.map(({ key, label, Icon, handle, url }) => (
        <li key={key}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-[var(--radius)] border bg-card px-4 py-2 text-medium text-foreground shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
            <span>{label}</span>
            <span className="text-muted-foreground">@{handle}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
