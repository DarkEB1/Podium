import { AtSign, Camera, Music2, Video } from 'lucide-react'

import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

export interface SocialAccounts {
  instagram?: string
  tiktok?: string
  youtube?: string
  twitter?: string
}

interface PlatformDef {
  key: keyof SocialAccounts
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
  className?: string
}

/**
 * ProfileSocialStrip — horizontal preview strip of connected social platforms
 * (spec §10.2.2). Each connected account is a labelled, icon-backed external
 * link; platforms without a URL are skipped. When nothing is connected a
 * designed empty state stands in.
 */
export default function ProfileSocialStrip({ accounts, className }: ProfileSocialStripProps) {
  const connected = PLATFORMS.filter((p) => {
    const url = accounts[p.key]
    return typeof url === 'string' && url.length > 0
  })

  if (connected.length === 0) {
    return (
      <EmptyState
        {...(className ? { className } : {})}
        title="No social accounts"
        description="Connected social profiles will appear here."
      />
    )
  }

  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {connected.map(({ key, label, Icon }) => (
        <li key={key}>
          <a
            href={accounts[key]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-[var(--radius)] border bg-card px-4 py-2 text-medium text-foreground shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
            <span>{label}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
