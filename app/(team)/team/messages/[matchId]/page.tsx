import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getMessages } from '@/lib/supabase/messaging'
import { getProposals } from '@/lib/supabase/deals'
import { buttonVariants } from '@/components/ui/button'
import ChatWindow from '@/components/messaging/chat-window'
import ChatPageShell from '@/components/layout/chat-page-shell'
import { ROUTES } from '@/lib/routes'
import type { Database } from '@/types/database'

// M-1 — deliberately generic title, identical for every conversation, so a
// counterparty's identity never leaks into history, analytics or a shared screen.
export function generateMetadata(): Metadata {
  return {
    title: 'Conversation · Podium',
    description: 'A conversation on Podium.',
    robots: { index: false },
  }
}

type MessageRow = Database['public']['Tables']['messages']['Row']
type ProposalRow = Database['public']['Tables']['proposals']['Row']

export default async function TeamChatPage({
  params,
}: {
  params: Promise<{ matchId: string }>
}) {
  const { matchId } = await params
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)

  let messages: MessageRow[] = []
  let proposals: ProposalRow[] = []

  try {
    messages = (await getMessages(supabase, matchId)) as MessageRow[]
    proposals = (await getProposals(supabase, matchId)) as ProposalRow[]
  } catch {
    redirect(ROUTES.team.messages)
  }

  return (
    <ChatPageShell>
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Link href={ROUTES.team.messages} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          ←
        </Link>
        <h1 className="text-large text-foreground">Conversation</h1>
      </div>
      <ChatWindow
        matchId={matchId}
        initialMessages={messages}
        proposals={proposals}
        currentUserId={user.id}
        viewerRole="team"
      />
    </ChatPageShell>
  )
}
