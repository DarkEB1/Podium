'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Eye, FileText, UserMinus } from 'lucide-react'

import { isRemoteImageSrc } from '@/components/ui/image-src'

import { Button, buttonVariants } from '@/components/ui/button'
import { LevelChip } from '@/components/ui/status-badges'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

export interface AgentClientRow {
  /** representation_links.id — the link this row revokes. */
  linkId: string
  /** representation_links.client_user_id — the represented user. */
  clientUserId: string
  name: string
  photoUrl: string | null
  sport: string | null
  level: string | null
  activeDeals: number
  /** ISO timestamp of the client's last activity, or null if never. */
  lastActivity: string | null
}

function formatActivity(iso: string | null): string {
  if (!iso) return 'No activity yet'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'No activity yet'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

interface Props {
  clients: AgentClientRow[]
  /** Revokes the agent's representation link. Page-supplied (server action / API). */
  onRevoke: (linkId: string) => void | Promise<void>
}

/**
 * ClientTable — the agent's client roster (spec §6B.1): photo, name, sport,
 * level, active-deal count, and last activity, each row with four quick
 * actions (View Profile, Message, View Deals, Revoke Access). Action labels
 * are always visible text (icons are decorative) so meaning never relies on
 * colour or glyph alone.
 */
export default function ClientTable({ clients, onRevoke }: Props) {
  const [revoking, setRevoking] = useState<string | null>(null)

  if (clients.length === 0) {
    return (
      <EmptyState
        title="No clients yet"
        description="When athletes and teams accept your representation request, they will appear here."
      />
    )
  }

  async function handleRevoke(linkId: string) {
    setRevoking(linkId)
    try {
      await onRevoke(linkId)
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full border-collapse text-medium">
        <caption className="sr-only">Your clients</caption>
        <thead>
          <tr className="border-b border-border text-left text-small text-muted-foreground">
            <th scope="col" className="px-6 py-4 font-medium">
              Client
            </th>
            <th scope="col" className="px-6 py-4 font-medium">
              Sport
            </th>
            <th scope="col" className="px-6 py-4 font-medium">
              Level
            </th>
            <th scope="col" className="px-6 py-4 font-medium">
              Active deals
            </th>
            <th scope="col" className="px-6 py-4 font-medium">
              Last activity
            </th>
            <th scope="col" className="px-6 py-4 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.linkId} className="border-b border-border last:border-0 align-middle">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  {client.photoUrl ? (
                    // A-2: explicit 40×40 intrinsic size — the row reserves the
                    // thumbnail's footprint, and off-screen rows lazy-load.
                    <Image
                      src={client.photoUrl}
                      alt={client.name}
                      width={40}
                      height={40}
                      loading="lazy"
                      unoptimized={isRemoteImageSrc(client.photoUrl)}
                      className="size-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-small font-medium text-muted-foreground"
                    >
                      {initials(client.name)}
                    </span>
                  )}
                  <span className="font-medium text-foreground">{client.name}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-muted-foreground">{client.sport ?? '—'}</td>
              <td className="px-6 py-4">
                {client.level ? <LevelChip level={client.level} /> : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-6 py-4 tabular-nums">{client.activeDeals}</td>
              <td className="px-6 py-4 text-small text-muted-foreground">
                {formatActivity(client.lastActivity)}
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <Link
                    href={`/agent/profile/${client.clientUserId}`}
                    className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                  >
                    <Eye aria-hidden="true" />
                    View Profile
                  </Link>
                  {/* B-4: /agent/messages does not exist — this link 404'd.
                      Agents have no messaging surface yet; restore this button
                      when one ships rather than pointing at a dead route. */}
                  <Link
                    href={`/agent/dashboard?client=${client.clientUserId}#pipeline`}
                    className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                  >
                    <FileText aria-hidden="true" />
                    View Deals
                  </Link>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={revoking === client.linkId}
                    onClick={() => handleRevoke(client.linkId)}
                  >
                    <UserMinus aria-hidden="true" />
                    {revoking === client.linkId ? 'Revoking…' : 'Revoke Access'}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
