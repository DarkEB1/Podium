import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getConversations } from '@/lib/supabase/messaging'
import MatchList from '@/components/messaging/match-list'

export default async function AthleteMessagesPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const conversations = await getConversations(supabase, user.id)

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-6 py-12 md:px-16 md:py-16">
      <header className="space-y-2">
        <h1 className="text-display text-foreground">Messages</h1>
        <p className="text-muted-foreground">Your conversations with brands and agents.</p>
      </header>
      <MatchList conversations={conversations} basePath="/athlete/messages" />
    </div>
  )
}
