'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
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
}

export default function ChatWindow({ matchId, initialMessages, proposals, currentUserId }: Props) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const proposalMap = new Map(proposals.map((p) => [p.id, p]))

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
    return () => { supabase.removeChannel(channel) }
  }, [matchId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendText(e: React.FormEvent) {
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
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to send'); return }
      setText('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.map((msg) => {
          if (msg.content_type === 'proposal_card') {
            const proposalId = (msg.metadata as { proposal_id?: string })?.proposal_id
            const proposal = proposalId ? proposalMap.get(proposalId) : undefined
            if (proposal) {
              return (
                <div key={msg.id} className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
                  <ProposalCardMessage
                    proposal={proposal}
                    isMine={msg.sender_id === currentUserId}
                    onResponded={() => {}}
                  />
                </div>
              )
            }
            return null
          }
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isMine={msg.sender_id === currentUserId}
            />
          )
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={sendText} className="border-t p-3 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          disabled={sending}
          className="flex-1"
        />
        <Button type="submit" disabled={sending || !text.trim()}>Send</Button>
      </form>
    </div>
  )
}
