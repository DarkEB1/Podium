'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { toast } from 'sonner'
import { SendHorizonal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { createClient } from '@/lib/supabase/client'
import { markMatchRead } from '@/lib/supabase/messaging'
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
import { SPRING } from '@/lib/motion/springs'
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
  /**
   * WS-MSG-05 — the other participant's user id. When provided, a minimal Block
   * control is shown; blocking closes the channel (RLS refuses further messages
   * and the conversation drops out of both inboxes). Omitted → no control (a
   * later workstream builds out the messaging header/UX).
   */
  otherUserId?: string | undefined
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
  otherUserId,
}: Props) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [otherTyping, setOtherTyping] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [blocking, setBlocking] = useState(false)
  // Id of the last message the other participant has read (drives read ticks).
  const [lastReadByOther, setLastReadByOther] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Entry motion (UX audit M4): only messages that arrive AFTER first mount
  // spring in from their sender's side. The ids present at mount are recorded
  // once; anything not in that set is genuinely new. Existing bubbles never
  // replay — Framer runs the enter animation on mount only, and keys are stable
  // message ids, so re-renders (typing indicator, read receipts) never remount.
  const reduced = useReducedMotion()
  const initialIdsRef = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)))
  const enterProps = (isMine: boolean, isNew: boolean) => {
    if (!isNew) return { initial: false as const }
    if (reduced) {
      return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: SPRING.default }
    }
    return {
      initial: { opacity: 0, y: 8, scale: 0.98 },
      animate: { opacity: 1, y: 0, scale: 1 },
      transition: SPRING.default,
      style: { transformOrigin: isMine ? 'right' : 'left' },
    }
  }

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
          // WS-MSG-02: an incoming message the viewer is looking at is read on
          // arrival, so its unread badge never lingers on the inbox. Best-effort
          // (own messages excluded); a failure just leaves the watermark for the
          // next open to move.
          if (msg.sender_id !== currentUserId) {
            void markMatchRead(supabase, matchId).catch(() => {})
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId, currentUserId])

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

  async function handleBlock() {
    if (!otherUserId || blocking) return
    if (!window.confirm('Block this user? They will no longer be able to message you, and this conversation will be hidden.')) {
      return
    }
    setBlocking(true)
    try {
      const res = await fetch('/api/discovery/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked_id: otherUserId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 409) {
        toast.error(data.error?.message ?? 'Failed to block user')
        return
      }
      setBlocked(true)
      toast.success('User blocked')
    } finally {
      setBlocking(false)
    }
  }

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
      // WS-MSG-03: show the sender's own message immediately from the 201 body.
      // The realtime INSERT stream is for the OTHER participant; the sender's own
      // client is not guaranteed its own change event, so without this the
      // composer would clear and the message would not appear until reload.
      // Deduped by id so a realtime echo cannot double it.
      const sent = data as MessageRow
      if (sent?.id) {
        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]))
      }
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
    <div className="flex min-h-0 flex-1 min-w-0 flex-col">
      {otherUserId && !blocked && (
        <div className="flex items-center justify-end border-b border-border px-6 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleBlock}
            disabled={blocking}
            className="text-destructive"
          >
            {blocking ? 'Blocking…' : 'Block'}
          </Button>
        </div>
      )}
      <div className="min-h-0 flex-1 min-w-0 space-y-4 overflow-y-auto overflow-x-hidden px-6 py-8">
        {messages.length === 0 && !otherTyping ? (
          <EmptyState
            variant="emptyInbox"
            title="No messages yet"
            description="Say hello. The first message is the hard one."
          />
        ) : null}
        {messages.map((msg, i) => {
          const isMine = msg.sender_id === currentUserId
          const isNew = !initialIdsRef.current.has(msg.id)
          if (msg.content_type === 'proposal_card' || msg.content_type === 'payment_confirmation') {
            const meta = msg.metadata as { proposal_id?: string } | null
            const proposalId = meta?.proposal_id
            const proposal = proposalId ? proposalMap.get(proposalId) : undefined
            if (!proposal) return null
            const isPayment = msg.content_type === 'payment_confirmation'
            return (
              <motion.div
                key={msg.id}
                {...enterProps(isMine, isNew)}
                className={cn('flex', isMine ? 'justify-end' : 'justify-start')}
              >
                <ProposalCardMessage
                  proposal={proposal}
                  isMine={isMine}
                  viewerRole={viewerRole}
                  onResponded={() => {}}
                  paymentConfirmation={
                    isPayment
                      ? { amount: proposal.pay_amount, currency: proposal.pay_currency }
                      : undefined
                  }
                />
              </motion.div>
            )
          }
          return (
            <motion.div key={msg.id} {...enterProps(isMine, isNew)}>
              <MessageBubble
                message={msg}
                isMine={isMine}
                readByOther={isMine && i === lastMineIndex && lastReadByOther === msg.id}
              />
            </motion.div>
          )
        })}
        {otherTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>
      {blocked ? (
        <div className="border-t border-border px-6 py-4 text-center text-small text-muted-foreground">
          You have blocked this user. This conversation is now closed.
        </div>
      ) : (
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
      )}
    </div>
  )
}
