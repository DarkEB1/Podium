'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { SendHorizonal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { createClient } from '@/lib/supabase/client'
import {
  typingChannel,
  onTyping,
  onReadReceipt,
  sendTyping,
  sendReadReceipt,
  closeChannel,
} from '@/lib/realtime'
import { cn } from '@/lib/utils'
import MessageBubble from './message-bubble'
import ProposalCardMessage from './proposal-card-message'
import type { Database } from '@/types/database'

type MessageRow = Database['public']['Tables']['messages']['Row']
type ProposalRow = Database['public']['Tables']['proposals']['Row']

interface Props {
  matchId: string
  initialMessages: MessageRow[]
  proposals: ProposalRow[]
  currentUserId: string
  /** M-6 — role of the signed-in viewer, forwarded to proposal analytics. */
  viewerRole?: string | undefined
}

/** Subscribe defensively: a channel may be mocked without a `.subscribe` in tests. */
function safeSubscribe(channel: { subscribe?: () => unknown }): void {
  if (typeof channel.subscribe === 'function') channel.subscribe()
}

/** Animated three-dot typing indicator (spec §7.2); honours prefers-reduced-motion. */
function TypingIndicator() {
  return (
    <div className="flex justify-start" data-testid="typing-indicator" aria-live="polite">
      <span className="sr-only">Typing…</span>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className="size-2 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

export default function ChatWindow({
  matchId,
  initialMessages,
  proposals,
  currentUserId,
  viewerRole,
}: Props) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [otherTyping, setOtherTyping] = useState(false)
  // Id of the last message the other participant has read (drives read ticks).
  const [lastReadByOther, setLastReadByOther] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const proposalMap = new Map(proposals.map((p) => [p.id, p]))

  // Postgres INSERT stream for new messages.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`match:${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const msg = payload.new as MessageRow
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId])

  // Ephemeral typing + read-receipt signals via the shared realtime helpers (B10).
  useEffect(() => {
    const supabase = createClient()
    const channel = typingChannel(supabase, matchId)
    onTyping(channel, ({ userId, isTyping }) => {
      if (userId === currentUserId) return
      setOtherTyping(isTyping)
    })
    onReadReceipt(channel, ({ userId, lastReadMessageId }) => {
      if (userId === currentUserId) return
      setLastReadByOther(lastReadMessageId)
    })
    safeSubscribe(channel)
    return () => {
      void closeChannel(supabase, channel)
    }
  }, [matchId, currentUserId])

  // Tell the other side we've read up to the latest message we received.
  useEffect(() => {
    const lastIncoming = [...messages].reverse().find((m) => m.sender_id !== currentUserId)
    if (!lastIncoming) return
    const supabase = createClient()
    const channel = typingChannel(supabase, matchId)
    safeSubscribe(channel)
    void sendReadReceipt(channel, currentUserId, lastIncoming.id, new Date().toISOString())
    return () => {
      void closeChannel(supabase, channel)
    }
  }, [messages, matchId, currentUserId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, otherTyping])

  // Index of the last of MY messages — only it shows a receipt tick.
  const lastMineIndex = messages.reduce(
    (acc, m, i) => (m.sender_id === currentUserId ? i : acc),
    -1
  )

  function handleTextChange(value: string) {
    setText(value)
    const supabase = createClient()
    const channel = typingChannel(supabase, matchId)
    safeSubscribe(channel)
    void sendTyping(channel, currentUserId, value.length > 0)
  }

  async function sendText(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/messaging/matches/${matchId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_type: 'text', text_content: text.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed to send')
        return
      }
      setText('')
      const supabase = createClient()
      const channel = typingChannel(supabase, matchId)
      safeSubscribe(channel)
      void sendTyping(channel, currentUserId, false)
    } finally {
      setSending(false)
    }
  }

  // Enter sends, Shift+Enter inserts a newline (PR-18: the composer is now a
  // multi-line textarea, so Enter can no longer rely on implicit form submit).
  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey) return
    e.preventDefault()
    if (sending || !text.trim()) return
    void sendText(e)
  }

  return (
    // PR-18: `min-w-0` on every column in this stack. Without it a flex child
    // resolves min-width to its content width, and one long unbroken message or
    // a wide composer pushes the whole conversation off-screen.
    <div className="flex h-[calc(100vh-8rem)] min-w-0 flex-col">
      <div className="flex-1 min-w-0 space-y-4 overflow-y-auto overflow-x-hidden px-6 py-8">
        {messages.length === 0 && !otherTyping ? (
          <EmptyState
            variant="emptyInbox"
            title="No messages yet"
            description="Say hello — the first message is the hard one."
          />
        ) : null}
        {messages.map((msg, i) => {
          if (msg.content_type === 'proposal_card' || msg.content_type === 'payment_confirmation') {
            const meta = msg.metadata as { proposal_id?: string } | null
            const proposalId = meta?.proposal_id
            const proposal = proposalId ? proposalMap.get(proposalId) : undefined
            if (!proposal) return null
            const isPayment = msg.content_type === 'payment_confirmation'
            return (
              <div
                key={msg.id}
                className={cn('flex', msg.sender_id === currentUserId ? 'justify-end' : 'justify-start')}
              >
                <ProposalCardMessage
                  proposal={proposal}
                  isMine={msg.sender_id === currentUserId}
                  viewerRole={viewerRole}
                  onResponded={() => {}}
                  paymentConfirmation={
                    isPayment
                      ? { amount: proposal.pay_amount, currency: proposal.pay_currency }
                      : undefined
                  }
                />
              </div>
            )
          }
          const isMine = msg.sender_id === currentUserId
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isMine={isMine}
              readByOther={isMine && i === lastMineIndex && lastReadByOther === msg.id}
            />
          )
        })}
        {otherTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={sendText}
        className="flex w-full min-w-0 items-end gap-3 border-t border-border px-6 py-4"
      >
        <label htmlFor="chat-composer" className="sr-only">
          Message
        </label>
        <Textarea
          id="chat-composer"
          data-testid="chat-composer"
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder="Type a message…"
          disabled={sending}
          rows={1}
          autoGrow
          maxHeight={160}
          // `min-w-0` is what actually stops the flex row from overflowing; the
          // Textarea primitive carries it too, kept here as the local contract.
          className="min-h-10 w-full min-w-0 flex-1 py-2"
        />
        <Button
          type="submit"
          size="icon"
          disabled={sending || !text.trim()}
          aria-label="Send message"
          className="shrink-0"
        >
          <SendHorizonal className="size-4" aria-hidden="true" />
        </Button>
      </form>
    </div>
  )
}
