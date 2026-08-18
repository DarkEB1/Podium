'use client'

import * as React from 'react'
import Link from 'next/link'
import { Archive, MessageSquare, SearchX } from 'lucide-react'

import { UserAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * View-model for one inbox row (spec §7.1). The page derives this from the
 * `matches` + latest `messages` data; the component stays pure UI + interaction.
 */
export interface Conversation {
  /** match id — used for the chat route and archive action */
  id: string
  /** other participant's display name */
  name: string
  /** other participant's avatar, or null for the initials fallback */
  avatarUrl: string | null
  /** last message preview text */
  preview: string
  /** ISO 8601 timestamp of the last message (UTC) */
  timestamp: string
  /** number of unread messages for the current user */
  unreadCount: number
}

type SortMode = 'recent' | 'oldest' | 'unread'

/** A labelled link rendered as a button in the zero-conversations state. */
export interface EmptyInboxAction {
  label: string
  href: string
}

interface Props {
  conversations: Conversation[]
  basePath: string
  /**
   * Archive handler — persists `match_status=archived` (spec §7.1). The row is
   * optimistically removed from the inbox before this resolves. Omit to hide the
   * archive affordance entirely.
   */
  onArchive?: (id: string) => void | Promise<void>
  /**
   * Copy + calls-to-action for the zero-conversations ("inbox is quiet") state.
   * Each surface points a first-time user at the right next step (athletes →
   * requests / discover); brand and team fall back to the generic default copy
   * with no actions. The description should reuse the page subtitle's nouns so
   * the empty state and subtitle read as one voice.
   */
  emptyInbox?: {
    description?: string
    primaryAction?: EmptyInboxAction
    secondaryAction?: EmptyInboxAction
  }
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString()
}

function sortConversations(list: Conversation[], mode: SortMode): Conversation[] {
  const byRecent = (a: Conversation, b: Conversation) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  const sorted = [...list]
  if (mode === 'oldest') {
    sorted.sort((a, b) => -byRecent(a, b))
  } else if (mode === 'unread') {
    sorted.sort((a, b) => {
      const unreadDiff = (b.unreadCount > 0 ? 1 : 0) - (a.unreadCount > 0 ? 1 : 0)
      return unreadDiff !== 0 ? unreadDiff : byRecent(a, b)
    })
  } else {
    sorted.sort(byRecent)
  }
  return sorted
}

export default function MatchList({ conversations, basePath, onArchive, emptyInbox }: Props) {
  const [query, setQuery] = React.useState('')
  const [sort, setSort] = React.useState<SortMode>('recent')
  const [archived, setArchived] = React.useState<Set<string>>(new Set())
  const [menuFor, setMenuFor] = React.useState<string | null>(null)

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = conversations.filter((c) => {
      if (archived.has(c.id)) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q)
      )
    })
    return sortConversations(filtered, sort)
  }, [conversations, query, sort, archived])

  function handleArchive(id: string) {
    setMenuFor(null)
    setArchived((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    void onArchive?.(id)
  }

  const hasConversations = conversations.some((c) => !archived.has(c.id))

  const hasActions = Boolean(emptyInbox?.primaryAction || emptyInbox?.secondaryAction)

  return (
    <div className="space-y-6">
      {/*
        MSG2 — the search/sort row does nothing over an empty inbox, so it only
        renders once there is at least one conversation to filter or sort.
      */}
      {hasConversations ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label htmlFor="conversation-search" className="sr-only">
              Search conversations
            </label>
            <Input
              id="conversation-search"
              type="search"
              role="searchbox"
              placeholder="Search by name or message"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="conversation-sort" className="sr-only">
              Sort conversations
            </label>
            <select
              id="conversation-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="h-10 rounded-xl border border-border bg-card px-4 text-medium"
            >
              <option value="recent">Most recent</option>
              <option value="oldest">Oldest</option>
              <option value="unread">Unread first</option>
            </select>
          </div>
        </div>
      ) : null}

      {/*
        UX-1 / MSG4 — the empty and no-match states sit inside the same bordered
        card the populated list uses, so the inbox keeps one layout frame instead
        of a full-width illustration floating beside the left-aligned header.
      */}
      {!hasConversations ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {/* MSG3 — copy reuses the subtitle's nouns so a first-timer connects
              "connection request" to the conversations that appear here. */}
          <EmptyState
            variant="emptyInbox"
            iconComponent={MessageSquare}
            description={
              emptyInbox?.description ??
              'When you accept a connection request, your conversation appears here.'
            }
            className={hasActions ? 'pb-6' : ''}
          />
          {/* MSG1 — give the empty inbox somewhere to go. */}
          {hasActions ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 pb-16 sm:flex-row">
              {emptyInbox?.primaryAction ? (
                <Link
                  href={emptyInbox.primaryAction.href}
                  className={buttonVariants({ variant: 'default', size: 'lg' })}
                >
                  {emptyInbox.primaryAction.label}
                </Link>
              ) : null}
              {emptyInbox?.secondaryAction ? (
                <Link
                  href={emptyInbox.secondaryAction.href}
                  className={buttonVariants({ variant: 'outline', size: 'lg' })}
                >
                  {emptyInbox.secondaryAction.label}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : visible.length === 0 ? (
        // MSG2 — distinct "no matches for this query" state, not the generic
        // "inbox is quiet", with a one-tap way back to the full list.
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <EmptyState
            iconComponent={SearchX}
            title={`No conversations match '${query.trim()}'`}
            description="Try a different name, or clear the search to see everyone again."
            action={{ label: 'Clear search', onClick: () => setQuery('') }}
          />
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {visible.map((c) => {
            const unread = c.unreadCount > 0
            return (
              <li
                key={c.id}
                data-testid={`conversation-${c.id}`}
                data-unread={unread ? 'true' : 'false'}
                className="relative"
                onContextMenu={
                  onArchive
                    ? (e) => {
                        e.preventDefault()
                        setMenuFor(c.id)
                      }
                    : undefined
                }
              >
                <SwipeRow
                  enabled={Boolean(onArchive)}
                  onArchive={() => handleArchive(c.id)}
                >
                  <Link
                    href={`${basePath}/${c.id}`}
                    className={cn(
                      'flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50',
                      'border-l-4',
                      unread ? 'border-l-primary bg-primary/5' : 'border-l-transparent'
                    )}
                  >
                    {/* B-5 — photo → initials → silhouette; never a broken image. */}
                    <UserAvatar size="lg" src={c.avatarUrl} name={c.name} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          data-testid="conversation-name"
                          className={cn(
                            'truncate text-medium',
                            unread ? 'font-semibold text-foreground' : 'text-foreground'
                          )}
                        >
                          {c.name}
                        </p>
                        <span className="shrink-0 text-small text-muted-foreground">
                          {formatTimestamp(c.timestamp)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            'truncate text-small',
                            unread ? 'text-foreground' : 'text-muted-foreground'
                          )}
                        >
                          {c.preview}
                        </p>
                        {unread ? (
                          <Badge
                            aria-label={`${c.unreadCount} unread messages`}
                            className="shrink-0 bg-primary text-primary-foreground"
                          >
                            {c.unreadCount}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </SwipeRow>

                {menuFor === c.id && onArchive ? (
                  <ContextMenu onClose={() => setMenuFor(null)}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleArchive(c.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-medium hover:bg-muted"
                    >
                      <Archive aria-hidden="true" className="size-4" />
                      Archive
                    </button>
                  </ContextMenu>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * SwipeRow — wraps a conversation row. On touch devices a right-swipe past the
 * threshold archives (spec §7.1); on desktop right-click opens the context menu.
 */
function SwipeRow({
  children,
  enabled,
  onArchive,
}: {
  children: React.ReactNode
  enabled: boolean
  onArchive: () => void
}) {
  const startX = React.useRef<number | null>(null)

  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0]?.clientX ?? null
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (!enabled || startX.current === null) return
    const endX = e.changedTouches[0]?.clientX ?? startX.current
    if (endX - startX.current > 80) onArchive()
    startX.current = null
  }

  return (
    <div
      onTouchStart={enabled ? handleTouchStart : undefined}
      onTouchEnd={enabled ? handleTouchEnd : undefined}
    >
      {children}
    </div>
  )
}

/**
 * ContextMenu — minimal accessible menu that closes on outside click or Escape.
 */
function ContextMenu({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  const ref = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    // Ignore the pointerdown that may immediately follow the opening contextmenu
    // event so the menu does not close on the very interaction that opened it.
    let armed = false
    const arm = window.setTimeout(() => {
      armed = true
    }, 0)
    function onDocPointer(e: MouseEvent) {
      if (!armed) return
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onDocPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(arm)
      document.removeEventListener('pointerdown', onDocPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute right-4 top-2 z-20 min-w-32 overflow-hidden rounded-xl border border-border bg-card shadow-card"
    >
      {children}
    </div>
  )
}
