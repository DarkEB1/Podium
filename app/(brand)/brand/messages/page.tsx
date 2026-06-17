import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getConversations } from '@/lib/supabase/messaging'
import MatchList from '@/components/messaging/match-list'

export default async function BrandMessagesPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const conversations = await getConversations(supabase, user.id)

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 space-y-6 md:px-16">
      <h1 className="text-large font-bold">Messages</h1>
      <MatchList conversations={conversations} basePath="/brand/messages" />
    </div>
  )
}
