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
    <div className="mx-auto max-w-2xl px-6 py-12 space-y-10 md:px-16 md:py-16">
      <header className="space-y-3">
        <h1 className="text-display">Messages</h1>
        <p className="text-medium text-muted-foreground">
          Your conversations with athletes and teams.
        </p>
      </header>
      <MatchList conversations={conversations} basePath="/brand/messages" />
    </div>
  )
}
