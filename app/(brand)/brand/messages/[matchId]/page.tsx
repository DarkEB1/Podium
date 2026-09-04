import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getMessages, getMatch, markMatchRead, otherParticipantId } from '@/lib/supabase/messaging'
import { getProposals } from '@/lib/supabase/deals'
import { buttonVariants } from '@/components/ui/button'
import BrandChatEntry from '@/components/messaging/brand-chat-entry'
import ChatPageShell from '@/components/layout/chat-page-shell'
import type { Database } from '@/types/database'

/**
 * M-1 — deliberately GENERIC and identical for every record.
 *
 * A page title is written to browser history, sent in the document title to
 * analytics, and is visible on a shared screen or a screencast. Interpolating
 * the subject's name here ("Sarah Okoro — Athlete") would leak a real person's
 * identity into all three, so the title says only what kind of page this is.
 * `robots: { index: false }` keeps it out of search results as well.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Conversation · Podium',
    description: 'A conversation on Podium.',
    robots: { index: false },
  }
}


type MessageRow = Database['public']['Tables']['messages']['Row']
type ProposalRow = Database['public']['Tables']['proposals']['Row']

export default async function BrandChatPage({
  params,
}: {
  params: Promise<{ matchId: string }>
}) {
  const { matchId } = await params
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  let messages: MessageRow[] = []
  let proposals: ProposalRow[] = []
  let otherUserId: string | undefined

  try {
    // getMessages and getProposals return typed arrays for the given match
    messages = (await getMessages(supabase, matchId)) as MessageRow[]
    proposals = (await getProposals(supabase, matchId)) as ProposalRow[]
    const match = await getMatch(supabase, matchId)
    if (match) otherUserId = otherParticipantId(match, user.id)
    // WS-MSG-02: opening a conversation clears its unread count. Best-effort —
    // a watermark write must not fail rendering the thread the user just opened.
    await markMatchRead(supabase, matchId).catch(() => {})
  } catch {
    redirect('/brand/messages')
  }

  return (
    <ChatPageShell>
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Link href="/brand/messages" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          ←
        </Link>
        <h1 className="text-large">Conversation</h1>
      </div>
      <BrandChatEntry
        matchId={matchId}
        initialMessages={messages}
        proposals={proposals}
        currentUserId={user.id}
        viewerRole="brand"
        otherUserId={otherUserId}
      />
    </ChatPageShell>
  )
}
