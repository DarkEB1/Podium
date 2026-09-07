'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import ChatWindow from './chat-window'
import ProposalForm from '@/components/brand/proposal-form'
import type { Database } from '@/types/database'

type MessageRow = Database['public']['Tables']['messages']['Row']
type ProposalRow = Database['public']['Tables']['proposals']['Row']

interface Props {
  matchId: string
  currentUserId: string
  initialMessages: MessageRow[]
  proposals: ProposalRow[]
  /** M-6 — role of the signed-in viewer, forwarded to proposal analytics. */
  viewerRole?: string | undefined
  /** WS-MSG-05 — the other participant's id, forwarded to the chat Block control. */
  otherUserId?: string | undefined
}

/**
 * Brand-side first-open wrapper enforcing the mandatory-proposal rule (spec §7.3).
 * On a brand's first open of a new match (no proposal sent yet), the free-text
 * composer is hidden and replaced by a prominent "Send a Proposal" CTA. Sending
 * a proposal unlocks the full chat experience (free-text composer).
 */
export default function BrandChatEntry({
  matchId,
  currentUserId,
  initialMessages,
  proposals,
  viewerRole,
  otherUserId,
}: Props) {
  const [sentProposals, setSentProposals] = useState<ProposalRow[]>(proposals)
  const [open, setOpen] = useState(false)

  const hasProposal = sentProposals.length > 0

  if (hasProposal) {
    return (
      <ChatWindow
        matchId={matchId}
        initialMessages={initialMessages}
        proposals={sentProposals}
        currentUserId={currentUserId}
        viewerRole={viewerRole}
        otherUserId={otherUserId}
      />
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center md:px-16">
      <div className="max-w-md space-y-4">
        <h2 className="font-heading text-large font-semibold text-foreground">
          Send a Proposal to Start the Conversation
        </h2>
        <p className="text-medium leading-relaxed text-muted-foreground">
          Podium requires you to send a formal proposal before messaging. Outline
          the opportunity, pay, and timeline so the athlete can respond. Once your
          proposal is sent, you can chat freely.
        </p>
      </div>

      <Button onClick={() => setOpen(true)}>Send a Proposal</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Proposal</DialogTitle>
            <DialogDescription>
              Send a formal proposal to begin the conversation with this athlete.
            </DialogDescription>
          </DialogHeader>
          <ProposalForm
            matchId={matchId}
            onSent={(proposal) => {
              setSentProposals((prev) => [...prev, proposal])
              setOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
