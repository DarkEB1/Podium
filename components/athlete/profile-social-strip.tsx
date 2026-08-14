import { AtSign, Camera, Music2, Video } from 'lucide-react'

import { EmptyState } from '@/components/ui/empty-state'
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
 * be read as a handle are skipped. When nothing is connected a designed empty
 * state stands in, with an inline "Connect social" action for the owner.
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
      <EmptyState
        {...(className ? { className } : {})}
        title="No social accounts"
        description={
          isOwner && connectHref
            ? 'Connect your social accounts from your settings so brands can see your reach.'
            : 'Connected social profiles will appear here.'
        }
        {...(isOwner && connectHref
          ? { action: { label: 'Connect social', href: connectHref } }
          : {})}
      />
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
