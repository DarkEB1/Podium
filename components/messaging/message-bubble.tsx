'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Download, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isRemoteImageSrc } from '@/components/ui/image-src'
import { solidBlurDataURL } from '@/lib/perf/blur-placeholder'
import type { Database } from '@/types/database'

type MessageRow = Database['public']['Tables']['messages']['Row']

interface Props {
  message: MessageRow
  isMine: boolean
  /** Whether the other participant has read up to (and including) this message. */
  readByOther?: boolean
}

/** Human-readable byte size, e.g. 2097152 -> "2 MB". */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb % 1 === 0 ? kb : kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb % 1 === 0 ? mb : mb.toFixed(1)} MB`
}

/** Single tick (delivered) / double tick (read) — never colour-alone (spec §9.4). */
function ReadReceipt({ read }: { read: boolean }) {
  if (read) {
    return (
      <span
        data-testid="receipt-read"
        aria-label="Read"
        role="img"
        className="ml-1 inline-flex items-center"
      >
        <svg width="16" height="12" viewBox="0 0 18 12" fill="none" aria-hidden="true">
          <path
            d="M1 6.5 4 9.5 9.5 3M7.5 8 8 8.5 13.5 2.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    )
  }
  return (
    <span
      data-testid="receipt-delivered"
      aria-label="Delivered"
      role="img"
      className="ml-1 inline-flex items-center"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path
          d="M1.5 6.5 4.5 9.5 10.5 2.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function AttachmentTile({ message, isMine }: { message: MessageRow; isMine: boolean }) {
  const meta = message.metadata as { file_name?: string } | null
  const name = meta?.file_name ?? message.text_content ?? 'Attachment'
  const size = message.attachment_size_bytes
  const isImage = message.content_type === 'image'

  if (isImage && message.attachment_url) {
    return (
      <a
        href={message.attachment_url}
        target="_blank"
        rel="noopener noreferrer"
        download
        className="block overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={`Download ${name}`}
      >
        {/*
          Preview tile — alt text required for a11y (spec §9.4). A-2: next/image
          with an explicit intrinsic size so the bubble reserves its footprint
          before the bytes land (no CLS) and the tile lazy-loads off-screen.
        */}
        <Image
          src={message.attachment_url}
          alt={name}
          width={512}
          height={384}
          loading="lazy"
          placeholder="blur"
          blurDataURL={solidBlurDataURL()}
          unoptimized={isRemoteImageSrc(message.attachment_url)}
          className="max-h-48 w-full object-cover"
        />
      </a>
    )
  }

  return (
    <a
      href={message.attachment_url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      download
      aria-label={`Download ${name}`}
      className={cn(
        'flex items-center gap-2 rounded-lg border p-2 text-small focus-visible:outline-2 focus-visible:outline-primary',
        isMine ? 'border-primary-foreground/30' : 'border-border'
      )}
    >
      <FileText aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{name}</span>
        {typeof size === 'number' && (
          <span className={cn('block', isMine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
            {formatSize(size)}
          </span>
        )}
      </span>
      <Download aria-hidden="true" className="size-4 shrink-0" />
    </a>
  )
}

export default function MessageBubble({ message, isMine, readByOther = false }: Props) {
  const [showTime, setShowTime] = useState(false)

  if (message.is_deleted) {
    return (
      <div className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
        <p className="text-small text-muted-foreground italic px-3 py-1">Message deleted</p>
      </div>
    )
  }

  const hasAttachment =
    message.content_type === 'image' ||
    message.content_type === 'video' ||
    message.content_type === 'document'

  return (
    <div className={cn('flex min-w-0', isMine ? 'justify-end' : 'justify-start')}>
      <button
        type="button"
        onClick={() => setShowTime((v) => !v)}
        aria-expanded={showTime}
        aria-label={showTime ? 'Hide timestamp' : 'Show timestamp'}
        className={cn(
          // PR-18: cap the bubble relative to the column (max-w-[75%]) and hard-cap
          // it in absolute terms, then force wrapping. `[overflow-wrap:anywhere]`
          // is what breaks a single 400-character token that `break-words` alone
          // will happily overflow with.
          'min-w-0 max-w-[75%] sm:max-w-md rounded-2xl px-4 py-2 text-medium text-left',
          'break-words [overflow-wrap:anywhere] hyphens-auto',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isMine
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm'
        )}
      >
        {hasAttachment ? (
          <AttachmentTile message={message} isMine={isMine} />
        ) : (
          <span className="block min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {message.text_content}
          </span>
        )}

        {showTime && (
          <span
            data-testid="bubble-timestamp"
            className={cn(
              'mt-1 flex items-center justify-end text-small',
              isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}
          >
            {new Date(message.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {isMine && <ReadReceipt read={readByOther} />}
          </span>
        )}

        {/* Receipt always visible on own messages even before timestamp tap. */}
        {isMine && !showTime && (
          <span className="mt-0.5 flex items-center justify-end">
            <ReadReceipt read={readByOther} />
          </span>
        )}
      </button>
    </div>
  )
}
