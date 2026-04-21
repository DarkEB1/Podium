import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type MessageRow = Database['public']['Tables']['messages']['Row']

interface Props {
  message: MessageRow
  isMine: boolean
}

export default function MessageBubble({ message, isMine }: Props) {
  if (message.is_deleted) {
    return (
      <div className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
        <p className="text-xs text-muted-foreground italic px-3 py-1">Message deleted</p>
      </div>
    )
  }

  if (message.content_type !== 'text') {
    return null
  }

  return (
    <div className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-xs rounded-2xl px-4 py-2 text-sm',
          isMine
            ? 'bg-foreground text-background rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm'
        )}
      >
        {message.text_content}
        <p className={cn('text-xs mt-1', isMine ? 'text-background/60' : 'text-muted-foreground')}>
          {new Date(message.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
