import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getMessages } from '@/lib/supabase/messaging'
import { getProposals } from '@/lib/supabase/deals'
import { buttonVariants } from '@/components/ui/button'
import BrandChatEntry from '@/components/messaging/brand-chat-entry'
import type { Database } from '@/types/database'

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

  try {
    // getMessages and getProposals return typed arrays for the given match
    messages = (await getMessages(supabase, matchId)) as MessageRow[]
    proposals = (await getProposals(supabase, matchId)) as ProposalRow[]
  } catch {
    redirect('/brand/messages')
  }

  return (
    <div className="mx-auto max-w-2xl h-screen flex flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Link href="/brand/messages" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          ←
        </Link>
        <h1 className="font-semibold">Conversation</h1>
      </div>
      <BrandChatEntry
        matchId={matchId}
        initialMessages={messages}
        proposals={proposals}
        currentUserId={user.id}
      />
    </div>
  )
}
